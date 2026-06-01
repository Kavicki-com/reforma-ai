// Formatacao pt-BR / BRL

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function money(value) {
  return brl.format(Number(value || 0))
}

export function dateBR(value) {
  if (!value) return '—'
  // value pode ser 'YYYY-MM-DD' (date) — evita shift de fuso tratando como local
  const [y, m, d] = String(value).slice(0, 10).split('-')
  if (!y || !m || !d) return '—'
  return `${d}/${m}/${y}`
}

// Converte input date (YYYY-MM-DD) ou null
export function toDateInput(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

export function durationDays(start, end) {
  if (!start) return null
  const a = new Date(start)
  const b = end ? new Date(end) : new Date()
  const diff = Math.round((b - a) / (1000 * 60 * 60 * 24))
  return diff >= 0 ? diff : 0
}

export function pct(part, total) {
  if (!total || total <= 0) return 0
  return Math.min(100, Math.round((Number(part) / Number(total)) * 100))
}
