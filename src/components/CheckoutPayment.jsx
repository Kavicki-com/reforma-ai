import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import Spinner from './Spinner'
import Icon from './Icon'
import CardTokenForm from './CardTokenForm'
import styles from './CheckoutPayment.module.css'

// supabase.functions.invoke devolve erro genérico em respostas não-2xx;
// o corpo (com a mensagem do MP) fica em error.context. Extraímos pra exibir.
async function extractError(error, fallback) {
  try {
    const body = await error.context.json()
    console.error('[checkout] detalhe do erro:', body)
    let msg = body?.error || fallback
    if (body?.debug) msg += ` — [env: ${body.debug.mpEnv} · app: ${body.debug.tokenApp}]`
    return msg
  } catch {
    return error?.message || fallback
  }
}

// Métodos: cartão (recorrente) sempre; PIX/boleto (avulso) só no plano anual.
function methodsFor(planCode) {
  const base = [{ id: 'credit_card', label: 'Cartão de crédito', icon: 'credit_card' }]
  if (planCode === 'anual') {
    base.push({ id: 'pix', label: 'PIX', icon: 'qr_code_2' })
    base.push({ id: 'bolbradesco', label: 'Boleto', icon: 'barcode' })
  }
  return base
}

export default function CheckoutPayment({ planCode, onSuccess }) {
  const { user } = useAuth()
  const [method, setMethod] = useState('credit_card')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pix, setPix] = useState(null)
  const [boleto, setBoleto] = useState(null)

  // Garante método válido quando o plano muda (anual -> mensal some PIX/boleto).
  useEffect(() => {
    const ids = methodsFor(planCode).map((m) => m.id)
    if (!ids.includes(method)) setMethod('credit_card')
    setPix(null); setBoleto(null); setError('')
  }, [planCode]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.wrap}>
      <div className={styles.methods}>
        {methodsFor(planCode).map((m) => (
          <button
            type="button"
            key={m.id}
            className={`${styles.method} ${method === m.id ? styles.active : ''}`}
            onClick={() => { setMethod(m.id); setError('') }}
          >
            <Icon name={m.icon} size={20} /> {m.label}
          </button>
        ))}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {method === 'credit_card' ? (
        <CardForm
          planCode={planCode}
          email={user?.email}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          onSuccess={onSuccess}
        />
      ) : (
        <PixBoletoForm
          method={method}
          email={user?.email}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          pix={pix}
          setPix={setPix}
          boleto={boleto}
          setBoleto={setBoleto}
          onSuccess={onSuccess}
        />
      )}
    </div>
  )
}

// ---- Cartão de crédito (assinatura recorrente) ----
function CardForm({ planCode, email, busy, setBusy, setError, onSuccess }) {
  async function handleToken({ cardToken, cardLast4, cardBrand }) {
    const { data, error } = await supabase.functions.invoke('mp-subscribe-card', {
      body: { planCode, cardToken, payerEmail: email, cardLast4, cardBrand },
    })
    if (error) throw new Error(await extractError(error, 'Não foi possível concluir a assinatura.'))
    if (!data?.ok) throw new Error(data?.error || 'Não foi possível concluir a assinatura.')
    onSuccess?.({ method: 'credit_card', status: data.status })
  }
  return <CardTokenForm submitLabel="Assinar" onToken={handleToken} busy={busy} setBusy={setBusy} setError={setError} />
}

// ---- PIX / Boleto (pagamento avulso do plano anual) ----
function PixBoletoForm({ method, email, busy, setBusy, setError, pix, setPix, boleto, setBoleto, onSuccess }) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [cpf, setCpf] = useState('')
  const [copied, setCopied] = useState(false)

  // Após gerar o pagamento, faz polling da assinatura até confirmar.
  useEffect(() => {
    if (!pix && !boleto) return
    let active = true
    const t = setInterval(async () => {
      const { data } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('owner_id', user.id)
        .maybeSingle()
      if (active && data?.status === 'active') {
        clearInterval(t)
        onSuccess?.({ method, status: 'active' })
      }
    }, 4000)
    return () => { active = false; clearInterval(t) }
  }, [pix, boleto]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const [first, ...rest] = name.trim().split(' ')
      const { data, error } = await supabase.functions.invoke('mp-pay-once', {
        body: {
          method,
          planCode: 'anual',
          payer: {
            email,
            first_name: first,
            last_name: rest.join(' ') || first,
            identification: { type: 'CPF', number: cpf.replace(/\D/g, '') },
          },
        },
      })
      if (error) throw new Error(await extractError(error, 'Não foi possível gerar o pagamento.'))
      if (!data?.ok) throw new Error(data?.error || 'Não foi possível gerar o pagamento.')
      if (data.pix) setPix(data.pix)
      if (data.boleto) setBoleto(data.boleto)
    } catch (err) {
      setError(err.message || 'Falha ao gerar o pagamento.')
    } finally {
      setBusy(false)
    }
  }

  if (pix) {
    return (
      <div className={styles.result}>
        {pix.qrCodeBase64 && <img className={styles.qr} src={`data:image/png;base64,${pix.qrCodeBase64}`} alt="QR Code PIX" />}
        <p className="muted">Escaneie o QR Code ou copie o código abaixo. A confirmação é automática.</p>
        <button
          type="button"
          className="btn btn-block"
          onClick={() => { navigator.clipboard?.writeText(pix.qrCode); setCopied(true) }}
        >
          <Icon name="content_copy" size={18} /> {copied ? 'Código copiado!' : 'Copiar código PIX'}
        </button>
        <div className={styles.waiting}><Spinner small /> Aguardando pagamento…</div>
      </div>
    )
  }

  if (boleto) {
    return (
      <div className={styles.result}>
        <p className="muted">Boleto gerado. A confirmação pode levar até 1 dia útil.</p>
        {boleto.url && (
          <a className="btn btn-primary btn-block" href={boleto.url} target="_blank" rel="noreferrer">
            <Icon name="open_in_new" size={18} /> Abrir boleto
          </a>
        )}
        {boleto.barcode && <code className={styles.barcode}>{boleto.barcode}</code>}
        <div className={styles.waiting}><Spinner small /> Aguardando compensação…</div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className={styles.form}>
      <div className="field">
        <label>Nome completo</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="field">
        <label>CPF</label>
        <input className="input" inputMode="numeric" value={cpf} onChange={(e) => setCpf(e.target.value)} required />
      </div>
      <button className="btn btn-primary btn-block" disabled={busy}>
        {busy ? <Spinner small /> : method === 'pix' ? 'Gerar PIX' : 'Gerar boleto'}
      </button>
    </form>
  )
}
