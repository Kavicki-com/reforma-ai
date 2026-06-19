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
import EntrySheet from '../components/EntrySheet'
import SideMenu from '../components/SideMenu'
import BottomSheet from '../components/BottomSheet'
import styles from './Dashboard.module.css'

const STAGE_STATUS = {
  pendente: { label: 'Pendente', cls: 'badge-pending' },
  em_andamento: { label: 'Em andamento', cls: 'badge-info' },
  pausada: { label: 'Pausada', cls: 'badge-muted' },
  concluida: { label: 'Concluída', cls: 'badge-paid' },
}

export default function Dashboard() {
  const { profile, isAdmin } = useAuth()
  const { project, loading: loadingProject } = useProject()
  const [totals, setTotals] = useState(null)
  const [stageStats, setStageStats] = useState({ total: 0, done: 0 })
  const [stages, setStages] = useState([])
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareToken, setShareToken] = useState(null)
  const [copied, setCopied] = useState(false)
  const [docsPwd, setDocsPwd] = useState('')
  const [docsPwdSet, setDocsPwdSet] = useState(false)
  const [savingPwd, setSavingPwd] = useState(false)
  const [pwdMsg, setPwdMsg] = useState('')

  const loadTotals = useCallback(() => {
    if (!project) return
    supabase
      .from('v_project_totals')
      .select('*')
      .eq('project_id', project.id)
      .maybeSingle()
      .then(({ data }) => { setTotals(data); setLoading(false) })

    // Progresso da obra: baseado só nas etapas (compras de material não contam,
    // senão comprar cedo infla o avanço). Peso por etapa: pendente=0,
    // em andamento/pausada=0,5, concluída=1.
    supabase.from('stages')
      .select('id, name, status, start_date, end_date, completed_at')
      .eq('project_id', project.id)
      .order('start_date', { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        const stages = data || []
        setStages(stages)
        setStageStats({
          total: stages.length,
          done: stages.filter((s) => s.status === 'concluida').length,
        })
        const weight = { pendente: 0, em_andamento: 0.5, pausada: 0.5, concluida: 1 }
        const stagePoints = stages.reduce((a, s) => a + (weight[s.status] ?? 0), 0)
        setProgress(stages.length ? Math.round((stagePoints / stages.length) * 100) : 0)
      })
  }, [project])

  useEffect(() => { loadTotals() }, [loadTotals])

  useEffect(() => {
    if (!project || !isAdmin) return
    supabase
      .from('public_shares')
      .select('token, docs_password_hash')
      .eq('project_id', project.id)
      .eq('enabled', true)
      .order('created_at')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setShareToken(data?.token || null)
        setDocsPwdSet(!!data?.docs_password_hash)
      })
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

  async function saveDocsPassword() {
    if (!project || !docsPwd.trim()) return
    setSavingPwd(true); setPwdMsg('')
    const { error } = await supabase.rpc('set_share_docs_password', { p_project_id: project.id, p_password: docsPwd })
    setSavingPwd(false)
    if (error) { setPwdMsg('Erro ao salvar a senha.'); return }
    setDocsPwdSet(true)
    setDocsPwd('')
    setPwdMsg('Senha salva.')
  }

  async function removeDocsPassword() {
    if (!project) return
    setSavingPwd(true); setPwdMsg('')
    const { error } = await supabase.rpc('set_share_docs_password', { p_project_id: project.id, p_password: null })
    setSavingPwd(false)
    if (error) { setPwdMsg('Erro ao remover a senha.'); return }
    setDocsPwdSet(false)
    setDocsPwd('')
    setPwdMsg('Senha removida — a seção fica oculta no link.')
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
        <button id="dash-abrir-menu" className={`${styles.iconBtn} ${styles.menuBtn}`} onClick={() => setMenuOpen(true)} aria-label="Abrir menu">
          <Icon name="menu" size={26} />
        </button>
        <p className={`muted ${styles.greeting}`}>
          Olá, {profile?.full_name?.split(' ')[0] || 'usuário'}
          {!isAdmin && ' · somente leitura'}
        </p>
        <a
          id="dash-suporte-whatsapp"
          className={`${styles.iconBtn} ${styles.whatsBtn}`}
          href="https://wa.me/5521979137098?text=Ol%C3%A1!%20Preciso%20de%20ajuda%20com%20o%20Krovo."
          target="_blank"
          rel="noreferrer"
          aria-label="Suporte pelo WhatsApp"
          title="Suporte pelo WhatsApp"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
            <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.413c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.748-.747zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
          </svg>
        </a>
        {isAdmin && (
          <button id="dash-compartilhar" className={styles.iconBtn} onClick={openShare} aria-label="Compartilhar resumo">
            <Icon name="share" size={22} />
          </button>
        )}
      </div>

      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className={styles.kpis}>
        <div className={`card ${styles.progressCard} ${styles.cProgress}`}>
          <div className={styles.progressHead}>
            <span className={styles.statLabel}>Progresso da obra</span>
            <strong className={styles.progressPct}>{progress}%</strong>
          </div>
          <ProgressBar value={progress} />
        </div>

        <Stat label="Gasto" value={money(spent)} tone="paid" cellClass={styles.cGasto} />
        <Stat label="A pagar" value={money(toPay)} tone="pending" cellClass={styles.cPagar} />
        <Stat label="Custo estimado" value={money(t.estimated_total)} cellClass={styles.cEstimated} />

        <div className={`card ${styles.donutCard} ${styles.cStagesDonut}`}>
          <Donut value={donutPct} center={`${donutPct}%`} size={92} />
          <span className={styles.statLabel}>Etapas concluídas</span>
          <span className={styles.statHint}>{stageStats.done} de {stageStats.total}</span>
        </div>

        <div className={`card ${styles.kpiTall} ${styles.cDuration}`}>
          <span className={styles.statLabel}>Duração da obra</span>
          <strong className={styles.durationValue}>
            {t.duration_days != null ? `${t.duration_days} dias` : '—'}
          </strong>
          <div className={styles.dates}>
            <span>Início: {dateBR(t.start_date)}</span>
            <span>Previsão: {dateBR(t.expected_end_date)}</span>
          </div>
        </div>
      </div>

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

      {stages.length > 0 && (
        <section className={styles.stagesBlock}>
          <h2 className={styles.section}>Etapas</h2>
          <div className={styles.stageGrid}>
            {stages.map((s) => {
              const st = STAGE_STATUS[s.status] || STAGE_STATUS.pendente
              return (
                <div key={s.id} className={`card ${styles.stageCard}`}>
                  <span className={`badge ${st.cls}`}>{st.label}</span>
                  <strong className={styles.stageName}>{s.name}</strong>
                  <span className={styles.sub}>
                    {dateBR(s.start_date)} → {dateBR(s.completed_at || s.end_date)}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <div className={styles.accordions}>
        <Accordion icon="bar_chart" title="Gastos por categoria">
          <BudgetSummary projectId={project?.id} />
        </Accordion>
        <Accordion icon="shopping_cart" title="Lista de materiais">
          <MaterialsSummary projectId={project?.id} />
        </Accordion>
      </div>

      {isAdmin && (
        <>
          <button id="dash-novo-lancamento" className="btn-fab" aria-label="Novo lançamento" onClick={() => setSheetOpen(true)}>
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
              <button id="dash-copiar-link" className="btn btn-primary" onClick={copyLink} aria-label="Copiar link">
                <Icon name={copied ? 'check' : 'content_copy'} size={20} />
              </button>
            </div>
            {copied && <span className="muted">Link copiado!</span>}

            <div className={styles.shareDocs}>
              <strong>Notas e comprovantes</strong>
              <span className="muted">
                Defina uma senha para liberar a seção de notas e comprovantes no link.
                Sem senha, a seção não aparece para quem abre o link.
              </span>
              {docsPwdSet && (
                <span className={styles.docsActive}><Icon name="lock" size={16} /> Senha ativa</span>
              )}
              <div className={styles.shareRow}>
                <input
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={docsPwd}
                  onChange={(e) => setDocsPwd(e.target.value)}
                  placeholder={docsPwdSet ? 'Nova senha' : 'Senha'}
                />
                <button className="btn btn-primary" onClick={saveDocsPassword} disabled={savingPwd || !docsPwd.trim()}>
                  {savingPwd ? <Spinner small /> : 'Salvar'}
                </button>
              </div>
              {docsPwdSet && (
                <button className="btn btn-ghost btn-block" onClick={removeDocsPassword} disabled={savingPwd}>
                  Remover senha
                </button>
              )}
              {pwdMsg && <span className="muted">{pwdMsg}</span>}
            </div>
          </div>
        </BottomSheet>
      )}
    </div>
  )
}

function Stat({ label, value, tone, hint, cellClass }) {
  return (
    <div className={`card ${styles.stat} ${cellClass || ''}`}>
      <span className={styles.statLabel}>{label}</span>
      <strong className={`${styles.statValue} ${tone ? styles[tone] : ''}`}>{value}</strong>
      {hint && <span className={styles.statHint}>{hint}</span>}
    </div>
  )
}
