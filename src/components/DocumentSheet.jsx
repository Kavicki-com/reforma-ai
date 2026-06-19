import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useProject } from '../lib/useProject'
import { money, toDateInput } from '../lib/format'
import BottomSheet from './BottomSheet'
import Spinner from './Spinner'
import Icon from './Icon'
import styles from './DocumentSheet.module.css'

const KINDS = [
  { value: 'nota_fiscal', label: 'Nota fiscal' },
  { value: 'comprovante', label: 'Comprovante de pagamento' },
  { value: 'outro', label: 'Outro' },
]

const partyLabel = (kind) =>
  kind === 'nota_fiscal' ? 'Emissor da nota'
    : kind === 'comprovante' ? 'Recebedor do pagamento'
      : 'Emissor / recebedor'

const makeEmpty = () => ({
  kind: 'nota_fiscal',
  title: '',
  doc_date: new Date().toISOString().slice(0, 10),
  amount: '',
  party: '',
})

export default function DocumentSheet({ open, documentId, onClose, onSaved }) {
  const editing = Boolean(documentId)
  const { project } = useProject()

  const [form, setForm] = useState(makeEmpty())
  const [materials, setMaterials] = useState([])
  const [entries, setEntries] = useState([])
  const [selItems, setSelItems] = useState(() => new Set())
  const [selEntries, setSelEntries] = useState(() => new Set())
  const [existing, setExisting] = useState(null) // doc atual (arquivo já salvo)
  const [newFile, setNewFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Listas para os seletores
  useEffect(() => {
    if (!open || !project) return
    let active = true
    Promise.all([
      supabase.from('shopping_items').select('id, name, quantity, unit').eq('project_id', project.id).order('name'),
      supabase.from('entries').select('id, description, amount, entry_date').eq('project_id', project.id).order('entry_date', { ascending: false }),
    ]).then(([mats, ents]) => {
      if (!active) return
      setMaterials(mats.data || [])
      setEntries(ents.data || [])
    })
    return () => { active = false }
  }, [open, project])

  // Carrega documento em edição
  useEffect(() => {
    if (!open) return
    setError('')
    setNewFile(null)
    if (!documentId) {
      setForm(makeEmpty())
      setExisting(null)
      setSelItems(new Set())
      setSelEntries(new Set())
      return
    }
    let active = true
    setLoading(true)
    supabase
      .from('documents')
      .select('*, document_items(shopping_item_id), document_entries(entry_id)')
      .eq('id', documentId)
      .single()
      .then(({ data }) => {
        if (!active || !data) return
        setForm({
          kind: data.kind || 'outro',
          title: data.title || '',
          doc_date: toDateInput(data.doc_date) || '',
          amount: String(data.amount ?? ''),
          party: data.party || '',
        })
        setExisting(data)
        setSelItems(new Set((data.document_items || []).map((d) => d.shopping_item_id)))
        setSelEntries(new Set((data.document_entries || []).map((d) => d.entry_id)))
        setLoading(false)
      })
    return () => { active = false }
  }, [open, documentId])

  function set(key, value) { setForm((f) => ({ ...f, [key]: value })) }
  const toggle = (setFn) => (id) => setFn((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  async function syncLinks(docId) {
    await supabase.from('document_items').delete().eq('document_id', docId)
    await supabase.from('document_entries').delete().eq('document_id', docId)
    const itemRows = [...selItems].map((shopping_item_id) => ({ document_id: docId, shopping_item_id }))
    const entryRows = [...selEntries].map((entry_id) => ({ document_id: docId, entry_id }))
    if (itemRows.length) {
      const { error } = await supabase.from('document_items').insert(itemRows)
      if (error) throw error
    }
    if (entryRows.length) {
      const { error } = await supabase.from('document_entries').insert(entryRows)
      if (error) throw error
    }
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (!editing && !newFile) { setError('Anexe o arquivo do documento.'); return }
    setSaving(true)
    try {
      const fields = {
        kind: form.kind,
        title: form.title.trim() || null,
        doc_date: form.doc_date || null,
        amount: form.amount === '' ? null : Number(form.amount),
        party: form.party.trim() || null,
      }

      let docId = documentId
      let oldPath = existing?.file_path

      // Upload do arquivo (novo doc, ou troca de arquivo na edição)
      let fileFields = {}
      if (newFile) {
        const path = `${project.id}/${crypto.randomUUID()}-${newFile.name}`
        const up = await supabase.storage.from('documentos').upload(path, newFile)
        if (up.error) throw up.error
        fileFields = { file_path: path, file_name: newFile.name, mime_type: newFile.type, size_bytes: newFile.size }
      }

      if (editing) {
        const { error } = await supabase.from('documents').update({ ...fields, ...fileFields }).eq('id', documentId)
        if (error) throw error
        if (newFile && oldPath) await supabase.storage.from('documentos').remove([oldPath])
      } else {
        const { data, error } = await supabase
          .from('documents')
          .insert({ project_id: project.id, ...fields, ...fileFields })
          .select('id')
          .single()
        if (error) throw error
        docId = data.id
      }

      await syncLinks(docId)

      setSaving(false)
      onSaved?.()
      onClose()
    } catch (err) {
      setError(err.message || 'Erro ao salvar.')
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!confirm('Excluir este documento?')) return
    setSaving(true)
    try {
      if (existing?.file_path) await supabase.storage.from('documentos').remove([existing.file_path])
      const { error } = await supabase.from('documents').delete().eq('id', documentId)
      if (error) throw error
      setSaving(false)
      onSaved?.()
      onClose()
    } catch (err) {
      setError(err.message); setSaving(false)
    }
  }

  async function openFile() {
    if (!existing?.file_path) return
    const { data } = await supabase.storage.from('documentos').createSignedUrl(existing.file_path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener')
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={editing ? 'Editar documento' : 'Novo documento'}>
      {loading ? (
        <div className="spinner-wrap"><Spinner /></div>
      ) : (
        <form className="stack" onSubmit={onSubmit}>
          <div className="field">
            <label>Tipo</label>
            <select className="select" value={form.kind} onChange={(e) => set('kind', e.target.value)}>
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Título</label>
            <input className="input" value={form.title} onChange={(e) => set('title', e.target.value)}
              placeholder="Ex.: NF cimento Votoran" autoFocus />
          </div>

          <div className="row">
            <div className="field">
              <label>Valor (R$)</label>
              <input className="input" type="number" step="0.01" min="0" inputMode="decimal"
                value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="Opcional" />
            </div>
            <div className="field">
              <label>Data do documento</label>
              <input className="input" type="date" value={form.doc_date}
                onChange={(e) => set('doc_date', e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>{partyLabel(form.kind)}</label>
            <input className="input" value={form.party} onChange={(e) => set('party', e.target.value)}
              placeholder="Opcional" />
          </div>

          <div className="field">
            <label>Arquivo {editing && '(deixe em branco para manter o atual)'}</label>
            {existing?.file_name && !newFile && (
              <button type="button" className={styles.fileCurrent} onClick={openFile}>
                <Icon name="description" size={18} /> {existing.file_name}
              </button>
            )}
            <label className={styles.fileBtn}>
              <Icon name="attach_file" size={20} /> {newFile ? newFile.name : 'Anexar arquivo'}
              <input type="file" accept="image/*,application/pdf" hidden
                onChange={(e) => setNewFile(e.target.files[0] || null)} />
            </label>
          </div>

          <Picker
            label="Materiais relacionados"
            options={materials}
            selected={selItems}
            onToggle={toggle(setSelItems)}
            render={(m) => `${m.name}${m.quantity ? ` · ${Number(m.quantity)} ${m.unit || ''}`.trim() : ''}`}
          />

          <Picker
            label="Custos relacionados"
            options={entries}
            selected={selEntries}
            onToggle={toggle(setSelEntries)}
            render={(e) => `${e.description} · ${money(e.amount)}`}
          />

          {error && <p className={styles.error}>{error}</p>}

          <button className="btn btn-primary btn-block" disabled={saving}>
            {saving ? <Spinner small /> : 'Salvar'}
          </button>
          {editing && (
            <button type="button" className="btn btn-danger btn-block" onClick={onDelete} disabled={saving}>
              Excluir documento
            </button>
          )}
        </form>
      )}
    </BottomSheet>
  )
}

function Picker({ label, options, selected, onToggle, render }) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return options
    return options.filter((o) => render(o).toLowerCase().includes(term))
  }, [q, options, render])

  return (
    <div className="field">
      <label>{label} {selected.size > 0 && <span className={styles.count}>({selected.size})</span>}</label>
      {options.length === 0 ? (
        <span className="muted" style={{ fontSize: '.82rem' }}>Nada para vincular ainda.</span>
      ) : (
        <>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" />
          <div className={styles.picker}>
            {filtered.map((o) => (
              <label key={o.id} className={styles.pickRow}>
                <input type="checkbox" checked={selected.has(o.id)} onChange={() => onToggle(o.id)} />
                <span>{render(o)}</span>
              </label>
            ))}
            {filtered.length === 0 && <span className="muted" style={{ fontSize: '.82rem' }}>Nada encontrado.</span>}
          </div>
        </>
      )}
    </div>
  )
}
