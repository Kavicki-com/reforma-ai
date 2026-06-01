import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { money } from '../lib/format'
import Spinner from './Spinner'
import Icon from './Icon'
import styles from './SummaryList.module.css'

export default function MaterialsSummary({ projectId }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return
    let active = true
    supabase
      .from('shopping_items')
      .select('*')
      .eq('project_id', projectId)
      .order('status')
      .then(({ data }) => {
        if (!active) return
        setItems(data || [])
        setLoading(false)
      })
    return () => { active = false }
  }, [projectId])

  if (loading) return <div className="spinner-wrap"><Spinner small /></div>
  if (items.length === 0) return <p className="muted">Lista de materiais vazia.</p>

  const toBuy = items.filter((i) => i.status === 'a_comprar')
  const totalToBuy = toBuy.reduce((s, i) => s + Number(i.estimated_total), 0)

  return (
    <div className="stack">
      <div className={styles.lineHead}>
        <span className="muted">A comprar ({toBuy.length})</span>
        <strong>{money(totalToBuy)}</strong>
      </div>
      {items.slice(0, 6).map((i) => (
        <div key={i.id} className={styles.row}>
          <Icon
            name={i.status === 'comprado' ? 'check_box' : 'check_box_outline_blank'}
            size={18}
            fill={i.status === 'comprado' ? 1 : 0}
            className={i.status === 'comprado' ? styles.done : styles.todo}
          />
          <span className={i.status === 'comprado' ? styles.struck : ''}>{i.name}</span>
          <strong>{money(i.estimated_total)}</strong>
        </div>
      ))}
      <Link to="/materiais" className={styles.more}>Gerenciar materiais</Link>
    </div>
  )
}
