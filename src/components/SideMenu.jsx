import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { navItems as links } from '../lib/navItems'
import Icon from './Icon'
import styles from './SideMenu.module.css'

export default function SideMenu({ open, onClose }) {
  const { profile, signOut } = useAuth()

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <aside className={styles.panel} onClick={(e) => e.stopPropagation()}>
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
              onClick={onClose}
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
    </div>
  )
}
