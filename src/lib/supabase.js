import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Ajuda a diagnosticar .env ausente em vez de falhar silenciosamente
  console.error('Variaveis VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ausentes. Confira o .env')
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
