import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { navItems as links } from '../lib/navItems'
import Icon from './Icon'
import styles from './Sidebar.module.css'

// Navegação persistente — visível apenas no desktop (controlado por CSS)
export default function Sidebar() {
  const { profile, signOut } = useAuth()

  return (
    <aside className={styles.sidebar}>
      <div className={styles.head}>
        <div className={styles.brand}>
          <Icon name="home_repair_service" fill={1} /> Reforma AI
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
      </nav>

      <button className={styles.signout} onClick={signOut}>
        <Icon name="logout" size={20} /> Sair
      </button>
    </aside>
  )
}
