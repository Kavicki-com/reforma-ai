// Utilidades compartilhadas das Edge Functions de pagamento (Mercado Pago).
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2"

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

export function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  })
}

// Secrets costumam vir colados do painel com aspas/\n; limpamos.
export function env(name: string): string {
  return (Deno.env.get(name) || "").trim().replace(/^["']|["']$/g, "")
}

export const MP_API = "https://api.mercadopago.com"

// Sufixo do ambiente atual (PROD quando MP_ENV=production, senão TEST).
function mpSuffix(): "PROD" | "TEST" {
  return env("MP_ENV").toLowerCase() === "production" ? "PROD" : "TEST"
}

// Resolve credencial por ambiente, com fallback ao nome sem sufixo.
export function mpAccessToken(): string {
  return env(`MP_ACCESS_TOKEN_${mpSuffix()}`) || env("MP_ACCESS_TOKEN")
}

export function mpWebhookSecret(): string {
  return env(`MP_WEBHOOK_SECRET_${mpSuffix()}`) || env("MP_WEBHOOK_SECRET")
}

// Cliente com service role: ignora RLS, usado para escrever assinaturas.
export function adminClient(): SupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// Valida o JWT do usuário (vindo do supabase.functions.invoke) e devolve o user.
export async function getUser(req: Request, admin: SupabaseClient) {
  const auth = req.headers.get("Authorization") || ""
  const token = auth.replace(/^Bearer\s+/i, "")
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}

// Chamada autenticada à API do MP.
export async function mpFetch(path: string, init: RequestInit = {}) {
  const resp = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${mpAccessToken()}`,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  })
  const data = await resp.json().catch(() => ({}))
  return { ok: resp.ok, status: resp.status, data }
}
