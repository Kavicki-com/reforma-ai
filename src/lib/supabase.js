import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.error('Variaveis VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ausentes. Confira o .env')
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // PKCE: a confirmação volta com ?code= na query (não no hash), evitando
    // conflito com o HashRouter — que usa o hash para roteamento.
    flowType: 'pkce',
    detectSessionInUrl: true,
  },
})
