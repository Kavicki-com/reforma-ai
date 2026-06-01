import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useInstallPrompt } from '../lib/useInstallPrompt'
import { navItems } from '../lib/navItems'
import Icon from './Icon'
import CompanyFooter from './CompanyFooter'
import styles from './SideMenu.module.css'

const logo = `${import.meta.env.BASE_URL}pwa-192.png`

// No mobile a navegação principal fica na barra inferior; o drawer só traz
// os itens que não cabem lá: Orçamento, Instalar app e Sair.
const menuLinks = navItems.filter((l) => l.to === '/orcamento')

export default function SideMenu({ open, onClose }) {
  const { profile, signOut } = useAuth()
  const { installed, promptInstall } = useInstallPrompt()

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

  async function handleInstall() {
    const r = await promptInstall()
    if (r === 'ios') {
      alert('Para instalar no iPhone/iPad: toque em Compartilhar e em "Adicionar à Tela de Início".')
    } else if (r === 'unsupported') {
      alert('Para instalar: abra o menu do navegador e escolha "Instalar app".')
    }
    onClose()
  }

  if (!open) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <aside className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <div className={styles.brand}>
            <img className={styles.brandLogo} src={logo} alt="" /> Krovo
          </div>
          {profile?.full_name && <span className={styles.user}>{profile.full_name}</span>}
        </div>

        <nav className={styles.nav}>
          {menuLinks.map((l) => (
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
          {!installed && (
            <button type="button" className={styles.link} onClick={handleInstall}>
              <Icon name="install_mobile" size={22} /> Instalar app
            </button>
          )}
        </nav>

        <button className={styles.signout} onClick={signOut}>
          <Icon name="logout" size={20} /> Sair
        </button>
        <CompanyFooter />
      </aside>
    </div>
  )
}
