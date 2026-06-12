import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { navItems as links } from '../lib/navItems'
import Icon from './Icon'
import InstallButton from './InstallButton'
import CompanyFooter from './CompanyFooter'
import ProjectSwitcher from './ProjectSwitcher'
import styles from './Sidebar.module.css'

const logo = `${import.meta.env.BASE_URL}pwa-192.png`

// Navegação persistente — visível apenas no desktop (controlado por CSS)
export default function Sidebar() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.head}>
        <div className={styles.brand}>
          <img className={styles.brandLogo} src={logo} alt="" /> Krovo
        </div>
        {profile?.full_name && <span className={styles.user}>{profile.full_name}</span>}
      </div>

      <div className={styles.switcher}>
        <ProjectSwitcher />
      </div>

      <nav className={styles.nav}>
        {links.map((l) => (
          <NavLink
            key={l.to}
            id={`sidebar-${l.to === '/' ? 'inicio' : l.to.slice(1)}`}
            to={l.to}
            end={l.end}
            className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
          >
            <Icon name={l.icon} size={22} /> {l.label}
          </NavLink>
        ))}
        <NavLink
          to="/assinatura"
          id="sidebar-assinatura"
          className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
        >
          <Icon name="credit_card" size={22} /> Assinatura
        </NavLink>
        <NavLink
          to="/configuracoes"
          id="sidebar-configuracoes"
          className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
        >
          <Icon name="settings" size={22} /> Configurações
        </NavLink>
      </nav>

      <div className={styles.footer}>
        <InstallButton id="sidebar-instalar-app" className={styles.install} />
        <button id="sidebar-sair" className={styles.signout} onClick={handleSignOut}>
          <Icon name="logout" size={20} /> Sair
        </button>
        <CompanyFooter />
      </div>
    </aside>
  )
}
