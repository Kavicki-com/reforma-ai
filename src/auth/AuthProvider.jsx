import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

// Marca que a sessão atual é de recuperação de senha. O link do e-mail cria uma
// sessão real e persistida; sem este marcador, fechar/reabrir o app ou ir em
// "Entrar" usaria essa sessão como login normal — sem ter trocado a senha.
// Persistimos em localStorage porque o evento do Supabase só dispara uma vez
// (e o app detecta a recuperação pelo marcador ?recovery=1, não pelo evento).
const RECOVERY_KEY = 'krovo:pwd-recovery'
// Lê o estado de recuperação de forma SÍNCRONA já no 1º render. Se a URL traz
// ?recovery=1 (link do e-mail), persiste na hora — assim o guard redireciona
// antes de qualquer render do Dashboard (sem o "flash"), e reabrir/outra aba
// continua travado pelo localStorage.
const readRecovery = () => {
  try {
    if (new URLSearchParams(window.location.search).get('recovery') === '1') {
      localStorage.setItem(RECOVERY_KEY, '1')
      return true
    }
    return localStorage.getItem(RECOVERY_KEY) === '1'
  } catch { return false }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(readRecovery)

  const beginRecovery = () => {
    try { localStorage.setItem(RECOVERY_KEY, '1') } catch { /* ignore */ }
    setRecovery(true)
  }
  const endRecovery = () => {
    try { localStorage.removeItem(RECOVERY_KEY) } catch { /* ignore */ }
    setRecovery(false)
  }
  // Guarda para qual usuario o profile ja foi carregado — evita recarregar
  // (e desmontar telas/formularios) quando a aba reganha foco e o Supabase
  // dispara TOKEN_REFRESHED / SIGNED_IN com o mesmo usuario.
  const loadedFor = useRef(null)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      if (!data.session) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (!s) {
        setProfile(null)
        loadedFor.current = null
        setLoading(false)
      }
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const userId = session?.user?.id

  // Carrega o profile (papel) apenas quando o usuario muda de fato.
  useEffect(() => {
    if (!userId) return
    if (loadedFor.current === userId) return
    let active = true
    supabase
      .from('profiles')
      .select('id, full_name, role, trial_ends_at')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (!active) return
        setProfile(data)
        loadedFor.current = userId
        setLoading(false)
      })
    return () => { active = false }
  }, [userId])

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    isAdmin: profile?.role === 'admin',
    loading,
    // Sessão de recuperação ativa: o app deve travar tudo na tela de redefinição
    // até a senha ser trocada (ou o usuário cancelar/sair).
    recovery,
    beginRecovery,
    endRecovery,
    signIn: async (email, password) => {
      const res = await supabase.auth.signInWithPassword({ email, password })
      // Login normal bem-sucedido encerra qualquer estado de recuperação pendente.
      if (!res.error) endRecovery()
      return res
    },
    signUp: (email, password, fullName, meta = {}) =>
      supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, ...meta },
          // Confirmação de e-mail: o link volta para onde o app está servido
          // (produção, subdomínio ou localhost). A URL precisa estar na lista
          // de Redirect URLs do Supabase (Authentication → URL Configuration).
          emailRedirectTo: `${window.location.origin}/?confirmed=1`,
        },
      }),
    resendSignup: (email) =>
      supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: window.location.origin },
      }),
    // Recuperação de senha: o link volta para a raiz com ?recovery=1. Como o
    // signup, o PKCE cria a sessão a partir do ?code= e o App captura o marcador
    // para levar à tela de redefinição. A URL precisa estar nas Redirect URLs.
    resetPassword: (email) =>
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/?recovery=1`,
      }),
    // Define a nova senha (exige a sessão de recuperação já ativa).
    updatePassword: async (password) => {
      const res = await supabase.auth.updateUser({ password })
      if (!res.error) endRecovery()
      return res
    },
    signOut: () => {
      // Cancelar/sair durante a recuperação também limpa o marcador.
      endRecovery()
      return supabase.auth.signOut()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return ctx
}
