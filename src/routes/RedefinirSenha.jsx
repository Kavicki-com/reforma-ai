import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import PasswordInput from '../components/PasswordInput'
import PasswordStrength from '../components/PasswordStrength'
import PasswordMatch from '../components/PasswordMatch'
import Spinner from '../components/Spinner'
import Icon from '../components/Icon'
import CompanyFooter from '../components/CompanyFooter'
import styles from './ConfirmEmail.module.css'

const logo = `${import.meta.env.BASE_URL}pwa-192.png`

// Tela de redefinição de senha, aberta ao clicar no link do e-mail.
// O link chega com ?recovery=1 e o PKCE já criou a sessão de recuperação; aqui
// o usuário define a nova senha. Sem sessão (link expirado/inválido), orienta a
// pedir um novo link.
export default function RedefinirSenha() {
  const { session, loading, updatePassword, signOut } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setErr('')
    if (password.length < 6) { setErr('A senha precisa ter pelo menos 6 caracteres.'); return }
    if (password !== password2) { setErr('As senhas não conferem.'); return }
    setBusy(true)
    const { error } = await updatePassword(password)
    setBusy(false)
    if (error) {
      const expired = /expired|invalid|session/i.test(error.message)
      setErr(
        expired
          ? 'O link expirou. Peça um novo link de recuperação.'
          : 'Não foi possível alterar a senha. Tente novamente.',
      )
      return
    }
    // Encerra a sessão de recuperação: o usuário entra de novo com a senha nova.
    await signOut()
    setDone(true)
    setTimeout(() => navigate('/login', { replace: true }), 1800)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.brand}>
        <img className={styles.logo} src={logo} alt="Krovo" />
        <h1>Krovo</h1>
      </div>

      <div className={`card ${styles.card}`}>
        {loading ? (
          <>
            <p className="muted">Validando o link…</p>
            <div className="center"><Spinner /></div>
          </>
        ) : done ? (
          <>
            <div className={styles.iconWrap}><Icon name="check_circle" size={40} fill={1} /></div>
            <h2 className={styles.title}>Senha alterada!</h2>
            <p className="muted">Agora é só entrar com a sua nova senha…</p>
            <div className="center"><Spinner small /></div>
          </>
        ) : !session ? (
          <>
            <div className={styles.iconWrap}><Icon name="link_off" size={40} /></div>
            <h2 className={styles.title}>Link inválido ou expirado</h2>
            <p className="muted">
              Este link de recuperação não é mais válido. Peça um novo para redefinir sua senha.
            </p>
            <Link to="/recuperar-senha" className="btn btn-primary btn-block">Pedir novo link</Link>
          </>
        ) : (
          <form onSubmit={onSubmit} style={{ width: '100%' }}>
            <div className={styles.iconWrap}><Icon name="lock_reset" size={40} /></div>
            <h2 className={styles.title}>Criar nova senha</h2>
            <p className="muted">Escolha uma nova senha para sua conta.</p>
            <div className="field" style={{ textAlign: 'left', marginTop: 'var(--sp-3)' }}>
              <label>Nova senha</label>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
              <PasswordStrength value={password} />
            </div>
            <div className="field" style={{ textAlign: 'left' }}>
              <label>Confirmar senha</label>
              <PasswordInput value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" required />
              <PasswordMatch value={password} confirm={password2} />
            </div>
            {err && <p className={styles.error}>{err}</p>}
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? <Spinner small /> : 'Salvar nova senha'}
            </button>
          </form>
        )}
      </div>
      <CompanyFooter />
    </div>
  )
}
