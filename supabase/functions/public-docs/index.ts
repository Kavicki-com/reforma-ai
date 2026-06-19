import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

// Entrega os documentos (notas e comprovantes) do link público SOMENTE quando
// token + senha conferem. A senha é validada na RPC get_protected_documents
// (pgcrypto); as signed URLs são geradas aqui com a service role, sem nunca
// expor o bucket "documentos" ao papel anon.

function env(name: string): string {
  return (Deno.env.get(name) || "").trim().replace(/^["']|["']$/g, "")
}
function appOrigin(): string {
  const raw = env("APP_URL") || "https://krovo.kavicki.com"
  try { return new URL(raw).origin } catch { return "https://krovo.kavicki.com" }
}
function corsHeadersFor(req: Request) {
  const allowed = new Set([appOrigin(), "http://localhost:5173", "http://localhost:4173"])
  const origin = req.headers.get("Origin") || ""
  return {
    "Access-Control-Allow-Origin": allowed.has(origin) ? origin : appOrigin(),
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  }
}
function adminClient() {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req)
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, "content-type": "application/json" } })

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  try {
    const { token, password } = await req.json().catch(() => ({}))
    if (!token || !password) return json({ ok: false, error: "Dados ausentes." }, 400)

    const admin = adminClient()
    const { data: docs, error } = await admin.rpc("get_protected_documents", {
      p_token: token,
      p_password: password,
    })
    if (error) {
      console.error("[public-docs] rpc:", error.message)
      return json({ ok: false, error: "Erro ao validar a senha." }, 500)
    }
    if (!docs) return json({ ok: false, error: "Senha incorreta." }, 401)

    const paths = (docs as any[]).map((d) => d.file_path)
    const urlByPath: Record<string, string> = {}
    if (paths.length) {
      const { data: signed } = await admin.storage.from("documentos").createSignedUrls(paths, 3600)
      ;(signed || []).forEach((s: any) => { if (s.signedUrl) urlByPath[s.path] = s.signedUrl })
    }
    const out = (docs as any[]).map(({ file_path, ...rest }) => ({ ...rest, signedUrl: urlByPath[file_path] || null }))
    return json({ ok: true, documents: out })
  } catch (e) {
    console.error("[public-docs] ex:", String((e as Error)?.message || e))
    return json({ ok: false, error: "Erro interno." }, 500)
  }
})
