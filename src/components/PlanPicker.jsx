import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { money } from '../lib/format'
import Icon from './Icon'
import Spinner from './Spinner'
import styles from './PlanPicker.module.css'

const FEATURES = [
  'Controle de custos e lançamentos',
  'Etapas e cronograma da obra',
  'Lista de materiais e compras',
  'Leitura de nota fiscal por foto (IA)',
  'Fotos e relatório da obra',
  'Resumo público pra compartilhar',
]

export default function PlanPicker({ value, onChange }) {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const listRef = useRef(null)

  // No carrossel mobile, centraliza o card selecionado (no desktop não há scroll, é no-op).
  useEffect(() => {
    if (!value || !listRef.current) return
    const el = listRef.current.querySelector(`[data-code="${value}"]`)
    el?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [value, plans])

  useEffect(() => {
    let active = true
    supabase
      .from('plans')
      .select('code, name, billing_period, amount, trial_days')
      .eq('active', true)
      .order('amount', { ascending: true })
      .then(({ data }) => {
        if (!active) return
        setPlans(data ?? [])
        setLoading(false)
        // pré-seleciona o anual (melhor custo-benefício) se nada escolhido
        if (!value && data?.length) {
          const anual = data.find((p) => p.billing_period === 'yearly')
          onChange?.((anual ?? data[0]).code)
        }
      })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) return <div className="center" style={{ padding: 'var(--sp-4)' }}><Spinner /></div>

  const mensal = plans.find((p) => p.billing_period === 'monthly')
  const anual = plans.find((p) => p.billing_period === 'yearly')
  const economia = mensal && anual ? mensal.amount * 12 - anual.amount : 0

  return (
    <div className={styles.list} ref={listRef}>
      {plans.map((p) => {
        const selected = p.code === value
        const isYear = p.billing_period === 'yearly'
        return (
          <button
            type="button"
            key={p.code}
            id={`checkout-plano-${p.billing_period}`}
            data-code={p.code}
            className={`${styles.plan} ${selected ? styles.selected : ''}`}
            onClick={() => onChange?.(p.code)}
            aria-pressed={selected}
          >
            <div className={styles.top}>
              <div className={styles.head}>
                <span className={styles.name}>{p.name}</span>
                {isYear && economia > 0 && (
                  <span className={styles.badge}>Economize {money(economia)}</span>
                )}
              </div>
              <span className={`${styles.radio} ${selected ? styles.radioOn : ''}`} aria-hidden="true" />
            </div>

            <div className={styles.priceRow}>
              <span className={styles.price}>{money(p.amount)}</span>
              <span className={styles.per}>/{isYear ? 'ano' : 'mês'}</span>
            </div>
            <div className={styles.sub}>
              {isYear && mensal && <span className={styles.equiv}>≈ {money(p.amount / 12)}/mês</span>}
              {p.trial_days > 0 && <span className={styles.trial}>{p.trial_days} dias grátis</span>}
            </div>

            <ul className={styles.features}>
              {FEATURES.map((f) => (
                <li key={f}><Icon name="check_circle" size={18} className={styles.check} /> {f}</li>
              ))}
            </ul>
          </button>
        )
      })}
    </div>
  )
}
