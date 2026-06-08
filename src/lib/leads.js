import { supabase } from './supabase'

// Captura o lead do 1º passo do cadastro (nome + e-mail), antes de concluir,
// para comunicação futura com quem começou e não terminou. Best-effort: nunca
// bloqueia nem quebra o fluxo do cadastro se falhar. Não grava senha.
export async function captureLead(fullName, email) {
  const cleanEmail = String(email || '').trim().toLowerCase()
  if (!cleanEmail) return
  try {
    // Insert simples (sem ON CONFLICT): o público só tem policy de INSERT no RLS,
    // e um ON CONFLICT exigiria também policy de SELECT (pra ler a linha em
    // conflito). O unique em `email` rejeita duplicados com erro 23505 — que
    // ignoramos de propósito, mantendo a 1ª captura. Best-effort: o erro
    // retornado (duplicado, rede) não interrompe o cadastro.
    await supabase
      .from('leads')
      .insert({ full_name: String(fullName || '').trim() || null, email: cleanEmail })
  } catch {
    /* captura de lead é best-effort — silencioso de propósito */
  }
}
