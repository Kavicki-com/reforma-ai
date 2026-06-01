import styles from './Donut.module.css'

// value = porcentagem (0-100); center = texto no centro
export default function Donut({ value = 0, center, size = 86, stroke = 11 }) {
  const v = Math.max(0, Math.min(100, value))
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (v / 100) * circ
  const c = size / 2

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={styles.donut}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
      <circle
        cx={c} cy={c} r={r}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${c} ${c})`}
        className={styles.value}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className={styles.label}>
        {center}
      </text>
    </svg>
  )
}
