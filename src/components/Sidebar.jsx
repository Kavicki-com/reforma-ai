import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { navItems as links } from '../lib/navItems'
import Icon from './Icon'
import InstallButton from './InstallButton'
import CompanyFooter from './CompanyFooter'
import styles from './Sidebar.module.css'

const logo = `${import.meta.env.BASE_URL}pwa-192.png`

// Navegação persistente — visível apenas no desktop (controlado por CSS)
export default function Sidebar() {
  const { profile, signOut } = useAuth()

  return (
    <aside className={styles.sidebar}>
      <div className={styles.head}>
        <div className={styles.brand}>
          <img className={styles.brandLogo} src={logo} alt="" /> Krovo
        </div>
        {profile?.full_name && <span className={styles.user}>{profile.full_name}</span>}
      </div>

      <nav className={styles.nav}>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
          >
            <Icon name={l.icon} size={22} /> {l.label}
          </NavLink>
        ))}
        <NavLink
          to="/assinatura"
          className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
        >
          <Icon name="credit_card" size={22} /> Assinatura
        </NavLink>
        <NavLink
          to="/configuracoes"
          className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
        >
          <Icon name="settings" size={22} /> Configurações
        </NavLink>
      </nav>

      <div className={styles.footer}>
        <InstallButton className={styles.install} />
        <button className={styles.signout} onClick={signOut}>
          <Icon name="logout" size={20} /> Sair
        </button>
        <CompanyFooter />
      </div>
    </aside>
  )
}
