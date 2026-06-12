import { useEffect, useId, useRef, useState } from 'react'
import { getMercadoPago } from '../lib/mercadopago'
import { maskCpf, isValidCpf } from '../lib/validation'
import Spinner from './Spinner'
import styles from './CardTokenForm.module.css'

// Formulário de cartão (Checkout Transparente / Secure Fields) reutilizável.
// Gera o token no cliente e entrega via onToken({ cardToken, cardLast4, cardBrand }).
export default function CardTokenForm({ submitLabel = 'Confirmar', onToken, busy, setBusy, setError }) {
  const [cardholderName, setCardholderName] = useState('')
  const [cpf, setCpf] = useState('')
  const [ready, setReady] = useState(false)
  const mpRef = useRef(null)
  const uid = useId().replace(/[:]/g, '')
  const ids = { number: `mpnum-${uid}`, exp: `mpexp-${uid}`, cvv: `mpcvv-${uid}` }

  useEffect(() => {
    let cancelled = false
    let created = []
    ;(async () => {
      try {
        const mp = await getMercadoPago()
        if (cancelled) return
        const opts = { style: { fontSize: '16px' } }
        created = [
          mp.fields.create('cardNumber', { ...opts, placeholder: '0000 0000 0000 0000' }).mount(ids.number),
          mp.fields.create('expirationDate', { ...opts, placeholder: 'MM/AA' }).mount(ids.exp),
          mp.fields.create('securityCode', { ...opts, placeholder: 'CVV' }).mount(ids.cvv),
        ]
        mpRef.current = mp
        setReady(true)
      } catch (e) {
        setError?.(e.message || 'Não foi possível carregar o formulário de cartão.')
      }
    })()
    return () => {
      cancelled = true
      created.forEach((f) => { try { f.unmount() } catch { /* noop */ } })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e) {
    e.preventDefault()
    setError?.('')
    if (!isValidCpf(cpf)) { setError?.('Informe um CPF válido.'); return }
    setBusy?.(true)
    try {
      const token = await mpRef.current.fields.createCardToken({
        cardholderName: cardholderName.trim(),
        identificationType: 'CPF',
        identificationNumber: cpf.replace(/\D/g, ''),
      })
      await onToken?.({ cardToken: token.id, cardLast4: token.last_four_digits ?? null, cardBrand: null })
    } catch (err) {
      setError?.(err?.message || 'Falha ao processar o cartão.')
    } finally {
      setBusy?.(false)
    }
  }

  return (
    <form onSubmit={submit} className={styles.form}>
      <div className="field">
        <label>Número do cartão</label>
        <div id={ids.number} className={styles.mpField} />
      </div>
      <div className={styles.row}>
        <div className="field">
          <label>Validade</label>
          <div id={ids.exp} className={styles.mpField} />
        </div>
        <div className="field">
          <label>CVV</label>
          <div id={ids.cvv} className={styles.mpField} />
        </div>
      </div>
      <div className="field">
        <label>Nome impresso no cartão</label>
        <input className="input" value={cardholderName} onChange={(e) => setCardholderName(e.target.value)} required />
      </div>
      <div className="field">
        <label>CPF do titular</label>
        <input className="input" inputMode="numeric" placeholder="000.000.000-00"
          value={maskCpf(cpf)} onChange={(e) => setCpf(e.target.value.replace(/\D/g, ''))} required />
      </div>
      <button id="checkout-assinar-cartao" className="btn btn-primary btn-block" disabled={busy || !ready}>
        {busy ? <Spinner small /> : submitLabel}
      </button>
    </form>
  )
}
