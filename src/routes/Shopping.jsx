import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { useProject } from '../lib/useProject'
import { money } from '../lib/format'
import Spinner from '../components/Spinner'
import Icon from '../components/Icon'
import BottomSheet from '../components/BottomSheet'
import styles from './Shopping.module.css'

const emptyItem = { name: '', quantity: '1', unit: 'un', estimated_unit_price: '', status: 'a_comprar', category_id: '' }

export default function Shopping() {
  const { isAdmin, user } = useAuth()
  const { project } = useProject()
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // null = fechado | 'new' | id
  const [form, setForm] = useState(emptyItem)
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewItems, setReviewItems] = useState([])
  const aiInputRef = useRef(null)

  const load = useCallback(() => {
    if (!project) { setItems([]); setLoading(false); return }
    setLoading(true)
    supabase
      .from('shopping_items')
      .select('*')
      .eq('project_id', project.id)
      .order('status', { ascending: true })
      .order('created_at', { ascending: false })
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }, [project])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    supabase.from('categories').select('id, name').order('name')
      .then(({ data }) => setCategories(data || []))
  }, [])

  function startNew() {
    setForm(emptyItem)
    setEditing('new')
  }
  function startEdit(i) {
    setForm({
      name: i.name || '',
      quantity: String(i.quantity ?? '1'),
      unit: i.unit || 'un',
      estimated_unit_price: String(i.estimated_unit_price ?? ''),
      status: i.status || 'a_comprar',
      category_id: i.category_id || '',
    })
    setEditing(i.id)
  }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      project_id: project?.id,
      name: form.name.trim(),
      quantity: Number(form.quantity || 1),
      unit: form.unit.trim() || 'un',
      estimated_unit_price: Number(form.estimated_unit_price || 0),
      status: form.status,
      category_id: form.category_id || null,
    }
    if (editing === 'new') {
      await supabase.from('shopping_items').insert({ ...payload, created_by: user.id })
    } else {
      await supabase.from('shopping_items').update(payload).eq('id', editing)
    }
    setSaving(false)
    setEditing(null)
    setLoading(true)
    load()
  }

  async function toggle(item) {
    const next = item.status === 'a_comprar' ? 'comprado' : 'a_comprar'
    await supabase.from('shopping_items').update({ status: next }).eq('id', item.id)
    setItems((arr) => arr.map((x) => (x.id === item.id ? { ...x, status: next } : x)))
  }

  async function remove(item) {
    if (!confirm('Remover item?')) return
    await supabase.from('shopping_items').delete().eq('id', item.id)
    setItems((arr) => arr.filter((x) => x.id !== item.id))
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result).split(',')[1])
      r.onerror = reject
      r.readAsDataURL(file)
    })
  }

  // Lê uma nota fiscal com IA e adiciona os itens como materiais "comprado"
  async function onAiImport(e) {
    const file = e.target.files[0]
    if (!file || !project) return
    setAnalyzing(true)
    try {
      const base64 = await fileToBase64(file)
      const { data, error } = await supabase.functions.invoke('extract-invoice', {
        body: { image: base64, mimeType: file.type },
      })
      if (error) {
        let msg = error.message
        try { const b = await error.context.json(); msg = b?.error || msg } catch { /* sem corpo */ }
        throw new Error(msg)
      }
      if (!data?.ok) throw new Error(data?.error || 'Falha ao ler a nota.')
      const list = (data.data?.items || [])
        .filter((it) => it?.name)
        .map((it) => ({
          name: it.name,
          quantity: String(it.quantity ?? 1),
          unit: it.unit || 'un',
          unit_price: String(it.unit_price ?? 0),
        }))
      if (!list.length) { alert('Nenhum item identificado na nota.'); return }
      setReviewItems(list)
      setReviewOpen(true)
    } catch (err) {
      alert('Não foi possível ler a nota: ' + (err.message || err))
    } finally {
      setAnalyzing(false)
      e.target.value = ''
    }
  }

  function updateReview(i, key, val) {
    setReviewItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)))
  }
  function removeReview(i) {
    setReviewItems((arr) => arr.filter((_, idx) => idx !== i))
  }
  async function confirmReview() {
    if (!reviewItems.length || !project) { setReviewOpen(false); return }
    setSaving(true)
    await supabase.from('shopping_items').insert(
      reviewItems.map((it) => ({
        project_id: project.id,
        name: it.name.trim(),
        quantity: Number(it.quantity || 1),
        unit: it.unit.trim() || 'un',
        estimated_unit_price: Number(it.unit_price || 0),
        status: 'comprado',
        created_by: user.id,
      })),
    )
    setSaving(false)
    setReviewOpen(false)
    setReviewItems([])
    setLoading(true)
    load()
  }

  const toBuy = items.filter((i) => i.status === 'a_comprar')
  const bought = items.filter((i) => i.status === 'comprado')
  const totalToBuy = toBuy.reduce((s, i) => s + Number(i.estimated_total), 0)

  return (
    <div className="page">
      <div className="page-header">
        <h1>Materiais</h1>
      </div>

      <div className={`card ${styles.summary}`}>
        <span className="muted">Estimado a comprar</span>
        <strong>{money(totalToBuy)}</strong>
      </div>

      {isAdmin && (
        <>
          <button
            type="button"
            id="compras-importar-nota"
            className={styles.aiBtn}
            onClick={() => aiInputRef.current?.click()}
            disabled={analyzing}
          >
            {analyzing ? <Spinner small /> : <Icon name="auto_awesome" size={20} />}
            {analyzing ? 'Lendo nota fiscal…' : 'Importar nota fiscal com IA'}
          </button>
          <input ref={aiInputRef} type="file" accept="image/*,application/pdf" hidden onChange={onAiImport} />
        </>
      )}

      {loading ? (
        <div className="spinner-wrap"><Spinner /></div>
      ) : items.length === 0 ? (
        <div className="empty"><Icon name="shopping_cart" />Lista vazia.</div>
      ) : (
        <>
          <Section title={`A comprar (${toBuy.length})`} items={toBuy}
            isAdmin={isAdmin} onToggle={toggle} onEdit={startEdit} onRemove={remove} />
          <Section title={`Comprado (${bought.length})`} items={bought} bought
            isAdmin={isAdmin} onToggle={toggle} onEdit={startEdit} onRemove={remove} />
        </>
      )}

      {isAdmin && (
        <BottomSheet
          open={editing !== null}
          onClose={() => setEditing(null)}
          title={editing === 'new' ? 'Novo material' : 'Editar material'}
        >
          <form className="stack" onSubmit={save}>
            <div className="field">
              <label>Material</label>
              <input className="input" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
            </div>
            <div className="row">
              <div className="field">
                <label>Qtd</label>
                <input className="input" type="number" step="0.01" min="0" value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </div>
              <div className="field">
                <label>Unid.</label>
                <input className="input" value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              </div>
              <div className="field">
                <label>Preço un.</label>
                <input className="input" type="number" step="0.01" min="0" value={form.estimated_unit_price}
                  onChange={(e) => setForm({ ...form, estimated_unit_price: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>Categoria</label>
              <select className="select" value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">Sem categoria</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Situação</label>
              <select className="select" value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="a_comprar">A comprar</option>
                <option value="comprado">Comprado</option>
              </select>
            </div>
            <button id="compras-salvar" className="btn btn-primary btn-block" disabled={saving}>
              {saving ? <Spinner small /> : 'Salvar'}
            </button>
          </form>
        </BottomSheet>
      )}

      {isAdmin && (
        <BottomSheet open={reviewOpen} onClose={() => setReviewOpen(false)} title="Revisar itens da nota">
          <div className="stack">
            <p className="muted">
              {reviewItems.length} item(ns) lido(s). Confira e ajuste antes de salvar como comprados.
            </p>
            {reviewItems.map((it, i) => (
              <div key={i} className={styles.reviewItem}>
                <input
                  className="input"
                  value={it.name}
                  onChange={(e) => updateReview(i, 'name', e.target.value)}
                  placeholder="Material"
                />
                <div className={styles.reviewRow}>
                  <input className="input" type="number" step="0.01" min="0" value={it.quantity}
                    onChange={(e) => updateReview(i, 'quantity', e.target.value)} placeholder="Qtd" />
                  <input className="input" value={it.unit}
                    onChange={(e) => updateReview(i, 'unit', e.target.value)} placeholder="Un" />
                  <input className="input" type="number" step="0.01" min="0" value={it.unit_price}
                    onChange={(e) => updateReview(i, 'unit_price', e.target.value)} placeholder="Preço" />
                  <button type="button" className={styles.reviewDel} onClick={() => removeReview(i)} aria-label="remover item">
                    <Icon name="close" size={18} />
                  </button>
                </div>
              </div>
            ))}
            <button id="compras-confirmar-revisao" className="btn btn-primary btn-block" onClick={confirmReview} disabled={saving || !reviewItems.length}>
              {saving ? <Spinner small /> : `Salvar ${reviewItems.length} item(ns) como comprados`}
            </button>
          </div>
        </BottomSheet>
      )}

      {isAdmin && (
        <button id="compras-novo" className="btn-fab" aria-label="Novo material" onClick={startNew}>
          <Icon name="add" size={28} />
        </button>
      )}
    </div>
  )
}

function Section({ title, items, bought, isAdmin, onToggle, onEdit, onRemove }) {
  if (items.length === 0) return null
  return (
    <>
      <h2 className={styles.section}>{title}</h2>
      <div className="stack">
        {items.map((i) => (
          <div key={i.id} className={`card ${styles.item} ${bought ? styles.done : ''}`}>
            {isAdmin && (
              <button className={styles.check} onClick={() => onToggle(i)} aria-label="alternar status">
                <Icon name={bought ? 'check_box' : 'check_box_outline_blank'} size={26} fill={bought ? 1 : 0} />
              </button>
            )}
            <button
              type="button"
              className={styles.itemBody}
              onClick={() => isAdmin && onEdit(i)}
              disabled={!isAdmin}
            >
              <strong>{i.name}</strong>
              <span className="muted">
                {Number(i.quantity)} {i.unit} · {money(i.estimated_unit_price)}/un
              </span>
            </button>
            <div className={styles.itemRight}>
              <strong>{money(i.estimated_total)}</strong>
              {isAdmin && (
                <button className={styles.del} onClick={() => onRemove(i)} aria-label="remover">
                  <Icon name="close" size={18} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
