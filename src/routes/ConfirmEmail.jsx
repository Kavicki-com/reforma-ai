import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import Spinner from '../components/Spinner'
import Icon from '../components/Icon'
import CompanyFooter from '../components/CompanyFooter'
import styles from './ConfirmEmail.module.css'

const logo = `${import.meta.env.BASE_URL}pwa-192.png`

export default function ConfirmEmail() {
  const { resendSignup } = useAuth()
  const { state } = useLocation()
  const email = state?.email || ''
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  async function resend() {
    if (!email) return
    setBusy(true)
    setErr('')
    setMsg('')
    const { error } = await resendSignup(email)
    setBusy(false)
    if (error) setErr('Não foi possível reenviar agora. Aguarde alguns minutos e tente novamente.')
    else setMsg('E-mail reenviado! Confira sua caixa de entrada.')
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.brand}>
        <img className={styles.logo} src={logo} alt="Krovo" />
        <h1>Krovo</h1>
      </div>

      <div className={`card ${styles.card}`}>
        <div className={styles.iconWrap}>
          <Icon name="mark_email_unread" size={40} />
        </div>
        <h2 className={styles.title}>Confirme seu e-mail</h2>
        <p className="muted">
          {email ? (
            <>
              Enviamos um link de confirmação para <strong>{email}</strong>. Abra o e-mail e toque
              em <strong>Confirmar e-mail</strong> para ativar sua conta.
            </>
          ) : (
            <>
              Enviamos um link de confirmação para o seu e-mail. Abra a mensagem e toque em{' '}
              <strong>Confirmar e-mail</strong> para ativar sua conta.
            </>
          )}
        </p>

        {msg && <p className={styles.success}>{msg}</p>}
        {err && <p className={styles.error}>{err}</p>}

        {email && (
          <button id="confirmar-email-reenviar" className="btn btn-ghost btn-block" onClick={resend} disabled={busy}>
            {busy ? <Spinner small /> : 'Reenviar e-mail'}
          </button>
        )}
        <Link to="/login" className={styles.back}>
          Voltar para entrar
        </Link>
      </div>

      <p className={styles.hint}>Não recebeu? Verifique a pasta de spam.</p>
      <CompanyFooter />
    </div>
  )
}
