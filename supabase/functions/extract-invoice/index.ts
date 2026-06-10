import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { adminClient, getUser, env, corsHeadersFor } from "../_shared/mp.ts"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Leituras de nota por usuário por dia (denial-of-wallet no Gemini).
const DAILY_LIMIT = Number(env("EXTRACT_INVOICE_DAILY_LIMIT")) || 30

const PROMPT = `Você recebe a imagem ou PDF de uma nota fiscal, cupom fiscal ou comprovante de compra brasileiro. Extraia os dados e responda APENAS o JSON pedido. amount = valor TOTAL pago (número). date = data YYYY-MM-DD. payee = loja/fornecedor. description = resumo curto. items = lista de {name, quantity, unit, unit_price}. Se não existir, use vazio ou 0.`

const responseSchema = {
  type: "OBJECT",
  properties: {
    description: { type: "STRING" },
    amount: { type: "NUMBER" },
    payee: { type: "STRING" },
    date: { type: "STRING" },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          quantity: { type: "NUMBER" },
          unit: { type: "STRING" },
          unit_price: { type: "NUMBER" },
        },
      },
    },
  },
  required: ["description", "amount", "payee", "date", "items"],
}

// gemini-2.0-flash tem cota grátis zero neste projeto; usamos os 2.5.
const MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"]

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req)
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "content-type": "application/json" } })

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const admin = adminClient()
    const user = await getUser(req, admin)
    if (!user) return json({ ok: false, error: "Não autenticado." }, 401)

    // Mesma regra do Gate do app: assinatura ativa OU trial vigente.
    const [profileQ, subQ] = await Promise.all([
      admin.from("profiles").select("trial_ends_at").eq("id", user.id).maybeSingle(),
      admin.from("subscriptions").select("status, current_period_end").eq("owner_id", user.id).maybeSingle(),
    ])
    const sub = subQ.data
    const isActive = sub?.status === "active" &&
      (!sub.current_period_end || new Date(sub.current_period_end) > new Date())
    const trialEnd = profileQ.data?.trial_ends_at ? new Date(profileQ.data.trial_ends_at) : null
    const inTrial = !!trialEnd && trialEnd > new Date()
    if (!isActive && !inTrial) {
      return json({ ok: false, error: "Seu período de teste terminou. Assine para continuar usando a leitura de notas." }, 403)
    }

    const { data: usedToday, error: usageErr } = await admin.rpc("bump_ai_usage", { uid: user.id })
    if (usageErr) {
      console.error("[extract-invoice] bump_ai_usage:", usageErr.message)
      return json({ ok: false, error: "Não foi possível verificar seu limite de uso. Tente novamente." }, 500)
    }
    if (Number(usedToday) > DAILY_LIMIT) {
      return json({ ok: false, error: "Limite diário de leituras de nota atingido. Tente novamente amanhã." }, 429)
    }

    const apiKey = env("GEMINI_API_KEY")
    if (!apiKey) {
      console.error("[extract-invoice] GEMINI_API_KEY não configurada")
      return json({ ok: false, error: "Serviço de IA indisponível no momento." }, 500)
    }

    const { image, mimeType } = await req.json()
    if (!image) return json({ ok: false, error: "Imagem ausente." }, 400)

    const body = {
      contents: [{ parts: [{ inline_data: { mime_type: mimeType || "image/jpeg", data: image } }, { text: PROMPT }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema, thinkingConfig: { thinkingBudget: 0 } },
    }

    for (const model of MODELS) {
      for (let attempt = 1; attempt <= 4; attempt++) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
        let resp: Response
        try {
          resp = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
        } catch (e) {
          console.error(`[extract-invoice] ${model} fetch tentativa ${attempt}:`, String((e as Error)?.message || e))
          await sleep(1200)
          continue
        }
        const data = await resp.json()
        if (resp.ok) {
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
          let parsed
          try { parsed = JSON.parse(text) } catch { return json({ ok: false, error: "Resposta da IA inválida." }, 502) }
          return json({ ok: true, data: parsed, model })
        }
        // Detalhes do erro ficam só no log do servidor; o cliente recebe mensagem genérica.
        console.error(`[extract-invoice] ${model} status ${resp.status} tentativa ${attempt}:`, JSON.stringify(data?.error || data))
        const msg = String(data?.error?.message || "")
        if (resp.status === 429 && msg.includes("limit: 0")) break // cota zero: próximo modelo
        if (resp.status === 401 || resp.status === 403) return json({ ok: false, error: "Serviço de IA indisponível no momento." }, 502)
        await sleep(1200) // 404/503/500/429 transitórios => tenta de novo
      }
    }

    return json({ ok: false, error: "Serviço da IA indisponível no momento." }, 502)
  } catch (e) {
    console.error("[extract-invoice] exceção:", String((e as Error)?.message || e))
    return json({ ok: false, error: "Erro interno ao processar a nota." }, 500)
  }
})
