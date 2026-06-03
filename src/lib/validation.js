// Validações e máscaras de formulário (e-mail, CPF, força de senha).

// ---- E-mail ----
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(value) {
  return EMAIL_RE.test(String(value || '').trim())
}

// ---- CPF ----
// Máscara progressiva: 000.000.000-00
export function maskCpf(value) {
  const d = String(value || '').replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

// Valida CPF pelos dois dígitos verificadores (módulo 11).
export function isValidCpf(value) {
  const cpf = String(value || '').replace(/\D/g, '')
  if (cpf.length !== 11) return false
  // Rejeita sequências repetidas (000..., 111..., etc.), que passam no cálculo.
  if (/^(\d)\1{10}$/.test(cpf)) return false

  const digit = (sliceLen) => {
    let sum = 0
    for (let i = 0; i < sliceLen; i++) {
      sum += Number(cpf[i]) * (sliceLen + 1 - i)
    }
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }

  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10])
}

// ---- Força de senha ----
// Retorna { score: 0..4, label, key } — score 0 = vazia.
// key serve pra estilizar (weak | fair | good | strong).
const STRENGTH = [
  { key: 'weak', label: 'Fraca' },
  { key: 'weak', label: 'Fraca' },
  { key: 'fair', label: 'Média' },
  { key: 'good', label: 'Boa' },
  { key: 'strong', label: 'Forte' },
]

export function passwordStrength(value) {
  const pw = String(value || '')
  if (!pw) return { score: 0, label: '', key: '' }

  let points = 0
  if (pw.length >= 8) points++
  if (pw.length >= 12) points++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) points++
  if (/\d/.test(pw)) points++
  if (/[^A-Za-z0-9]/.test(pw)) points++

  // Senhas muito curtas nunca passam de "Fraca".
  let score = Math.min(points, 4)
  if (pw.length < 6) score = 1
  else if (score < 1) score = 1

  return { score, ...STRENGTH[score] }
}
