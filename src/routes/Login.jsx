import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import Spinner from '../components/Spinner'
import CompanyFooter from '../components/CompanyFooter'
import styles from './Login.module.css'

const logo = `${import.meta.env.BASE_URL}pwa-192.png`

export default function Login() {
  const { session, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const isSignup = mode === 'signup'

  useEffect(() => {
    if (session) navigate('/', { replace: true })
  }, [session, navigate])

  function switchMode() {
    setMode(isSignup ? 'signin' : 'signup')
    setError('')
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)

    if (isSignup) {
      if (password.length < 6) {
        setBusy(false)
        setError('A senha precisa ter pelo menos 6 caracteres.')
        return
      }
      const { data, error } = await signUp(email.trim(), password, fullName.trim())
      setBusy(false)
      if (error) {
        const tooMany = error.status === 429 || /rate limit|too many/i.test(error.message)
        setError(
          tooMany
            ? 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.'
            : /registered|already/i.test(error.message)
              ? 'Este e-mail já está cadastrado.'
              : 'Não foi possível criar a conta. Tente novamente.',
        )
        return
      }
      // E-mail já existente vem com identities vazio e sem erro.
      if (data?.user && data.user.identities && data.user.identities.length === 0) {
        setError('Este e-mail já está cadastrado.')
        return
      }
      if (data?.session) {
        navigate('/', { replace: true }) // confirmação de e-mail desligada: já entra
        return
      }
      // Confirmação ligada: leva à tela "Confirme seu e-mail"
      navigate('/confirme-email', { state: { email: email.trim() } })
      return
    }

    const { error } = await signIn(email.trim(), password)
    setBusy(false)
    if (error) {
      setError('E-mail ou senha inválidos.')
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.brand}>
        <img className={styles.logo} src={logo} alt="Krovo" />
        <h1>Krovo</h1>
        <p className="muted">Sua obra na mão</p>
      </div>

      <form className={`card ${styles.card}`} onSubmit={onSubmit}>
        {isSignup && (
          <div className="field">
            <label>Nome</label>
            <input
              className="input"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
        )}
        <div className="field">
          <label>E-mail</label>
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label>Senha</label>
          <input
            className="input"
            type="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? <Spinner small /> : isSignup ? 'Criar conta' : 'Entrar'}
        </button>

        <p className={styles.toggle}>
          {isSignup ? 'Já tem conta?' : 'Não tem conta?'}
          <button type="button" className={styles.toggleBtn} onClick={switchMode}>
            {isSignup ? 'Entrar' : 'Criar conta'}
          </button>
        </p>
      </form>
      <CompanyFooter />
    </div>
  )
}
