import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { adminClient, corsHeaders, getUser, json } from "../_shared/mp.ts"

// Exclui a conta do usuário autenticado. As FKs para auth.users são ON DELETE
// CASCADE, então profile, obras e assinaturas são removidos junto.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const admin = adminClient()
    const user = await getUser(req, admin)
    if (!user) return json({ ok: false, error: "Não autenticado." }, 401)

    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) {
      console.error("[delete-account] erro", JSON.stringify(error))
      return json({ ok: false, error: "Não foi possível excluir a conta." }, 500)
    }
    return json({ ok: true })
  } catch (e) {
    console.error("[delete-account] exceção", String((e as Error)?.message || e))
    return json({ ok: false, error: String((e as Error)?.message || e) }, 500)
  }
})
