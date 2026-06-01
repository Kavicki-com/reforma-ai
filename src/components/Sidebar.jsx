import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useInstallPrompt } from '../lib/useInstallPrompt'
import { navItems as links } from '../lib/navItems'
import Icon from './Icon'
import CompanyFooter from './CompanyFooter'
import styles from './Sidebar.module.css'

const logo = `${import.meta.env.BASE_URL}pwa-192.png`

// Navegação persistente — visível apenas no desktop (controlado por CSS)
export default function Sidebar() {
  const { profile, signOut } = useAuth()
  const { installed, promptInstall } = useInstallPrompt()

  async function handleInstall() {
    const r = await promptInstall()
    if (r === 'ios') alert('Para instalar: toque em Compartilhar e em "Adicionar à Tela de Início".')
    else if (r === 'unsupported') alert('Para instalar: abra o menu do navegador e escolha "Instalar app".')
  }

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
      </nav>

      <div className={styles.footer}>
        {!installed && (
          <button className={styles.install} onClick={handleInstall}>
            <Icon name="install_mobile" size={22} /> Instalar app
          </button>
        )}
        <button className={styles.signout} onClick={signOut}>
          <Icon name="logout" size={20} /> Sair
        </button>
        <CompanyFooter />
      </div>
    </aside>
  )
}
