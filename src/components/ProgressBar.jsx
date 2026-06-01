import styles from './ProgressBar.module.css'

// tone: 'ok' (dentro do orcamento) ou 'over' (estourou)
export default function ProgressBar({ value, tone = 'ok' }) {
  const v = Math.max(0, Math.min(100, value || 0))
  return (
    <div className={styles.track}>
      <div
        className={`${styles.fill} ${tone === 'over' ? styles.over : ''}`}
        style={{ width: `${v}%` }}
      />
    </div>
  )
}
