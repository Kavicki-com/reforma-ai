import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useInstallPrompt } from '../lib/useInstallPrompt'
import { money, dateBR } from '../lib/format'
import ProgressBar from '../components/ProgressBar'
import Donut from '../components/Donut'
import Spinner from '../components/Spinner'
import Icon from '../components/Icon'
import Accordion from '../components/Accordion'
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

const ENTRY_STATUS = {
  paid: { label: 'pago', cls: 'badge-paid' },
  partial: { label: 'parcial', cls: 'badge-info' },
  pending: { label: 'a pagar', cls: 'badge-pending' },
}

const remainingOf = (e) => Math.max(0, Number(e.amount) - Number(e.paid_amount || 0))

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
  const [lightbox, setLightbox] = useState(null) // índice da foto aberta | null
  const photosRef = useRef(null)
  const [docsMaxH, setDocsMaxH] = useState(null) // altura da coluna de fotos (desktop)
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

  // No desktop, a lista de documentos é limitada à altura da coluna de fotos
  // (rolagem interna). Mede a coluna de fotos e reaplica em resize.
  useEffect(() => {
    if (!data?.has_protected_docs) return
    const mq = window.matchMedia('(min-width: 1024px)')
    const update = () => {
      const el = photosRef.current
      setDocsMaxH(mq.matches && el ? el.offsetHeight : null)
    }
    update()
    const ro = photosRef.current ? new ResizeObserver(update) : null
    if (ro && photosRef.current) ro.observe(photosRef.current)
    window.addEventListener('resize', update)
    return () => { ro?.disconnect(); window.removeEventListener('resize', update) }
  }, [data, photoUrls])

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

  const allPhotos = photoGroups.flatMap((g) => g.items)
  const photoIndex = new Map(allPhotos.map((p, i) => [p.file_path, i]))
  const visibleGroups = photoGroups.slice(0, 3)
  const hiddenPhotos = allPhotos.length - visibleGroups.reduce((n, g) => n + g.items.length, 0)

  return (
    <div className="page">
      <header className={styles.header}>
        <div className={styles.brand}><img className={styles.brandLogo} src={logo} alt="" /> Krovo</div>
        <h1>{data.project?.name || 'Obra'}</h1>
        <span className="muted">Resumo da obra · somente leitura</span>
      </header>

      <div className={styles.layout}>
        <div className={styles.kpis}>
          <div className={`card ${styles.progressCard} ${styles.cProgress}`}>
            <div className={styles.progressHead}>
              <span className="muted">Progresso da obra</span>
              <strong className={styles.progressPct}>{data.progress}%</strong>
            </div>
            <ProgressBar value={data.progress} />
          </div>

          <Stat label="Gasto" value={money(spent)} tone="paid" cellClass={styles.cGasto} />
          <Stat label="A pagar" value={money(toPay)} tone="pending" cellClass={styles.cPagar} />
          <Stat label="Custo estimado" value={money(t.estimated_total)} cellClass={styles.cEstimated} />

          <div className={`card ${styles.donutCard} ${styles.cStagesDonut}`}>
            <Donut value={stagesPct} center={`${stagesPct}%`} size={92} />
            <span className={styles.statLabel}>Etapas concluídas</span>
            <span className={styles.statHint}>{stagesDone} de {data.stages.length}</span>
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

        <section>
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
        </section>

        <section>
          <h2 className={styles.section}>Gastos por categoria</h2>
          {data.categories.length === 0 ? (
            <p className="muted">Sem gastos registrados.</p>
          ) : (
            <div className={styles.catList}>
              {data.categories.map((c, i) => (
                <Accordion
                  key={i}
                  defaultOpen={i === 0}
                  title={
                    <span className={styles.catHead}>
                      <span className={styles.catName}>{c.category_name}</span>
                      <strong className={styles.catTotal}>{money(c.total_expense)}</strong>
                    </span>
                  }
                >
                  <CategoryBody category={c} />
                </Accordion>
              ))}
            </div>
          )}
        </section>

        <div className={`${styles.bottomGrid} ${data.has_protected_docs ? styles.twoCol : ''}`}>
          <section ref={photosRef}>
            <h2 className={styles.section}>Fotos da obra</h2>
            {photoGroups.length === 0 ? (
              <p className="muted">Nenhuma foto registrada.</p>
            ) : (
              <>
                <div className={styles.photoDays}>
                  {visibleGroups.map((g) => (
                    <section key={g.day}>
                      <h3 className={styles.photoDayHeader}>{dateBR(g.day)}</h3>
                      <div className={styles.photoGrid}>
                        {g.items.map((p, i) => (
                          <button
                            key={i}
                            type="button"
                            className={styles.photoCell}
                            onClick={() => setLightbox(photoIndex.get(p.file_path))}
                          >
                            {photoUrls[p.file_path] ? (
                              <img src={photoUrls[p.file_path]} alt={p.caption || 'foto da obra'} loading="lazy" decoding="async" />
                            ) : (
                              <div className={styles.photoPlaceholder}><Spinner small /></div>
                            )}
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
                {hiddenPhotos > 0 && (
                  <button type="button" className={`btn ${styles.seeAll}`} onClick={() => setLightbox(0)}>
                    <Icon name="photo_library" size={18} /> Ver todas as fotos ({allPhotos.length})
                  </button>
                )}
              </>
            )}
          </section>

          {data.has_protected_docs && <ProtectedDocs token={token} maxHeight={docsMaxH} />}
        </div>

        {!installed && (
          <div className={`card ${styles.installCard}`}>
            <div className={styles.installText}>
              <strong>Instalar o app</strong>
              <span className="muted">Acompanhe o resumo direto da tela inicial.</span>
            </div>
            <InstallButton className="btn btn-primary" label="Instalar" iconSize={18} />
          </div>
        )}
      </div>

      {lightbox != null && allPhotos[lightbox] && (
        <Lightbox
          photos={allPhotos}
          urls={photoUrls}
          index={lightbox}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
        />
      )}

      <footer className={styles.footer}>Gerado por Krovo</footer>
      <CompanyFooter />
    </div>
  )
}

function Lightbox({ photos, urls, index, onIndex, onClose }) {
  const go = (i) => onIndex(Math.max(0, Math.min(i, photos.length - 1)))
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') onIndex((i) => Math.min(i + 1, photos.length - 1))
      else if (e.key === 'ArrowLeft') onIndex((i) => Math.max(i - 1, 0))
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [photos.length, onIndex, onClose])

  const p = photos[index]
  const url = urls[p.file_path]
  return (
    <div className={styles.lb} onClick={onClose}>
      <button className={styles.lbClose} onClick={onClose} aria-label="Fechar">
        <Icon name="close" size={24} />
      </button>
      {index > 0 && (
        <button className={`${styles.lbNav} ${styles.lbPrev}`} onClick={(e) => { e.stopPropagation(); go(index - 1) }} aria-label="Anterior">
          <Icon name="arrow_back" size={24} />
        </button>
      )}
      <figure className={styles.lbStage} onClick={(e) => e.stopPropagation()}>
        {url ? (
          <img src={url} alt={p.caption || 'foto da obra'} />
        ) : (
          <Spinner />
        )}
        <figcaption className={styles.lbMeta}>
          <span>{dateBR(p.taken_at || p.created_at)}</span>
          <span>{index + 1} / {photos.length}</span>
        </figcaption>
      </figure>
      {index < photos.length - 1 && (
        <button className={`${styles.lbNav} ${styles.lbNext}`} onClick={(e) => { e.stopPropagation(); go(index + 1) }} aria-label="Próxima">
          <Icon name="arrow_forward" size={24} />
        </button>
      )}
    </div>
  )
}

function Stat({ label, value, tone, cellClass }) {
  return (
    <div className={`card ${styles.stat} ${cellClass || ''}`}>
      <span className={styles.statLabel}>{label}</span>
      <strong className={`${styles.statValue} ${tone ? styles[tone] : ''}`}>{value}</strong>
    </div>
  )
}

function CategoryBody({ category }) {
  const items = category.items || []
  const materials = category.materials || []
  if (items.length === 0 && materials.length === 0) {
    return <p className="muted">Sem lançamentos nesta categoria.</p>
  }
  return (
    <>
      {items.length > 0 && (
        <div className={styles.entryList}>
          {items.map((e, j) => {
            const st = ENTRY_STATUS[e.status] || ENTRY_STATUS.pending
            const remaining = remainingOf(e)
            return (
              <div key={j} className={styles.entryRow}>
                <div className={styles.entryMain}>
                  <strong className={styles.entryDesc}>{e.description}</strong>
                  <span className="muted">
                    {dateBR(e.entry_date)}
                    {e.payee ? ` · ${e.payee}` : ''}
                    {e.type === 'reimbursement' ? ' · reembolso' : ''}
                  </span>
                </div>
                <div className={styles.entryRight}>
                  <strong className={styles.entryAmount}>{money(e.amount)}</strong>
                  <span className={`badge ${st.cls}`}>{st.label}</span>
                  {e.status === 'partial' && (
                    <span className={styles.entryHint}>falta {money(remaining)}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {materials.length > 0 && (
        <div className={styles.matBlock}>
          {items.length > 0 && <span className={styles.subLabel}>Materiais</span>}
          {materials.map((mi, i) => (
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
    </>
  )
}

const DOC_KIND_LABEL = {
  nota_fiscal: 'Nota fiscal',
  comprovante: 'Comprovante',
  outro: 'Documento',
}

function ProtectedDocs({ token, maxHeight }) {
  const [unlocked, setUnlocked] = useState(false)
  const [docs, setDocs] = useState([])
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function unlock(e) {
    e.preventDefault()
    if (!pw || busy) return
    setBusy(true); setError('')
    const { data, error: err } = await supabase.functions.invoke('public-docs', { body: { token, password: pw } })
    setBusy(false)
    if (err || !data?.ok) { setError('Senha incorreta.'); return }
    setDocs(data.documents || [])
    setUnlocked(true)
  }

  if (unlocked) {
    return (
      <section className={styles.docsCol} style={maxHeight ? { height: maxHeight } : undefined}>
        <h2 className={styles.section}>Notas e comprovantes</h2>
        {docs.length === 0 ? (
          <p className="muted">Nenhum documento.</p>
        ) : (
          <div className={styles.docList}>
            {docs.map((d) => <ProtectedDocRow key={d.id} doc={d} />)}
          </div>
        )}
      </section>
    )
  }

  return (
    <section>
      <h2 className={styles.section}>Notas e comprovantes</h2>
      <div className={styles.lockWrap}>
        <div className={styles.lockBlur} aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={`card ${styles.skeleton}`}>
              <span className={styles.skIcon} />
              <span className={styles.skBody}><span className={styles.skLine} /><span className={styles.skLineSm} /></span>
            </div>
          ))}
        </div>
        <form className={styles.lockOverlay} onSubmit={unlock}>
          <Icon name="lock" size={28} className={styles.lockIcon} />
          <strong>Conteúdo protegido</strong>
          <span className="muted">Digite a senha para ver as notas e comprovantes.</span>
          <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)}
            placeholder="Senha" autoComplete="off" />
          {error && <span className={styles.lockError}>{error}</span>}
          <button className="btn btn-primary btn-block" disabled={busy || !pw}>
            {busy ? <Spinner small /> : 'Ver documentos'}
          </button>
        </form>
      </div>
    </section>
  )
}

function ProtectedDocRow({ doc }) {
  const open = () => { if (doc.signedUrl) window.open(doc.signedUrl, '_blank', 'noopener') }
  const links = [...(doc.items || []), ...(doc.entries || [])]
  const meta = [
    DOC_KIND_LABEL[doc.kind] || 'Documento',
    doc.doc_date ? dateBR(doc.doc_date) : null,
    doc.party || null,
    doc.amount != null ? money(doc.amount) : null,
  ].filter(Boolean).join(' · ')
  return (
    <button type="button" className={`card ${styles.docRow}`} onClick={open} disabled={!doc.signedUrl}>
      <Icon name="description" size={20} className={styles.docIcon} />
      <div className={styles.docBody}>
        <span className={styles.docName}>{doc.title || doc.file_name}</span>
        <span className={styles.docSub}>{meta}</span>
        {links.length > 0 && <span className={styles.docSub}>Relacionado: {links.join(', ')}</span>}
      </div>
      <Icon name="open_in_new" size={16} className={styles.docOpen} />
    </button>
  )
}
