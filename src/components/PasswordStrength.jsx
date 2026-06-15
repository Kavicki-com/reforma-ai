import { passwordStrength } from '../lib/validation'
import styles from './PasswordStrength.module.css'

export default function PasswordStrength({ value }) {
  const { score, label, key } = passwordStrength(value)
  if (!score) return null

  return (
    <div className={styles.wrap} aria-live="polite">
      <div className={styles.bars}>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`${styles.bar} ${i <= score ? styles[key] : ''}`}
          />
        ))}
      </div>
      <span className={`${styles.label} ${styles[key]}`}>{label}</span>
    </div>
  )
}
