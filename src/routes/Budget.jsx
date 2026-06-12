import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { useProject } from '../lib/useProject'
import { money, pct } from '../lib/format'
import ProgressBar from '../components/ProgressBar'
import Spinner from '../components/Spinner'
import Icon from '../components/Icon'
import styles from './Budget.module.css'

export default function Budget() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { project, loading: loadingProject } = useProject()
  const [totals, setTotals] = useState(null)
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingBudget, setEditingBudget] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!project) return
    let active = true
    Promise.all([
      supabase.from('v_project_totals').select('*').eq('project_id', project.id).maybeSingle(),
      supabase.from('v_category_totals').select('*').eq('project_id', project.id),
    ]).then(([t, c]) => {
      if (!active) return
      setTotals(t.data)
      setCats((c.data || []).sort((a, b) => b.total_expense - a.total_expense))
      setBudgetInput(String(project.budget_total ?? ''))
      setLoading(false)
    })
    return () => { active = false }
  }, [project])

  async function saveBudget() {
    setSaving(true)
    await supabase.from('projects').update({ budget_total: Number(budgetInput || 0) }).eq('id', project.id)
    setSaving(false)
    setEditingBudget(false)
    navigate(0) // recarrega dados
  }

  if (loadingProject || loading) return <div className="spinner-wrap"><Spinner /></div>

  const t = totals || {}
  const budget = Number(t.budget_total || 0)
  const spent = Number(t.total_spent || 0)
  const over = budget > 0 && spent > budget
  const maxCat = Math.max(1, ...cats.map((c) => Number(c.total_expense)))

  return (
    <div className="page">
      <div className="page-header">
        <h1>Orçamento</h1>
      </div>

      <div className="card stack">
        <div className={styles.budgetHead}>
          <div>
            <span className="muted">Orçamento total</span>
            {editingBudget ? (
              <input className="input" type="number" step="0.01" min="0" value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)} autoFocus />
            ) : (
              <strong className={styles.big}>{money(budget)}</strong>
            )}
          </div>
          {isAdmin && (
            editingBudget ? (
              <button id="orcamento-salvar" className="btn btn-primary" onClick={saveBudget} disabled={saving}>
                {saving ? <Spinner small /> : 'Salvar'}
              </button>
            ) : (
              <button id="orcamento-definir" className="btn btn-ghost" onClick={() => setEditingBudget(true)}>Definir</button>
            )
          )}
        </div>
        <ProgressBar value={pct(spent, budget)} tone={over ? 'over' : 'ok'} />
        <div className={styles.legend}>
          <span>Gasto: <strong>{money(spent)}</strong></span>
          <span className={over ? styles.over : ''}>
            {over ? 'Estourou: ' : 'Saldo: '}{money(Math.abs(Number(t.remaining || 0)))}
          </span>
        </div>
        <div className={styles.estimate}>
          <span className="muted">Gasto estimado (realizado + a comprar)</span>
          <strong>{money(t.estimated_total)}</strong>
        </div>
      </div>

      <h2 className={styles.subtitle}>Por categoria</h2>
      {cats.length === 0 ? (
        <div className="empty"><Icon name="bar_chart" />Sem gastos registrados.</div>
      ) : (
        <div className="stack">
          {cats.map((c) => (
            <div key={c.category_id} className="card">
              <div className={styles.catHead}>
                <strong>{c.category_name}</strong>
                <strong>{money(c.total_expense)}</strong>
              </div>
              <ProgressBar value={pct(c.total_expense, maxCat)} />
              {Number(c.total_pending) > 0 && (
                <span className={styles.pending}>A pagar: {money(c.total_pending)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
