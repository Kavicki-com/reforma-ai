import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useInstallPrompt } from '../lib/useInstallPrompt'
import { money, dateBR } from '../lib/format'
import ProgressBar from '../components/ProgressBar'
import Donut from '../components/Donut'
import Spinner from '../components/Spinner'
import Icon from '../components/Icon'
import InstallButton from '../components/InstallButton'
import CompanyFooter from '../components/CompanyFooter'
import styles from './PublicSummary.module.css'

const logo = `${import.meta.env.BASE_URL}pwa-192.png`

const STATUS = {
  pendente: { label: 'Pendente', cls: 'badge-pending' },
  em_andamento: { label: 'Em andamento', cls: 'badge-info' },
  pausada: { label: 'Pausada', cls: 'badge-muted' },
  concluida: { label: 'Concluída', cls: 'badge-paid' },
}

function groupByDay(photos) {
  const map = new Map()
  for (const p of photos) {
    const day = String(p.taken_at || p.created_at || '').slice(0, 10)
    if (!map.has(day)) map.set(day, [])
    map.get(day).push(p)
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([day, items]) => ({ day, items }))
}

export default function PublicSummary() {
  const { token } = useParams()
  const [data, setData] = useState(undefined) // undefined = carregando, null = inválido
  const [loading, setLoading] = useState(true)
  const [photoUrls, setPhotoUrls] = useState({})
  const { installed } = useInstallPrompt()

  // Busca o resumo ao abrir e sempre que a aba volta a ficar visível — assim,
  // ao fechar e reabrir o link (inclusive o PWA instalado retomado da memória),
  // os dados aparecem atualizados.
  useEffect(() => {
    let active = true
    const tick = () => {
      supabase.rpc('get_obra_summary', { p_token: token }).then(({ data }) => {
        if (!active) return
        setData(data ?? null)
        setLoading(false)
      })
    }
    tick()
    const onVisible = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [token])

  // Signed URLs das fotos (bucket privado, liberado p/ anon via policy do share).
  // Assina só os caminhos ainda não assinados — evita re-assinar (e piscar) a
  // cada re-busca do resumo.
  useEffect(() => {
    const photos = data?.photos
    if (!photos || photos.length === 0) return
    const missing = photos.map((p) => p.file_path).filter((fp) => !photoUrls[fp])
    if (missing.length === 0) return
    let active = true
    supabase.storage
      .from('fotos')
      .createSignedUrls(missing, 3600)
      .then(({ data: signed }) => {
        if (!active) return
        setPhotoUrls((prev) => {
          const map = { ...prev }
          ;(signed || []).forEach((s) => { if (s.signedUrl) map[s.path] = s.signedUrl })
          return map
        })
      })
    return () => { active = false }
  }, [data, photoUrls])

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
  const photoGroups = groupByDay(data.photos || [])
  const spent = Number(t.total_spent || 0)
  const toPay = Number(t.total_pending || 0) + Number(t.estimated_to_buy || 0)
  const stagesDone = data.stages.filter((s) => s.status === 'concluida').length
  const stagesPct = data.stages.length ? Math.round((stagesDone / data.stages.length) * 100) : 0
  const materialList = data.material_list || []

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
        <Stat label="Gasto" value={money(spent)} tone="paid" />
        <Stat label="A pagar" value={money(toPay)} tone="pending" />
        <Stat label="Custo estimado" value={money(t.estimated_total)} />
        <div className={`card ${styles.donutCard}`}>
          <Donut value={stagesPct} center={`${stagesPct}%`} size={76} />
          <span className={styles.statLabel}>Etapas concluídas</span>
          <span className={styles.statHint}>{stagesDone} de {data.stages.length}</span>
        </div>
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
      <h2 className={styles.section}>Lista de materiais</h2>
      {materialList.length === 0 ? (
        <p className="muted">Lista de materiais vazia.</p>
      ) : (
        <div className="card stack">
          {materialList.map((mi, i) => (
            <div key={i} className={styles.matRow}>
              <Icon
                name={mi.status === 'comprado' ? 'check_box' : 'check_box_outline_blank'}
                size={18}
                fill={mi.status === 'comprado' ? 1 : 0}
                className={mi.status === 'comprado' ? styles.matDone : styles.matTodo}
              />
              <div className={styles.matBody}>
                <span className={mi.status === 'comprado' ? styles.matStruck : styles.matName}>{mi.name}</span>
                <span className={styles.matSub}>{Number(mi.quantity)} {mi.unit}</span>
              </div>
              <strong className={styles.matTotal}>{money(mi.estimated_total)}</strong>
            </div>
          ))}
        </div>
      )}

      {/* Fotos da obra */}
      {photoGroups.length > 0 && (
        <>
          <h2 className={styles.section}>Fotos da obra</h2>
          <div className={styles.photoDays}>
            {photoGroups.map((g) => (
              <section key={g.day}>
                <h3 className={styles.photoDayHeader}>{dateBR(g.day)}</h3>
                <div className={styles.photoGrid}>
                  {g.items.map((p, i) => (
                    <div key={i} className={styles.photoCell}>
                      {photoUrls[p.file_path] ? (
                        <a href={photoUrls[p.file_path]} target="_blank" rel="noreferrer">
                          <img src={photoUrls[p.file_path]} alt={p.caption || 'foto da obra'} loading="lazy" decoding="async" />
                        </a>
                      ) : (
                        <div className={styles.photoPlaceholder}><Spinner small /></div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      {!installed && (
        <div className={`card ${styles.installCard}`}>
          <div className={styles.installText}>
            <strong>Instalar o app</strong>
            <span className="muted">Acompanhe o resumo direto da tela inicial.</span>
          </div>
          <InstallButton className="btn btn-primary" label="Instalar" iconSize={18} />
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
