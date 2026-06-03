import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { adminClient, corsHeaders, env, getUser, json, mpFetch } from "../_shared/mp.ts"

// Assinatura recorrente via cartão de crédito (Checkout Transparente).
// Recebe um card_token gerado no cliente — o cartão nunca toca este servidor.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const admin = adminClient()
    const user = await getUser(req, admin)
    if (!user) return json({ ok: false, error: "Não autenticado." }, 401)

    const { planCode, cardToken, payerEmail, cardLast4, cardBrand } = await req.json()
    if (!planCode || !cardToken) return json({ ok: false, error: "planCode e cardToken são obrigatórios." }, 400)

    // Plano (preço/periodicidade) vem do nosso banco, não do cliente.
    const { data: plan, error: planErr } = await admin
      .from("plans")
      .select("code, name, billing_period, amount, currency, trial_days, active")
      .eq("code", planCode)
      .eq("active", true)
      .single()
    if (planErr || !plan) return json({ ok: false, error: "Plano inválido." }, 400)

    const frequency = plan.billing_period === "yearly" ? 12 : 1
    const email = payerEmail || user.email

    const autoRecurring: Record<string, unknown> = {
      frequency,
      frequency_type: "months",
      transaction_amount: Number(plan.amount),
      currency_id: plan.currency || "BRL",
    }
    // Trial grátis: adia a primeira cobrança em trial_days dias.
    if (Number(plan.trial_days) > 0) {
      autoRecurring.free_trial = { frequency: Number(plan.trial_days), frequency_type: "days" }
    }

    // preapproval SEM plano associado: auto_recurring inline + status authorized.
    const payload = {
      reason: plan.name,
      external_reference: user.id,
      payer_email: email,
      card_token_id: cardToken,
      auto_recurring: autoRecurring,
      back_url: env("APP_URL") || "https://krovo.kavicki.com/assinatura",
      status: "authorized",
    }

    const mp = await mpFetch("/preapproval", { method: "POST", body: JSON.stringify(payload) })
    if (!mp.ok) {
      console.error("[mp-subscribe-card] MP erro", mp.status, JSON.stringify(mp.data))
      return json({ ok: false, error: mp.data?.message || "Falha ao criar assinatura no Mercado Pago.", detail: mp.data }, 502)
    }

    // status do MP: "authorized" (ativo) ou "pending".
    const status = mp.data?.status === "authorized" ? "active" : "pending"
    const { error: upErr } = await admin.from("subscriptions").upsert(
      {
        owner_id: user.id,
        plan_code: plan.code,
        status,
        kind: "recurring_card",
        mp_preapproval_id: mp.data?.id ?? null,
        mp_payer_id: mp.data?.payer_id ? String(mp.data.payer_id) : null,
        auto_renew: true,
        current_period_end: null,
        next_payment_date: mp.data?.next_payment_date ?? null,
        card_last4: cardLast4 ?? null,
        card_brand: cardBrand ?? null,
      },
      { onConflict: "owner_id" },
    )
    if (upErr) {
      console.error("[mp-subscribe-card] upsert erro", JSON.stringify(upErr))
      return json({ ok: false, error: "Assinatura criada no MP, mas falhou ao salvar localmente.", detail: upErr.message }, 500)
    }

    return json({ ok: true, status, preapprovalId: mp.data?.id })
  } catch (e) {
    console.error("[mp-subscribe-card] exceção", String((e as Error)?.message || e))
    return json({ ok: false, error: String((e as Error)?.message || e) }, 500)
  }
})
