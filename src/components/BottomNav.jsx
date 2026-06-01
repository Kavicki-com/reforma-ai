import { NavLink } from 'react-router-dom'
import Icon from './Icon'
import styles from './BottomNav.module.css'

const items = [
  { to: '/', label: 'Início', icon: 'home', end: true },
  { to: '/lancamentos', label: 'Custos', icon: 'receipt_long' },
  { to: '/materiais', label: 'Materiais', icon: 'shopping_cart' },
  { to: '/etapas', label: 'Etapas', icon: 'calendar_month' },
  { to: '/fotos', label: 'Fotos', icon: 'photo_camera' },
]

export default function BottomNav() {
  return (
    <nav className={styles.nav}>
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ''}`}
        >
          {({ isActive }) => (
            <>
              <Icon name={it.icon} size={24} fill={isActive ? 1 : 0} />
              <span className={styles.label}>{it.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
