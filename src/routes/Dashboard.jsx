import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { useProject } from '../lib/useProject'
import { money, dateBR, pct } from '../lib/format'
import ProgressBar from '../components/ProgressBar'
import Donut from '../components/Donut'
import Spinner from '../components/Spinner'
import Icon from '../components/Icon'
import Accordion from '../components/Accordion'
import BudgetSummary from '../components/BudgetSummary'
import MaterialsSummary from '../components/MaterialsSummary'
import StagesSummary from '../components/StagesSummary'
import EntrySheet from '../components/EntrySheet'
import SideMenu from '../components/SideMenu'
import BottomSheet from '../components/BottomSheet'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  const { profile, isAdmin } = useAuth()
  const { project, loading: loadingProject } = useProject()
  const [totals, setTotals] = useState(null)
  const [stageStats, setStageStats] = useState({ total: 0, done: 0 })
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareToken, setShareToken] = useState(null)
  const [copied, setCopied] = useState(false)

  const loadTotals = useCallback(() => {
    if (!project) return
    supabase
      .from('v_project_totals')
      .select('*')
      .eq('project_id', project.id)
      .maybeSingle()
      .then(({ data }) => { setTotals(data); setLoading(false) })

    // Progresso da obra: cada etapa e cada material conta como uma unidade.
    // Etapa: pendente=0, em andamento=0,5, concluída=1. Material: comprado=1, a comprar=0.
    Promise.all([
      supabase.from('stages').select('status').eq('project_id', project.id),
      supabase.from('shopping_items').select('status').eq('project_id', project.id),
    ]).then(([st, sh]) => {
      const stages = st.data || []
      const mats = sh.data || []
      setStageStats({
        total: stages.length,
        done: stages.filter((s) => s.status === 'concluida').length,
      })
      const weight = { pendente: 0, em_andamento: 0.5, concluida: 1 }
      const stagePoints = stages.reduce((a, s) => a + (weight[s.status] ?? 0), 0)
      const matPoints = mats.filter((m) => m.status === 'comprado').length
      const total = stages.length + mats.length
      setProgress(total ? Math.round(((stagePoints + matPoints) / total) * 100) : 0)
    })
  }, [project])

  useEffect(() => { loadTotals() }, [loadTotals])

  // Busca o link público existente (admin)
  useEffect(() => {
    if (!project || !isAdmin) return
    supabase
      .from('public_shares')
      .select('token')
      .eq('project_id', project.id)
      .eq('enabled', true)
      .order('created_at')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setShareToken(data?.token || null))
  }, [project, isAdmin])

  const shareUrl = shareToken ? `${window.location.href.split('#')[0]}#/s/${shareToken}` : ''

  async function openShare() {
    if (!shareToken && project) {
      const newToken = crypto.randomUUID().replace(/-/g, '')
      const { data } = await supabase
        .from('public_shares')
        .insert({ project_id: project.id, token: newToken })
        .select('token')
        .single()
      setShareToken(data?.token || newToken)
    }
    setShareOpen(true)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard indisponível */ }
  }

  if (loadingProject || loading) {
    return <div className="spinner-wrap"><Spinner /></div>
  }

  const t = totals || {}
  const budget = Number(t.budget_total || 0)
  const spent = Number(t.total_spent || 0)        // pago + materiais comprados
  const toPay = Number(t.total_pending || 0) + Number(t.estimated_to_buy || 0) // custos a pagar + materiais a comprar
  const overBudget = budget > 0 && spent > budget
  const donutPct = stageStats.total ? Math.round((stageStats.done / stageStats.total) * 100) : 0

  return (
    <div className="page">
      <div className={styles.topbar}>
        <button className={`${styles.iconBtn} ${styles.menuBtn}`} onClick={() => setMenuOpen(true)} aria-label="Abrir menu">
          <Icon name="menu" size={26} />
        </button>
        <p className={`muted ${styles.greeting}`}>
          Olá, {profile?.full_name?.split(' ')[0] || 'usuário'}
          {!isAdmin && ' · somente leitura'}
        </p>
        {isAdmin && (
          <button className={styles.iconBtn} onClick={openShare} aria-label="Compartilhar resumo">
            <Icon name="share" size={22} />
          </button>
        )}
      </div>

      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Progresso geral da obra */}
      <div className={`card ${styles.progressCard}`}>
        <div className={styles.progressHead}>
          <span className={styles.statLabel}>Progresso da obra</span>
          <strong className={styles.progressPct}>{progress}%</strong>
        </div>
        <ProgressBar value={progress} />
      </div>

      {/* Destaque: gasto pago de fato */}
      <div className={`card ${styles.hero}`}>
        <span className={styles.heroLabel}>Gasto total da obra</span>
        <strong className={styles.heroValue}>{money(spent)}</strong>
        {budget > 0 && (
          <>
            <ProgressBar value={pct(spent, budget)} tone={overBudget ? 'over' : 'ok'} />
            <span className={styles.heroSub}>
              {pct(spent, budget)}% de {money(budget)}
            </span>
          </>
        )}
      </div>

      {/* Grade de indicadores */}
      <div className={styles.grid}>
        <div className={`card ${styles.donutCard}`}>
          <Donut value={donutPct} center={`${donutPct}%`} size={76} />
          <span className={styles.statLabel}>Etapas concluídas</span>
          <span className={styles.statHint}>{stageStats.done} de {stageStats.total}</span>
        </div>
        <Stat label="Gasto estimado" value={money(t.estimated_total)} hint="pago + a pagar" />
        <Stat
          label="Saldo do orçamento"
          value={money(t.remaining)}
          tone={Number(t.remaining) < 0 ? 'pending' : 'paid'}
        />
        <Stat label="A pagar" value={money(toPay)} hint="custos + materiais a comprar" tone="pending" />
      </div>

      {/* Duracao (derivada das etapas) */}
      <div className={`card ${styles.duration}`}>
        <div>
          <span className={styles.statLabel}>Duração da obra</span>
          <strong className={styles.durationValue}>
            {t.duration_days != null ? `${t.duration_days} dias` : '—'}
          </strong>
        </div>
        <div className={styles.dates}>
          <span>Início: {dateBR(t.start_date)}</span>
          <span>Previsão: {dateBR(t.expected_end_date)}</span>
        </div>
      </div>

      {/* Acordeões — conteúdo na própria tela */}
      <div className={styles.accordions}>
        <Accordion icon="bar_chart" title="Orçamento por categoria">
          <BudgetSummary projectId={project?.id} />
        </Accordion>
        <Accordion icon="shopping_cart" title="Lista de materiais">
          <MaterialsSummary projectId={project?.id} />
        </Accordion>
        <Accordion icon="calendar_month" title="Etapas da obra">
          <StagesSummary projectId={project?.id} />
        </Accordion>
      </div>

      {isAdmin && (
        <>
          <button className="btn-fab" aria-label="Novo lançamento" onClick={() => setSheetOpen(true)}>
            <Icon name="add" size={28} />
          </button>
          <EntrySheet
            open={sheetOpen}
            entryId={null}
            onClose={() => setSheetOpen(false)}
            onSaved={loadTotals}
          />
        </>
      )}

      {isAdmin && (
        <BottomSheet open={shareOpen} onClose={() => setShareOpen(false)} title="Compartilhar resumo">
          <div className="stack">
            <p className="muted">
              Qualquer pessoa com este link vê um resumo da obra (somente leitura). Não é
              necessário login.
            </p>
            <div className={styles.shareRow}>
              <input className="input" readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
              <button className="btn btn-primary" onClick={copyLink} aria-label="Copiar link">
                <Icon name={copied ? 'check' : 'content_copy'} size={20} />
              </button>
            </div>
            {copied && <span className="muted">Link copiado!</span>}
          </div>
        </BottomSheet>
      )}
    </div>
  )
}

function Stat({ label, value, tone, hint }) {
  return (
    <div className={`card ${styles.stat}`}>
      <span className={styles.statLabel}>{label}</span>
      <strong className={`${styles.statValue} ${tone ? styles[tone] : ''}`}>{value}</strong>
      {hint && <span className={styles.statHint}>{hint}</span>}
    </div>
  )
}
