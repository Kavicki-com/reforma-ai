import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { useProject } from '../lib/useProject'
import { money, dateBR } from '../lib/format'
import Spinner from '../components/Spinner'
import Icon from '../components/Icon'
import DocumentSheet from '../components/DocumentSheet'
import styles from './Documentos.module.css'

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'nota_fiscal', label: 'Notas fiscais' },
  { key: 'comprovante', label: 'Comprovantes' },
  { key: 'outro', label: 'Outros' },
]

const KIND_BADGE = {
  nota_fiscal: { cls: 'badge-info', label: 'Nota fiscal' },
  comprovante: { cls: 'badge-paid', label: 'Comprovante' },
  outro: { cls: 'badge-muted', label: 'Outro' },
}

export default function Documentos() {
  const { isAdmin } = useAuth()
  const { project } = useProject()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [sheet, setSheet] = useState(null) // null | 'new' | <id>

  const load = useCallback(() => {
    if (!project) { setDocs([]); setLoading(false); return }
    setLoading(true)
    supabase
      .from('documents')
      .select('*, document_items(shopping_items(name)), document_entries(entries(description))')
      .eq('project_id', project.id)
      .order('doc_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => { setDocs(data || []); setLoading(false) })
  }, [project])

  useEffect(() => { load() }, [load])

  const filtered = docs.filter((d) => filter === 'all' || d.kind === filter)

  async function openFile(doc) {
    const { data } = await supabase.storage.from('documentos').createSignedUrl(doc.file_path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener')
  }

  function onCardClick(doc) {
    if (isAdmin) setSheet(doc.id)
    else openFile(doc)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Notas e comprovantes</h1>
      </div>

      <div className={styles.filters}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`${styles.chip} ${filter === f.key ? styles.chipActive : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="spinner-wrap"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <Icon name="description" />
          Nenhum documento aqui ainda.
        </div>
      ) : (
        <div className="stack">
          {filtered.map((d) => {
            const badge = KIND_BADGE[d.kind] || KIND_BADGE.outro
            const links = [
              ...(d.document_items || []).map((x) => x.shopping_items?.name).filter(Boolean),
              ...(d.document_entries || []).map((x) => x.entries?.description).filter(Boolean),
            ]
            return (
              <button key={d.id} type="button" className={`card ${styles.item}`} onClick={() => onCardClick(d)}>
                <Icon name="description" size={22} className={styles.fileIcon} />
                <div className={styles.main}>
                  <strong className={styles.title}>{d.title || d.file_name}</strong>
                  <span className={styles.meta}>
                    <span className={`badge ${badge.cls}`}>{badge.label}</span>
                    {d.doc_date ? ` ${dateBR(d.doc_date)}` : ''}
                    {d.party ? ` · ${d.party}` : ''}
                  </span>
                  {links.length > 0 && (
                    <span className={styles.links}>Relacionado: {links.join(', ')}</span>
                  )}
                </div>
                <div className={styles.right}>
                  {d.amount != null && <strong className={styles.amount}>{money(d.amount)}</strong>}
                  <span
                    className={styles.openBtn}
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => { e.stopPropagation(); openFile(d) }}
                    aria-label="Abrir arquivo"
                  >
                    <Icon name="open_in_new" size={18} />
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {isAdmin && (
        <>
          <button className="btn-fab" aria-label="Novo documento" onClick={() => setSheet('new')}>
            <Icon name="add" size={28} />
          </button>
          <DocumentSheet
            open={sheet !== null}
            documentId={sheet === 'new' ? null : sheet}
            onClose={() => setSheet(null)}
            onSaved={load}
          />
        </>
      )}
    </div>
  )
}
