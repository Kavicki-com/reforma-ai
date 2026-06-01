import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import Spinner from '../components/Spinner'
import Icon from '../components/Icon'
import styles from './Login.module.css'

export default function Login() {
  const { session, signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (session) navigate('/', { replace: true })
  }, [session, navigate])

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
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
        <span className={styles.logo}><Icon name="home_repair_service" size={40} fill={1} /></span>
        <h1>Reforma AI</h1>
        <p className="muted">Gestão da obra do apartamento</p>
      </div>

      <form className={`card ${styles.card}`} onSubmit={onSubmit}>
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? <Spinner small /> : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
