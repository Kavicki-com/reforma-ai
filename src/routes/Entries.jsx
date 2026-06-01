import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { money, dateBR } from '../lib/format'
import Spinner from '../components/Spinner'
import Icon from '../components/Icon'
import EntrySheet from '../components/EntrySheet'
import styles from './Entries.module.css'

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'A pagar' },
  { key: 'paid', label: 'Pagos' },
  { key: 'reimbursement', label: 'Reembolsos' },
]

const STATUS_BADGE = {
  paid: { cls: 'badge-paid', label: 'pago' },
  partial: { cls: 'badge-info', label: 'parcial' },
  pending: { cls: 'badge-pending', label: 'a pagar' },
}

const remainingOf = (e) => Math.max(0, Number(e.amount) - Number(e.paid_amount || 0))

export default function Entries() {
  const { isAdmin } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [sheet, setSheet] = useState(null) // null = fechado | 'new' | <id>

  const load = useCallback(() => {
    supabase
      .from('entries')
      .select('*, category:categories(name, kind), stage:stages(name), attachments(id)')
      .order('entry_date', { ascending: false })
      .then(({ data }) => { setEntries(data || []); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = entries.filter((e) => {
    if (filter === 'all') return true
    if (filter === 'reimbursement') return e.type === 'reimbursement'
    if (filter === 'pending') return remainingOf(e) > 0
    if (filter === 'paid') return e.status === 'paid'
    return true
  })

  const totalPending = entries.reduce((s, e) => s + remainingOf(e), 0)

  function openEntry(id) {
    if (!isAdmin) return
    setSheet(id)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Custos</h1>
      </div>

      <div className={`card ${styles.summary}`}>
        <span className="muted">Total a pagar</span>
        <strong>{money(totalPending)}</strong>
      </div>

      <div className={styles.filters}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`${styles.chip} ${filter === f.key ? styles.chipActive : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="spinner-wrap"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <Icon name="receipt_long" />
          Nenhum lançamento aqui ainda.
        </div>
      ) : (
        <div className="stack">
          {filtered.map((e) => (
            <button
              key={e.id}
              type="button"
              className={`card ${styles.item}`}
              onClick={() => openEntry(e.id)}
            >
              <div className={styles.itemMain}>
                <strong>{e.description}</strong>
                <span className="muted">
                  {e.category?.name || 'Sem categoria'}
                  {e.payee ? ` · ${e.payee}` : ''}
                  {e.stage?.name ? ` · ${e.stage.name}` : ''}
                </span>
                <span className={styles.meta}>
                  {dateBR(e.entry_date)}
                  {e.attachments?.length ? (
                    <> · <Icon name="attach_file" size={14} /> {e.attachments.length}</>
                  ) : ''}
                  {e.type === 'reimbursement' ? ' · reembolso' : ''}
                </span>
              </div>
              <div className={styles.itemRight}>
                <strong>{money(e.amount)}</strong>
                <span className={`badge ${(STATUS_BADGE[e.status] || STATUS_BADGE.pending).cls}`}>
                  {(STATUS_BADGE[e.status] || STATUS_BADGE.pending).label}
                </span>
                {e.status === 'partial' && (
                  <span className={styles.meta}>falta {money(remainingOf(e))}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {isAdmin && (
        <>
          <button className="btn-fab" aria-label="Novo lançamento" onClick={() => setSheet('new')}>
            <Icon name="add" size={28} />
          </button>
          <EntrySheet
            open={sheet !== null}
            entryId={sheet === 'new' ? null : sheet}
            onClose={() => setSheet(null)}
            onSaved={load}
          />
        </>
      )}
    </div>
  )
}
