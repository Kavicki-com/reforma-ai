import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { useProject } from '../lib/useProject'
import { toDateInput } from '../lib/format'
import BottomSheet from './BottomSheet'
import Spinner from './Spinner'
import Icon from './Icon'
import styles from './EntrySheet.module.css'

const makeEmpty = () => ({
  description: '',
  amount: '',
  category_id: '',
  stage_id: '',
  type: 'expense',
  status: 'paid',
  paid_amount: '',
  payee: '',
  entry_date: new Date().toISOString().slice(0, 10),
})

export default function EntrySheet({ open, entryId, onClose, onSaved }) {
  const editing = Boolean(entryId)
  const { user } = useAuth()
  const { project } = useProject()

  const [form, setForm] = useState(makeEmpty())
  const [categories, setCategories] = useState([])
  const [stages, setStages] = useState([])
  const [attachments, setAttachments] = useState([])
  const [newFiles, setNewFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Carrega categorias (globais) e etapas da obra ativa ao abrir
  useEffect(() => {
    if (!open || !project) return
    let active = true
    Promise.all([
      supabase.from('categories').select('id, name').order('name'),
      supabase.from('stages').select('id, name').eq('project_id', project.id).order('sort_order'),
    ]).then(([cats, sts]) => {
      if (!active) return
      setCategories(cats.data || [])
      setStages(sts.data || [])
    })
    return () => { active = false }
  }, [open, project])

  // Prepara o formulario quando abre (novo => limpa; edicao => carrega)
  useEffect(() => {
    if (!open) return
    setError('')
    setNewFiles([])
    if (!entryId) {
      setForm(makeEmpty())
      setAttachments([])
      return
    }
    let active = true
    setLoading(true)
    supabase
      .from('entries')
      .select('*, attachments(*)')
      .eq('id', entryId)
      .single()
      .then(({ data }) => {
        if (!active || !data) return
        setForm({
          description: data.description || '',
          amount: String(data.amount ?? ''),
          category_id: data.category_id || '',
          stage_id: data.stage_id || '',
          type: data.type,
          status: data.status,
          paid_amount: String(data.paid_amount ?? ''),
          payee: data.payee || '',
          entry_date: toDateInput(data.entry_date),
        })
        setAttachments(data.attachments || [])
        setLoading(false)
      })
    return () => { active = false }
  }, [open, entryId])

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function uploadFiles(id, files) {
    for (const file of files) {
      const path = `${id}/${crypto.randomUUID()}-${file.name}`
      const up = await supabase.storage.from('notas').upload(path, file)
      if (up.error) throw up.error
      const ins = await supabase.from('attachments').insert({
        entry_id: id,
        file_path: path,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      })
      if (ins.error) throw ins.error
    }
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const amt = Number(form.amount || 0)
      let status = form.status
      let paid = 0
      if (status === 'paid') {
        paid = amt
      } else if (status === 'pending') {
        paid = 0
      } else { // partial
        paid = Math.min(amt, Math.max(0, Number(form.paid_amount || 0)))
        if (paid >= amt) status = 'paid'
        else if (paid <= 0) status = 'pending'
      }

      const payload = {
        project_id: project?.id,
        description: form.description.trim(),
        amount: amt,
        category_id: form.category_id || null,
        stage_id: form.stage_id || null,
        type: form.type,
        status,
        paid_amount: paid,
        payee: form.payee.trim() || null,
        entry_date: form.entry_date,
        paid_at: paid > 0 ? form.entry_date : null,
      }

      let id = entryId
      if (editing) {
        const { error } = await supabase.from('entries').update(payload).eq('id', entryId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('entries')
          .insert({ ...payload, created_by: user.id })
          .select('id')
          .single()
        if (error) throw error
        id = data.id
      }

      if (newFiles.length) await uploadFiles(id, newFiles)

      setSaving(false)
      onSaved?.()
      onClose()
    } catch (err) {
      setError(err.message || 'Erro ao salvar.')
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!confirm('Excluir este lançamento?')) return
    setSaving(true)
    const { error } = await supabase.from('entries').delete().eq('id', entryId)
    if (error) { setError(error.message); setSaving(false); return }
    setSaving(false)
    onSaved?.()
    onClose()
  }

  async function openAttachment(att) {
    const { data } = await supabase.storage.from('notas').createSignedUrl(att.file_path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function removeAttachment(att) {
    if (!confirm('Remover esta nota?')) return
    await supabase.storage.from('notas').remove([att.file_path])
    await supabase.from('attachments').delete().eq('id', att.id)
    setAttachments((a) => a.filter((x) => x.id !== att.id))
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={editing ? 'Editar lançamento' : 'Novo lançamento'}>
      {loading ? (
        <div className="spinner-wrap"><Spinner /></div>
      ) : (
        <form className="stack" onSubmit={onSubmit}>
          <div className="field">
            <label>Descrição</label>
            <input className="input" value={form.description}
              onChange={(e) => set('description', e.target.value)} required autoFocus />
          </div>

          <div className="row">
            <div className="field">
              <label>Valor (R$)</label>
              <input className="input" type="number" step="0.01" min="0" inputMode="decimal"
                value={form.amount} onChange={(e) => set('amount', e.target.value)} required />
            </div>
            <div className="field">
              <label>Data</label>
              <input className="input" type="date" value={form.entry_date}
                onChange={(e) => set('entry_date', e.target.value)} required />
            </div>
          </div>

          <div className="field">
            <label>Categoria</label>
            <select className="select" value={form.category_id}
              onChange={(e) => set('category_id', e.target.value)}>
              <option value="">Selecione…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Etapa (opcional)</label>
            <select className="select" value={form.stage_id}
              onChange={(e) => set('stage_id', e.target.value)}>
              <option value="">Sem etapa</option>
              {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="row">
            <div className="field">
              <label>Tipo</label>
              <select className="select" value={form.type} onChange={(e) => set('type', e.target.value)}>
                <option value="expense">Gasto</option>
                <option value="reimbursement">Reembolso</option>
              </select>
            </div>
            <div className="field">
              <label>Situação</label>
              <select className="select" value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="paid">Pago</option>
                <option value="partial">Parcial</option>
                <option value="pending">A pagar</option>
              </select>
            </div>
          </div>

          {form.status === 'partial' && (
            <div className="field">
              <label>Valor já pago (R$)</label>
              <input className="input" type="number" step="0.01" min="0" inputMode="decimal"
                value={form.paid_amount} onChange={(e) => set('paid_amount', e.target.value)} />
              <span className="muted" style={{ fontSize: '.8rem' }}>
                Falta pagar: {(() => {
                  const f = Math.max(0, Number(form.amount || 0) - Number(form.paid_amount || 0))
                  return f.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                })()}
              </span>
            </div>
          )}

          <div className="field">
            <label>Pessoa / fornecedor (ex.: pedreiro)</label>
            <input className="input" value={form.payee}
              onChange={(e) => set('payee', e.target.value)} placeholder="Opcional" />
          </div>

          <div className="field">
            <label>Notas fiscais / comprovantes</label>
            {attachments.length > 0 && (
              <div className={styles.attachList}>
                {attachments.map((a) => (
                  <div key={a.id} className={styles.attach}>
                    <button type="button" className={styles.attachName} onClick={() => openAttachment(a)}>
                      <Icon name="description" size={18} /> {a.file_name}
                    </button>
                    <button type="button" className={styles.attachDel} onClick={() => removeAttachment(a)}>
                      <Icon name="close" size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className={styles.fileBtn}>
              <Icon name="attach_file" size={20} /> Anexar arquivo
              <input type="file" accept="image/*,application/pdf" multiple hidden
                onChange={(e) => setNewFiles(Array.from(e.target.files))} />
            </label>
            {newFiles.length > 0 && (
              <span className="muted" style={{ fontSize: '.8rem' }}>
                {newFiles.length} arquivo(s) — serão enviados ao salvar
              </span>
            )}
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button id="lancamento-salvar" className="btn btn-primary btn-block" disabled={saving}>
            {saving ? <Spinner small /> : 'Salvar'}
          </button>
          {editing && (
            <button type="button" id="lancamento-excluir" className="btn btn-danger btn-block" onClick={onDelete} disabled={saving}>
              Excluir lançamento
            </button>
          )}
        </form>
      )}
    </BottomSheet>
  )
}
