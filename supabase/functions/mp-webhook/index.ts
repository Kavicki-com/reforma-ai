import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { adminClient, json, mpFetch, mpWebhookSecret } from "../_shared/mp.ts"

// Valida a assinatura x-signature do Mercado Pago.
// manifest = id:<data.id>;request-id:<x-request-id>;ts:<ts>;  -> HMAC-SHA256(secret) == v1
async function validSignature(req: Request, dataId: string): Promise<boolean> {
  const secret = mpWebhookSecret()
  if (!secret) return false
  const sig = req.headers.get("x-signature") || ""
  const requestId = req.headers.get("x-request-id") || ""
  const parts = Object.fromEntries(
    sig.split(",").map((kv) => kv.split("=").map((s) => s.trim())) as [string, string][],
  )
  const ts = parts["ts"]
  const v1 = parts["v1"]
  if (!ts || !v1) return false

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest))
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("")
  // comparação em tempo constante
  if (hex.length !== v1.length) return false
  let diff = 0
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i)
  return diff === 0
}

const addMonths = (n: number) => {
  const d = new Date()
  d.setMonth(d.getMonth() + n)
  return d.toISOString()
}
const oneYearFromNow = () => addMonths(12)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200 })
  if (req.method !== "POST") return new Response("ok", { status: 200 })

  try {
    const url = new URL(req.url)
    const body = await req.json().catch(() => ({}))
    // o id do recurso vem em ?data.id= ou no corpo (data.id) dependendo do evento.
    const type = body?.type || url.searchParams.get("type") || body?.topic || url.searchParams.get("topic")
    const dataId = String(body?.data?.id || url.searchParams.get("data.id") || body?.id || "")

    if (!dataId) return new Response("ok", { status: 200 })

    if (!(await validSignature(req, dataId))) {
      console.error("[mp-webhook] assinatura inválida", type, dataId)
      return new Response("invalid signature", { status: 401 })
    }

    const admin = adminClient()

    if (type === "payment") {
      // Pagamento avulso (PIX/boleto). Confirma na API antes de gravar.
      const mp = await mpFetch(`/v1/payments/${dataId}`)
      if (!mp.ok) return new Response("ok", { status: 200 })
      const p = mp.data
      const ownerId = p?.external_reference
      if (!ownerId) return new Response("ok", { status: 200 })

      await admin.from("subscription_payments").upsert(
        {
          owner_id: ownerId,
          mp_payment_id: String(p.id),
          kind: "one_time",
          status: p.status,
          amount: p.transaction_amount,
          method: p.payment_method_id === "pix" ? "pix" : (p.payment_method_id === "bolbradesco" ? "bolbradesco" : null),
          raw: p,
        },
        { onConflict: "mp_payment_id" },
      )

      if (p.status === "approved") {
        await admin.from("subscriptions").update({
          status: "active",
          current_period_end: oneYearFromNow(),
          auto_renew: false,
        }).eq("owner_id", ownerId).eq("kind", "one_time")
      }
      return new Response("ok", { status: 200 })
    }

    if (type === "subscription_preapproval" || type === "preapproval") {
      // Mudança de estado da assinatura recorrente.
      const mp = await mpFetch(`/preapproval/${dataId}`)
      if (!mp.ok) return new Response("ok", { status: 200 })
      const pre = mp.data
      const ownerId = pre?.external_reference
      if (!ownerId) return new Response("ok", { status: 200 })

      const map: Record<string, string> = {
        authorized: "active",
        paused: "paused",
        cancelled: "cancelled",
        pending: "pending",
      }
      await admin.from("subscriptions").update({
        status: map[pre.status] || "pending",
        mp_preapproval_id: String(pre.id),
        mp_payer_id: pre.payer_id ? String(pre.payer_id) : null,
      }).eq("owner_id", ownerId).eq("kind", "recurring_card")
      return new Response("ok", { status: 200 })
    }

    if (type === "subscription_authorized_payment") {
      // Cobrança recorrente individual: registra e estende o período.
      const mp = await mpFetch(`/authorized_payments/${dataId}`)
      if (!mp.ok) return new Response("ok", { status: 200 })
      const ap = mp.data
      const preapprovalId = ap?.preapproval_id
      if (!preapprovalId) return new Response("ok", { status: 200 })

      const { data: sub } = await admin
        .from("subscriptions")
        .select("id, owner_id, plan_code, plans(billing_period)")
        .eq("mp_preapproval_id", String(preapprovalId))
        .maybeSingle()
      if (!sub) return new Response("ok", { status: 200 })

      await admin.from("subscription_payments").upsert(
        {
          owner_id: sub.owner_id,
          subscription_id: sub.id,
          mp_payment_id: String(ap.payment?.id ?? ap.id),
          kind: "recurring_card",
          status: ap.status,
          amount: ap.transaction_amount,
          method: "credit_card",
          raw: ap,
        },
        { onConflict: "mp_payment_id" },
      )

      if (ap.status === "processed" || ap.payment?.status === "approved") {
        // estende o acesso até a próxima cobrança (mensal ou anual).
        const period = (sub as { plans?: { billing_period?: string } }).plans?.billing_period
        await admin.from("subscriptions").update({
          status: "active",
          current_period_end: addMonths(period === "yearly" ? 12 : 1),
        }).eq("id", sub.id)
      }
      return new Response("ok", { status: 200 })
    }

    return new Response("ok", { status: 200 })
  } catch (e) {
    console.error("[mp-webhook] exceção", String((e as Error)?.message || e))
    // 200 evita reentregas infinitas em erro nosso; logs ficam para inspeção.
    return new Response("ok", { status: 200 })
  }
})
