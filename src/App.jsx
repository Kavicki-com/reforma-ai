import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import BottomNav from './components/BottomNav'
import Sidebar from './components/Sidebar'
import Spinner from './components/Spinner'
import Login from './routes/Login'
import PublicSummary from './routes/PublicSummary'
import Dashboard from './routes/Dashboard'
import Entries from './routes/Entries'
import Stages from './routes/Stages'
import Budget from './routes/Budget'
import Shopping from './routes/Shopping'
import Photos from './routes/Photos'

function Protected({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="spinner-wrap"><Spinner /></div>
  if (!session) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const { session } = useAuth()
  const location = useLocation()
  const showNav = session && location.pathname !== '/login'

  return (
    <div className="app-shell">
      {showNav && <Sidebar />}
      <div className="app-main">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/s/:token" element={<PublicSummary />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/lancamentos" element={<Protected><Entries /></Protected>} />
          <Route path="/etapas" element={<Protected><Stages /></Protected>} />
          <Route path="/orcamento" element={<Protected><Budget /></Protected>} />
          <Route path="/materiais" element={<Protected><Shopping /></Protected>} />
          <Route path="/fotos" element={<Protected><Photos /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {showNav && <BottomNav />}
    </div>
  )
}
