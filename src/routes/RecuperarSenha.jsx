import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { isValidEmail } from '../lib/validation'
import Spinner from '../components/Spinner'
import Icon from '../components/Icon'
import CompanyFooter from '../components/CompanyFooter'
import styles from './ConfirmEmail.module.css'

const logo = `${import.meta.env.BASE_URL}pwa-192.png`

// Tela de "esqueci minha senha": pede o e-mail e dispara o link de redefinição.
// Por segurança, a confirmação é genérica (não revela se o e-mail existe).
export default function RecuperarSenha() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setErr('')
    if (!isValidEmail(email)) { setErr('Informe um e-mail válido.'); return }
    setBusy(true)
    const { error } = await resetPassword(email.trim())
    setBusy(false)
    if (error) {
      const tooMany = error.status === 429 || /rate limit|too many/i.test(error.message)
      setErr(
        tooMany
          ? 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.'
          : 'Não foi possível enviar o e-mail agora. Tente novamente.',
      )
      return
    }
    setSent(true)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.brand}>
        <img className={styles.logo} src={logo} alt="Krovo" />
        <h1>Krovo</h1>
      </div>

      <div className={`card ${styles.card}`}>
        <div className={styles.iconWrap}>
          <Icon name={sent ? 'mark_email_read' : 'lock_reset'} size={40} />
        </div>

        {sent ? (
          <>
            <h2 className={styles.title}>Verifique seu e-mail</h2>
            <p className="muted">
              Se houver uma conta para <strong>{email.trim()}</strong>, enviamos um link para
              redefinir a senha. Abra a mensagem e toque em <strong>Redefinir senha</strong>.
            </p>
            <Link to="/login" className={styles.back}>Voltar para entrar</Link>
          </>
        ) : (
          <form onSubmit={onSubmit} style={{ width: '100%' }}>
            <h2 className={styles.title}>Recuperar senha</h2>
            <p className="muted">
              Informe o e-mail da sua conta e enviaremos um link para você criar uma nova senha.
            </p>
            <div className="field" style={{ textAlign: 'left', marginTop: 'var(--sp-3)' }}>
              <label>E-mail</label>
              <input className="input" type="email" autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {err && <p className={styles.error}>{err}</p>}
            <button id="recuperar-senha-enviar" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? <Spinner small /> : 'Enviar link'}
            </button>
            <Link to="/login" className={styles.back}>Voltar para entrar</Link>
          </form>
        )}
      </div>

      <p className={styles.hint}>Não recebeu? Verifique a pasta de spam.</p>
      <CompanyFooter />
    </div>
  )
}
