import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { useSubscription } from '../lib/useSubscription'
import { money, dateBR } from '../lib/format'
import PlanPicker from '../components/PlanPicker'
import CheckoutPayment from '../components/CheckoutPayment'
import CardTokenForm from '../components/CardTokenForm'
import BottomSheet from '../components/BottomSheet'
import Toast from '../components/Toast'
import Spinner from '../components/Spinner'
import Icon from '../components/Icon'
import styles from './Subscription.module.css'

const STATUS_LABEL = {
  active: 'Ativa', authorized: 'Ativa', pending: 'Pendente',
  paused: 'Pausada', cancelled: 'Cancelada', expired: 'Expirada',
}
const PAY_STATUS = {
  approved: { t: 'Pago', c: 'badge-paid' },
  processed: { t: 'Pago', c: 'badge-paid' },
  pending: { t: 'Pendente', c: 'badge-pending' },
  in_process: { t: 'Em análise', c: 'badge-pending' },
  rejected: { t: 'Recusado', c: 'badge-muted' },
  cancelled: { t: 'Cancelado', c: 'badge-muted' },
}
const METHOD_LABEL = { credit_card: 'Cartão', pix: 'PIX', bolbradesco: 'Boleto' }

export default function Subscription() {
  const { user, profile } = useAuth()
  const { subscription, isActive, loading, refresh } = useSubscription()
  const [planCode, setPlanCode] = useState(user?.user_metadata?.selected_plan ?? null)
  const [toast, setToast] = useState('')

  if (loading) return <div className="spinner-wrap"><Spinner /></div>

  if (isActive) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>Sua assinatura</h1>
        <ActiveSubscription subscription={subscription} refresh={refresh} setToast={setToast} />
        <Toast message={toast} onDone={() => setToast('')} />
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Escolha seu plano</h1>
      <p className="muted">Assine para liberar todos os recursos do Krovo.</p>

      <TrialBanner trialEndsAt={profile?.trial_ends_at} />

      {subscription?.status === 'pending' && (
        <div className={styles.notice}><Spinner small /> Pagamento pendente de confirmação.</div>
      )}

      <PlanPicker value={planCode} onChange={setPlanCode} />

      <div className={`card ${styles.payCard}`}>
        <h2 className={styles.subtitle}>Pagamento</h2>
        <CheckoutPayment
          planCode={planCode}
          onSuccess={({ status }) => {
            refresh()
            setToast(status === 'active' ? 'Assinatura confirmada!' : 'Pagamento recebido!')
          }}
        />
      </div>

      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  )
}

// ---- Assinatura ativa: detalhes + gerenciamento + histórico ----
function ActiveSubscription({ subscription, refresh, setToast }) {
  const { user } = useAuth()
  const [sheet, setSheet] = useState(null) // 'card' | 'cancel' | null
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const plan = subscription.plans
  const recurring = subscription.kind === 'recurring_card'
  const periodLabel = plan?.billing_period === 'yearly' ? '/ano' : '/mês'
  const nextDate = subscription.next_payment_date || subscription.current_period_end

  async function manage(body, okMsg) {
    setBusy(true); setError('')
    try {
      const { data, error: err } = await supabase.functions.invoke('mp-manage-subscription', { body })
      if (err || !data?.ok) {
        let msg = data?.error || 'Não foi possível concluir.'
        try { const b = await err?.context?.json(); msg = b?.error || msg } catch { /* noop */ }
        throw new Error(msg)
      }
      setSheet(null)
      refresh()
      setToast(okMsg)
    } catch (e) {
      setError(e.message || 'Erro ao processar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className={`card ${styles.statusCard}`}>
        <div className={styles.statusHead}>
          <div className={styles.planRow}>
            <Icon name="verified" size={26} className={styles.ok} />
            <div>
              <p className={styles.planName}>{plan?.name || (subscription.plan_code === 'anual' ? 'Plano Anual' : 'Plano Mensal')}</p>
              {plan?.amount != null && (
                <p className={styles.priceLine}>{money(plan.amount)}<small>{periodLabel}</small></p>
              )}
            </div>
          </div>
          <span className="badge badge-paid">{STATUS_LABEL[subscription.status] || 'Ativa'}</span>
        </div>

        <div className={styles.detailRow}>
          <Icon name="event" size={20} className={styles.detIcon} />
          <span>
            {recurring
              ? (nextDate ? <>Próxima cobrança em <strong>{dateBR(nextDate)}</strong></> : 'Renovação automática')
              : (nextDate ? <>Válida até <strong>{dateBR(nextDate)}</strong> (sem renovação)</> : 'Pagamento avulso')}
          </span>
        </div>

        {recurring && (
          <div className={styles.detailRow}>
            <Icon name="credit_card" size={20} className={styles.detIcon} />
            <span>{subscription.card_last4 ? `Cartão •••• ${subscription.card_last4}` : 'Cartão cadastrado'}</span>
            <button id="assinatura-alterar-cartao" className={styles.linkBtn} onClick={() => { setError(''); setSheet('card') }}>Alterar</button>
          </div>
        )}

        {recurring && (
          <button id="assinatura-cancelar" className={`btn btn-danger btn-block ${styles.cancelBtn}`} onClick={() => { setError(''); setSheet('cancel') }}>
            Cancelar assinatura
          </button>
        )}
      </div>

      <PaymentsHistory ownerId={user.id} />

      {/* Trocar cartão */}
      <BottomSheet open={sheet === 'card'} title="Alterar cartão" onClose={() => !busy && setSheet(null)}>
        {error && <p className={styles.error}>{error}</p>}
        <CardTokenForm
          submitLabel="Salvar cartão"
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          onToken={({ cardToken, cardLast4, cardBrand }) =>
            manage({ action: 'update_card', cardToken, cardLast4, cardBrand }, 'Cartão atualizado!')}
        />
      </BottomSheet>

      {/* Cancelar */}
      <BottomSheet open={sheet === 'cancel'} title="Cancelar assinatura" onClose={() => !busy && setSheet(null)}>
        {error && <p className={styles.error}>{error}</p>}
        <p className="muted" style={{ marginBottom: 'var(--sp-4)' }}>
          Tem certeza? Você perde o acesso aos recursos pagos ao fim do período já pago.
        </p>
        <button id="assinatura-cancelar-confirmar" className="btn btn-danger btn-block" disabled={busy} onClick={() => manage({ action: 'cancel' }, 'Assinatura cancelada.')}>
          {busy ? <Spinner small /> : 'Sim, cancelar'}
        </button>
        <button id="assinatura-cancelar-voltar" className="btn btn-block" disabled={busy} style={{ marginTop: 'var(--sp-2)' }} onClick={() => setSheet(null)}>
          Voltar
        </button>
      </BottomSheet>
    </>
  )
}

// ---- Histórico de pagamentos (invoices) ----
function PaymentsHistory({ ownerId }) {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    let active = true
    supabase
      .from('subscription_payments')
      .select('id, created_at, amount, status, method')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (active) setRows(data ?? []) })
    return () => { active = false }
  }, [ownerId])

  if (rows === null) return null

  return (
    <div className={styles.history}>
      <h2 className={styles.subtitle}>Pagamentos</h2>
      {rows.length === 0 ? (
        <p className="muted">Nenhum pagamento ainda. A primeira cobrança aparece aqui após o período grátis.</p>
      ) : (
        <ul className={styles.payList}>
          {rows.map((p) => {
            const st = PAY_STATUS[p.status] || { t: p.status, c: 'badge-muted' }
            return (
              <li key={p.id} className={styles.payItem}>
                <div>
                  <span className={styles.payAmount}>{money(p.amount)}</span>
                  <span className={styles.payMeta}>{dateBR(p.created_at)} · {METHOD_LABEL[p.method] || p.method || '—'}</span>
                </div>
                <span className={`badge ${st.c}`}>{st.t}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// Aviso do estado do trial: dias restantes ou trial encerrado.
function TrialBanner({ trialEndsAt }) {
  if (!trialEndsAt) return null
  const days = Math.ceil((new Date(trialEndsAt) - new Date()) / 86400000)
  if (days <= 0) {
    return (
      <div className={styles.trialEnded}>
        <Icon name="lock" size={18} /> Seu período grátis terminou. Assine para continuar usando o Krovo.
      </div>
    )
  }
  return (
    <div className={styles.trialInfo}>
      <Icon name="schedule" size={18} /> Você está no período grátis — {days} {days === 1 ? 'dia restante' : 'dias restantes'}.
    </div>
  )
}
