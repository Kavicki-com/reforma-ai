import styles from './PasswordMatch.module.css'

export default function PasswordMatch({ value, confirm }) {
  if (!confirm) return null
  const match = value === confirm
  return (
    <span className={`${styles.label} ${match ? styles.ok : styles.bad}`} aria-live="polite">
      {match ? 'As senhas são iguais' : 'As senhas não conferem'}
    </span>
  )
}
