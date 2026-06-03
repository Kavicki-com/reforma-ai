import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import Spinner from '../components/Spinner'
import Icon from '../components/Icon'
import CompanyFooter from '../components/CompanyFooter'
import styles from './ConfirmEmail.module.css'

const logo = `${import.meta.env.BASE_URL}pwa-192.png`

// Tela de sucesso aberta após clicar no link de confirmação do e-mail.
// Assim que a sessão é criada, entra no app automaticamente (o onboarding
// segue para a escolha de plano/pagamento).
export default function ContaConfirmada() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading || !session) return
    const t = setTimeout(() => navigate('/', { replace: true }), 2200)
    return () => clearTimeout(t)
  }, [loading, session, navigate])

  return (
    <div className={styles.wrap}>
      <div className={styles.brand}>
        <img className={styles.logo} src={logo} alt="Krovo" />
        <h1>Krovo</h1>
      </div>

      <div className={`card ${styles.card}`}>
        <div className={styles.iconWrap}>
          <Icon name="check_circle" size={40} fill={1} />
        </div>
        <h2 className={styles.title}>Conta confirmada!</h2>

        {session ? (
          <>
            <p className="muted">Tudo certo. Estamos te levando para o app…</p>
            <div className="center"><Spinner small /></div>
            <button className="btn btn-primary btn-block" onClick={() => navigate('/', { replace: true })}>
              Entrar agora
            </button>
          </>
        ) : loading ? (
          <>
            <p className="muted">Ativando sua conta…</p>
            <div className="center"><Spinner /></div>
          </>
        ) : (
          <>
            <p className="muted">Sua conta foi confirmada. Faça login para continuar.</p>
            <Link to="/login" className="btn btn-primary btn-block">Entrar</Link>
          </>
        )}
      </div>
      <CompanyFooter />
    </div>
  )
}
