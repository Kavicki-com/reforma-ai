import styles from './PasswordMatch.module.css'

// Descrição do campo "confirmar senha": diz se as duas senhas conferem.
// Não renderiza nada enquanto a confirmação estiver vazia.
export default function PasswordMatch({ value, confirm }) {
  if (!confirm) return null
  const match = value === confirm
  return (
    <span className={`${styles.label} ${match ? styles.ok : styles.bad}`} aria-live="polite">
      {match ? 'As senhas são iguais' : 'As senhas não conferem'}
    </span>
  )
}
