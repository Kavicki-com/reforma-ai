import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { money, dateBR } from '../lib/format'
import Spinner from './Spinner'
import styles from './SummaryList.module.css'

const STATUS_LABEL = { pendente: 'Pendente', em_andamento: 'Em andamento', pausada: 'Pausada', concluida: 'Concluída' }
const STATUS_BADGE = { pendente: 'badge-pending', em_andamento: 'badge-info', pausada: 'badge-muted', concluida: 'badge-paid' }

export default function StagesSummary({ projectId }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return
    let active = true
    supabase
      .from('v_stage_totals')
      .select('*')
      .eq('project_id', projectId)
      .order('start_date', { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        if (!active) return
        setRows(data || [])
        setLoading(false)
      })
    return () => { active = false }
  }, [projectId])

  if (loading) return <div className="spinner-wrap"><Spinner small /></div>
  if (rows.length === 0) return <p className="muted">Nenhuma etapa cadastrada.</p>

  return (
    <div className="stack">
      {rows.map((r) => (
        <div key={r.stage_id}>
          <div className={styles.lineHead}>
            <span>{r.name} <span className={`badge ${STATUS_BADGE[r.status]} ${styles.tag}`}>{STATUS_LABEL[r.status]}</span></span>
            {r.budget > 0 && <strong>{money(r.budget)}</strong>}
          </div>
          <span className={styles.sub}>{dateBR(r.start_date)} → {dateBR(r.completed_at || r.end_date)}</span>
        </div>
      ))}
      <Link to="/etapas" className={styles.more}>Gerenciar etapas</Link>
    </div>
  )
}
