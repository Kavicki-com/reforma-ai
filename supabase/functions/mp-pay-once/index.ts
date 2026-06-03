import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { adminClient, corsHeaders, env, getUser, json, mpAccessToken, mpFetch } from "../_shared/mp.ts"

// Pagamento avulso (PIX ou boleto) do plano anual à vista — sem renovação automática.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const admin = adminClient()
    const user = await getUser(req, admin)
    if (!user) return json({ ok: false, error: "Não autenticado." }, 401)

    const { method, planCode = "anual", payer } = await req.json()
    if (!["pix", "bolbradesco"].includes(method)) {
      return json({ ok: false, error: "Método deve ser 'pix' ou 'bolbradesco'." }, 400)
    }
    // Boleto exige dados do pagador (nome + CPF); PIX também pede e-mail.
    if (!payer?.email) return json({ ok: false, error: "E-mail do pagador é obrigatório." }, 400)
    if (method === "bolbradesco" && (!payer?.first_name || !payer?.identification?.number)) {
      return json({ ok: false, error: "Boleto requer nome e CPF do pagador." }, 400)
    }

    const { data: plan, error: planErr } = await admin
      .from("plans")
      .select("code, name, amount, currency, active")
      .eq("code", planCode)
      .eq("active", true)
      .single()
    if (planErr || !plan) return json({ ok: false, error: "Plano inválido." }, 400)

    const payload: Record<string, unknown> = {
      transaction_amount: Number(plan.amount),
      description: plan.name,
      payment_method_id: method,
      external_reference: user.id,
      payer: {
        email: payer.email,
        first_name: payer.first_name,
        last_name: payer.last_name,
        identification: payer.identification, // { type: 'CPF', number: '...' }
      },
    }

    const mp = await mpFetch("/v1/payments", {
      method: "POST",
      headers: { "X-Idempotency-Key": `${user.id}-${planCode}-${method}` },
      body: JSON.stringify(payload),
    })
    if (!mp.ok) {
      const debug = { mpEnv: env("MP_ENV") || "(vazio)", tokenApp: (mpAccessToken().split("-")[1] || "?") }
      console.error("[mp-pay-once] MP erro", mp.status, JSON.stringify(mp.data), "debug", JSON.stringify(debug))
      return json({ ok: false, error: mp.data?.message || "Falha ao gerar pagamento.", detail: mp.data, debug }, 502)
    }

    const p = mp.data
    // Assinatura fica pendente até o webhook confirmar a aprovação.
    const { data: sub, error: upErr } = await admin
      .from("subscriptions")
      .upsert(
        {
          owner_id: user.id,
          plan_code: plan.code,
          status: "pending",
          kind: "one_time",
          auto_renew: false,
          current_period_end: null,
        },
        { onConflict: "owner_id" },
      )
      .select("id")
      .single()
    if (upErr) console.error("[mp-pay-once] upsert sub erro", JSON.stringify(upErr))

    await admin.from("subscription_payments").upsert(
      {
        owner_id: user.id,
        subscription_id: sub?.id ?? null,
        mp_payment_id: String(p.id),
        kind: "one_time",
        status: p.status,
        amount: Number(plan.amount),
        method,
        raw: p,
      },
      { onConflict: "mp_payment_id" },
    )

    // Devolve só o necessário pro cliente renderizar QR/boleto.
    const tx = p?.point_of_interaction?.transaction_data
    return json({
      ok: true,
      paymentId: p.id,
      status: p.status,
      pix: method === "pix" && tx
        ? { qrCode: tx.qr_code, qrCodeBase64: tx.qr_code_base64, ticketUrl: tx.ticket_url }
        : null,
      boleto: method === "bolbradesco"
        ? {
          url: p?.transaction_details?.external_resource_url,
          barcode: p?.barcode?.content ?? null,
        }
        : null,
    })
  } catch (e) {
    console.error("[mp-pay-once] exceção", String((e as Error)?.message || e))
    return json({ ok: false, error: String((e as Error)?.message || e) }, 500)
  }
})
