import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useSubscription } from '../lib/useSubscription'
import Icon from './Icon'
import styles from './WelcomeModal.module.css'

// Modal exibido na primeira interação do usuário. Não obriga a assinar:
// o trial é livre. Oferece um atalho "Assinar agora" pra tela de assinatura.
export default function WelcomeModal() {
  const { user, loading } = useAuth()
  const { isActive, loading: subLoading } = useSubscription()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (loading || subLoading || !user) return
    if (isActive) return // já assinante: não mostra
    const key = `krovo_welcome_seen_${user.id}`
    if (localStorage.getItem(key)) return
    setOpen(true)
  }, [loading, subLoading, user, isActive])

  function markSeen() {
    if (user) localStorage.setItem(`krovo_welcome_seen_${user.id}`, '1')
  }
  function dismiss() { markSeen(); setOpen(false) }
  function subscribe() { markSeen(); setOpen(false); navigate('/assinatura') }

  if (!open) return null

  const firstName = (user?.user_metadata?.full_name || '').split(' ')[0]

  return (
    <div className={styles.overlay} onClick={dismiss}>
      <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className={styles.close} onClick={dismiss} aria-label="fechar"><Icon name="close" /></button>

        <div className={styles.iconWrap}><Icon name="waving_hand" size={36} fill={1} /></div>
        <h2 className={styles.title}>
          {firstName ? `Bem-vindo, ${firstName}!` : 'Bem-vindo ao Krovo!'}
        </h2>
        <p className={styles.text}>
          Sua obra na palma da mão. Você tem <strong>7 dias grátis</strong> pra explorar tudo —
          sem precisar de cartão. Quando quiser, assine pra continuar com tudo liberado.
        </p>

        <button id="welcome-assinar-agora" className="btn btn-primary btn-block" onClick={subscribe}>Assinar agora</button>
        <button id="welcome-explorar-primeiro" className="btn btn-block" onClick={dismiss}>Explorar primeiro</button>
      </div>
    </div>
  )
}
