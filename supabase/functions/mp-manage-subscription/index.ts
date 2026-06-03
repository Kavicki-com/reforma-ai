import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { adminClient, corsHeaders, getUser, json, mpFetch } from "../_shared/mp.ts"

// Gerencia a assinatura recorrente do usuário: cancelar ou trocar o cartão.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const admin = adminClient()
    const user = await getUser(req, admin)
    if (!user) return json({ ok: false, error: "Não autenticado." }, 401)

    const { action, cardToken, cardLast4, cardBrand } = await req.json()

    const { data: sub } = await admin
      .from("subscriptions")
      .select("id, mp_preapproval_id, kind")
      .eq("owner_id", user.id)
      .maybeSingle()
    if (!sub?.mp_preapproval_id) return json({ ok: false, error: "Assinatura recorrente não encontrada." }, 404)

    if (action === "cancel") {
      const mp = await mpFetch(`/preapproval/${sub.mp_preapproval_id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "cancelled" }),
      })
      if (!mp.ok) return json({ ok: false, error: mp.data?.message || "Falha ao cancelar.", detail: mp.data }, 502)
      await admin.from("subscriptions")
        .update({ status: "cancelled", auto_renew: false })
        .eq("id", sub.id)
      return json({ ok: true, status: "cancelled" })
    }

    if (action === "update_card") {
      if (!cardToken) return json({ ok: false, error: "cardToken é obrigatório." }, 400)
      const mp = await mpFetch(`/preapproval/${sub.mp_preapproval_id}`, {
        method: "PUT",
        body: JSON.stringify({ card_token_id: cardToken }),
      })
      if (!mp.ok) return json({ ok: false, error: mp.data?.message || "Falha ao atualizar o cartão.", detail: mp.data }, 502)
      await admin.from("subscriptions")
        .update({ card_last4: cardLast4 ?? null, card_brand: cardBrand ?? null })
        .eq("id", sub.id)
      return json({ ok: true })
    }

    return json({ ok: false, error: "Ação inválida." }, 400)
  } catch (e) {
    console.error("[mp-manage-subscription] exceção", String((e as Error)?.message || e))
    return json({ ok: false, error: String((e as Error)?.message || e) }, 500)
  }
})
