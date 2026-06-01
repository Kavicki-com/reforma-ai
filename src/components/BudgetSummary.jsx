import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { money, pct } from '../lib/format'
import ProgressBar from './ProgressBar'
import Spinner from './Spinner'
import styles from './SummaryList.module.css'

export default function BudgetSummary({ projectId }) {
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return
    let active = true
    supabase
      .from('v_category_totals')
      .select('*')
      .eq('project_id', projectId)
      .then(({ data }) => {
        if (!active) return
        setCats((data || []).sort((a, b) => b.total_expense - a.total_expense))
        setLoading(false)
      })
    return () => { active = false }
  }, [projectId])

  if (loading) return <div className="spinner-wrap"><Spinner small /></div>
  if (cats.length === 0) return <p className="muted">Sem gastos por categoria ainda.</p>

  const max = Math.max(1, ...cats.map((c) => Number(c.total_expense)))

  return (
    <div className="stack">
      {cats.map((c) => (
        <div key={c.category_id}>
          <div className={styles.lineHead}>
            <span>{c.category_name}</span>
            <strong>{money(c.total_expense)}</strong>
          </div>
          <ProgressBar value={pct(c.total_expense, max)} />
        </div>
      ))}
      <Link to="/orcamento" className={styles.more}>Ver orçamento completo</Link>
    </div>
  )
}
