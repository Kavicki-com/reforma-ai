import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from '../auth/AuthProvider'

// Lê a assinatura do usuário atual. Base para gating de recursos pagos.
export function useSubscription() {
  const { user } = useAuth()
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) { setSubscription(null); setLoading(false); return }
    const { data } = await supabase
      .from('subscriptions')
      .select('id, plan_code, status, kind, current_period_end, next_payment_date, auto_renew, card_last4, card_brand, plans(name, amount, billing_period)')
      .eq('owner_id', user.id)
      .maybeSingle()
    setSubscription(data ?? null)
    setLoading(false)
  }, [user])

  useEffect(() => { refresh() }, [refresh])

  const isActive = subscription?.status === 'active' &&
    (!subscription.current_period_end || new Date(subscription.current_period_end) > new Date())

  return { subscription, isActive, loading, refresh }
}
