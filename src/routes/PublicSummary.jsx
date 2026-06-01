import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useInstallPrompt } from '../lib/useInstallPrompt'
import { money, dateBR } from '../lib/format'
import ProgressBar from '../components/ProgressBar'
import Spinner from '../components/Spinner'
import Icon from '../components/Icon'
import CompanyFooter from '../components/CompanyFooter'
import styles from './PublicSummary.module.css'

const logo = `${import.meta.env.BASE_URL}pwa-192.png`

const STATUS = {
  pendente: { label: 'Pendente', cls: 'badge-pending' },
  em_andamento: { label: 'Em andamento', cls: 'badge-info' },
  concluida: { label: 'Concluída', cls: 'badge-paid' },
}

export default function PublicSummary() {
  const { token } = useParams()
  const [data, setData] = useState(undefined) // undefined = carregando, null = inválido
  const [loading, setLoading] = useState(true)
  const { installed, promptInstall } = useInstallPrompt()

  useEffect(() => {
    let active = true
    supabase.rpc('get_obra_summary', { p_token: token }).then(({ data }) => {
      if (!active) return
      setData(data ?? null)
      setLoading(false)
    })
    return () => { active = false }
  }, [token])

  // Manifest dinâmico: instalar a partir do link abre direto NESTE resumo
  // (start_url = a própria URL pública, em vez do app principal/login).
  useEffect(() => {
    if (!data) return
    const abs = (f) => new URL(import.meta.env.BASE_URL + f, window.location.href).href
    const manifest = {
      name: `Krovo — ${data.project?.name || 'Obra'}`,
      short_name: 'Krovo',
      description: 'Resumo da obra',
      start_url: window.location.href,
      scope: new URL(import.meta.env.BASE_URL, window.location.href).href,
      display: 'standalone',
      theme_color: '#1f6f54',
      background_color: '#f4f5f3',
      icons: [
        { src: abs('pwa-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: abs('pwa-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: abs('pwa-maskable.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    }
    const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' }))
    let link = document.querySelector('link[rel="manifest"]')
    const prev = link ? link.getAttribute('href') : null
    if (!link) { link = document.createElement('link'); link.rel = 'manifest'; document.head.appendChild(link) }
    link.setAttribute('href', blobUrl)
    return () => {
      URL.revokeObjectURL(blobUrl)
      if (prev !== null) link.setAttribute('href', prev)
    }
  }, [data])

  async function handleInstall() {
    const r = await promptInstall()
    if (r === 'ios') alert('Para instalar: toque em Compartilhar e em "Adicionar à Tela de Início".')
    else if (r === 'unsupported') alert('Para instalar: abra o menu do navegador e escolha "Instalar app".')
  }

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
        <div className={styles.brand}><img className={styles.brandLogo} src={logo} alt="" /> Krovo</div>
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

      {!installed && (
        <div className={`card ${styles.installCard}`}>
          <div className={styles.installText}>
            <strong>Instalar o app</strong>
            <span className="muted">Acompanhe o resumo direto da tela inicial.</span>
          </div>
          <button className="btn btn-primary" onClick={handleInstall}>
            <Icon name="install_mobile" size={18} /> Instalar
          </button>
        </div>
      )}

      <footer className={styles.footer}>Gerado por Krovo</footer>
      <CompanyFooter />
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
