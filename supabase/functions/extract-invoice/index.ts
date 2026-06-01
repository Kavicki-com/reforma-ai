import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "content-type": "application/json" } })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    // trim + remove aspas acidentais (secret colado no painel costuma vir com \n)
    const apiKey = (Deno.env.get("GEMINI_API_KEY") || "").trim().replace(/^["']|["']$/g, "")
    console.log("[extract-invoice] key length:", apiKey.length)
    if (!apiKey) return json({ ok: false, error: "GEMINI_API_KEY não configurada." }, 500)

    const { image, mimeType } = await req.json()
    if (!image) return json({ ok: false, error: "Imagem ausente." }, 400)

    const body = {
      contents: [{ parts: [{ inline_data: { mime_type: mimeType || "image/jpeg", data: image } }, { text: PROMPT }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema, thinkingConfig: { thinkingBudget: 0 } },
    }

    let lastErr: unknown = null
    for (const model of MODELS) {
      for (let attempt = 1; attempt <= 4; attempt++) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
        let resp: Response
        try {
          resp = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
        } catch (e) {
          lastErr = String((e as Error)?.message || e)
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
        lastErr = data?.error ?? data
        console.error(`[extract-invoice] ${model} status ${resp.status} tentativa ${attempt}:`, JSON.stringify(data?.error || data))
        const msg = String(data?.error?.message || "")
        if (resp.status === 429 && msg.includes("limit: 0")) break // cota zero: próximo modelo
        if (resp.status === 401 || resp.status === 403) return json({ ok: false, error: msg || "Chave inválida.", detail: data?.error }, 502)
        await sleep(1200) // 404/503/500/429 transitórios => tenta de novo
      }
    }

    return json({ ok: false, error: (lastErr as any)?.message || String(lastErr) || "Serviço da IA indisponível no momento.", detail: lastErr }, 502)
  } catch (e) {
    console.error("[extract-invoice] exceção:", String((e as Error)?.message || e))
    return json({ ok: false, error: String((e as Error)?.message || e) }, 500)
  }
})
