import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { money, dateBR } from '../lib/format'
import ProgressBar from '../components/ProgressBar'
import Spinner from '../components/Spinner'
import Icon from '../components/Icon'
import styles from './PublicSummary.module.css'

const STATUS = {
  pendente: { label: 'Pendente', cls: 'badge-pending' },
  em_andamento: { label: 'Em andamento', cls: 'badge-info' },
  concluida: { label: 'Concluída', cls: 'badge-paid' },
}

export default function PublicSummary() {
  const { token } = useParams()
  const [data, setData] = useState(undefined) // undefined = carregando, null = inválido
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase.rpc('get_obra_summary', { p_token: token }).then(({ data }) => {
      if (!active) return
      setData(data ?? null)
      setLoading(false)
    })
    return () => { active = false }
  }, [token])

  if (loading) return <div className="spinner-wrap"><Spinner /></div>

  if (!data) {
    return (
      <div className="page">
        <div className="empty">
          <Icon name="link_off" />
          Este link de compartilhamento é inválido ou foi desativado.
        </div>
      </div>
    )
  }

  const t = data.totals || {}
  const m = data.materials || {}

  return (
    <div className="page">
      <header className={styles.header}>
        <div className={styles.brand}><Icon name="home_repair_service" fill={1} /> Reforma AI</div>
        <h1>{data.project?.name || 'Obra'}</h1>
        <span className="muted">Resumo da obra · somente leitura</span>
      </header>

      {/* Progresso */}
      <div className={`card ${styles.progressCard}`}>
        <div className={styles.progressHead}>
          <span className="muted">Progresso da obra</span>
          <strong className={styles.progressPct}>{data.progress}%</strong>
        </div>
        <ProgressBar value={data.progress} />
      </div>

      {/* Indicadores */}
      <div className={styles.grid}>
        <Stat label="Gasto (pago)" value={money(t.total_paid)} tone="paid" />
        <Stat label="A pagar" value={money(t.total_pending)} tone="pending" />
        <Stat label="Total lançado" value={money(t.total_expense)} />
        <Stat label="Gasto estimado" value={money(t.estimated_total)} />
      </div>

      {/* Duração */}
      <div className={`card ${styles.duration}`}>
        <div>
          <span className="muted">Duração da obra</span>
          <strong className={styles.durationValue}>
            {t.duration_days != null ? `${t.duration_days} dias` : '—'}
          </strong>
        </div>
        <div className={styles.dates}>
          <span>Início: {dateBR(t.start_date)}</span>
          <span>Previsão: {dateBR(t.expected_end_date)}</span>
        </div>
      </div>

      {/* Etapas */}
      <h2 className={styles.section}>Etapas</h2>
      {data.stages.length === 0 ? (
        <p className="muted">Nenhuma etapa cadastrada.</p>
      ) : (
        <div className={styles.stageGrid}>
          {data.stages.map((s, i) => {
            const st = STATUS[s.status] || STATUS.pendente
            return (
              <div key={i} className={`card ${styles.stageCard}`}>
                <span className={`badge ${st.cls}`}>{st.label}</span>
                <strong className={styles.stageName}>{s.name}</strong>
                <span className={styles.sub}>
                  {dateBR(s.start_date)} → {dateBR(s.completed_at || s.end_date)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Orçamento por categoria */}
      <h2 className={styles.section}>Orçamento por categoria</h2>
      {data.categories.length === 0 ? (
        <p className="muted">Sem gastos registrados.</p>
      ) : (
        <div className="card stack">
          {data.categories.map((c, i) => (
            <div key={i} className={styles.catRow}>
              <span>{c.category_name}</span>
              <strong>{money(c.total_expense)}</strong>
            </div>
          ))}
        </div>
      )}

      {/* Materiais */}
      <h2 className={styles.section}>Materiais</h2>
      <div className={`card ${styles.materials}`}>
        <div><span className="muted">A comprar</span><strong>{m.to_buy || 0}</strong></div>
        <div><span className="muted">Comprados</span><strong>{m.bought || 0}</strong></div>
        <div><span className="muted">Estimado a comprar</span><strong>{money(m.estimated_to_buy)}</strong></div>
      </div>

      <footer className={styles.footer}>Gerado por Reforma AI</footer>
    </div>
  )
}

function Stat({ label, value, tone }) {
  return (
    <div className={`card ${styles.stat}`}>
      <span className={styles.statLabel}>{label}</span>
      <strong className={`${styles.statValue} ${tone ? styles[tone] : ''}`}>{value}</strong>
    </div>
  )
}
