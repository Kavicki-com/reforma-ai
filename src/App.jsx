import { useEffect, useRef, useState } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { useSubscription } from './lib/useSubscription'
import { useProjects } from './lib/ProjectContext'
import Onboarding from './components/Onboarding'
import BottomNav from './components/BottomNav'
import Sidebar from './components/Sidebar'
import Spinner from './components/Spinner'
import Login from './routes/Login'
import ConfirmEmail from './routes/ConfirmEmail'
import PublicSummary from './routes/PublicSummary'
import Dashboard from './routes/Dashboard'
import Entries from './routes/Entries'
import Stages from './routes/Stages'
import Budget from './routes/Budget'
import Shopping from './routes/Shopping'
import Photos from './routes/Photos'
import Subscription from './routes/Subscription'
import Configuracoes from './routes/Configuracoes'
import ContaConfirmada from './routes/ContaConfirmada'
import WelcomeModal from './components/WelcomeModal'

function Protected({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="spinner-wrap"><Spinner /></div>
  if (!session) return <Navigate to="/login" replace />
  return children
}

// Gate de acesso: libera durante o trial (sem cartão) e para assinantes ativos.
// Quando o trial termina sem assinatura, tranca o app e leva ao /assinatura.
function Gate() {
  const { profile, loading } = useAuth()
  const { isActive, loading: subLoading } = useSubscription()
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    if (loading || subLoading) return
    const trialEnd = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null
    const inTrial = trialEnd && trialEnd > new Date()
    const hasAccess = isActive || inTrial
    const allowed = ['/assinatura', '/conta-confirmada', '/configuracoes'].includes(location.pathname)
    if (!hasAccess && !allowed) navigate('/assinatura', { replace: true })
  }, [loading, subLoading, profile, isActive, location.pathname, navigate])
  return null
}

// Rotas com dados de obra — exigem ao menos uma obra cadastrada.
const obraRoutes = ['/', '/lancamentos', '/etapas', '/orcamento', '/materiais', '/fotos']

export default function App() {
  const { session, loading } = useAuth()
  const { needsOnboarding, loading: projectsLoading } = useProjects()
  const location = useLocation()
  const navigate = useNavigate()
  // rotas de transição (sem sessão "dentro do app")
  const authRoutes = ['/login', '/confirme-email', '/conta-confirmada']
  const inApp = session && !authRoutes.includes(location.pathname)
  const showNav = inApp
  // Sem nenhuma obra: cai no onboarding nas telas que dependem de obra.
  // Enquanto as obras carregam, segura num spinner — decide entre Onboarding
  // e conteúdo só com a resposta na mão (sem piscar nenhum dos dois).
  const onObraRoute = obraRoutes.includes(location.pathname)
  const projectsPending = inApp && projectsLoading && onObraRoute
  const showOnboarding = inApp && needsOnboarding && onObraRoute

  // O link de confirmação volta para a raiz com ?confirmed=1 (a sessão é criada
  // a partir do ?code= pelo Supabase). Capturamos o marcador e mandamos para a
  // tela de sucesso. Lê no 1º render, antes do Supabase limpar a URL.
  const [justConfirmed] = useState(
    () => typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('confirmed') === '1',
  )
  // garante que o redirect pós-confirmação aconteça UMA vez só (senão fica preso)
  const confirmedHandled = useRef(false)
  useEffect(() => {
    if (confirmedHandled.current || !justConfirmed || loading) return
    confirmedHandled.current = true
    const u = new URL(window.location.href)
    u.searchParams.delete('confirmed')
    window.history.replaceState({}, '', u.pathname + u.search + u.hash)
    navigate('/conta-confirmada', { replace: true })
  }, [justConfirmed, loading, navigate])

  return (
    <div className="app-shell">
      {showNav && <Sidebar />}
      {session && <Gate />}
      {/* Boas-vindas só com as obras carregadas e fora do onboarding —
          senão ele abre durante o spinner e sobrepõe o Onboarding. */}
      {inApp && !projectsLoading && !needsOnboarding && <WelcomeModal />}
      <div className="app-main">
        {projectsPending ? <div className="spinner-wrap"><Spinner /></div> : showOnboarding ? <Onboarding /> : (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/confirme-email" element={<ConfirmEmail />} />
          <Route path="/conta-confirmada" element={<ContaConfirmada />} />
          <Route path="/s/:token" element={<PublicSummary />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/lancamentos" element={<Protected><Entries /></Protected>} />
          <Route path="/etapas" element={<Protected><Stages /></Protected>} />
          <Route path="/orcamento" element={<Protected><Budget /></Protected>} />
          <Route path="/materiais" element={<Protected><Shopping /></Protected>} />
          <Route path="/fotos" element={<Protected><Photos /></Protected>} />
          <Route path="/assinatura" element={<Protected><Subscription /></Protected>} />
          <Route path="/configuracoes" element={<Protected><Configuracoes /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        )}
      </div>
      {showNav && <BottomNav />}
    </div>
  )
}
