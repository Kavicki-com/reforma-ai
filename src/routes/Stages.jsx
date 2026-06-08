import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { useProject } from '../lib/useProject'
import { money, dateBR } from '../lib/format'
import Spinner from '../components/Spinner'
import Icon from '../components/Icon'
import BottomSheet from '../components/BottomSheet'
import KebabMenu from '../components/KebabMenu'
import styles from './Stages.module.css'

const STATUS_LABEL = { pendente: 'Pendente', em_andamento: 'Em andamento', pausada: 'Pausada', concluida: 'Concluída' }
const STATUS_BADGE = { pendente: 'badge-pending', em_andamento: 'badge-info', pausada: 'badge-muted', concluida: 'badge-paid' }
const emptyStage = { name: '', budget: '', start_date: '', end_date: '', status: 'pendente' }

export default function Stages() {
  const { isAdmin } = useAuth()
  const { project } = useProject()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // null = fechado | 'new' | id
  const [form, setForm] = useState(emptyStage)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    if (!project) { setRows([]); setLoading(false); return }
    setLoading(true)
    supabase
      .from('v_stage_totals')
      .select('*')
      .eq('project_id', project.id)
      .order('start_date', { ascending: true, nullsFirst: false })
      .then(({ data }) => { setRows(data || []); setLoading(false) })
  }, [project])

  useEffect(() => { load() }, [load])

  function startNew() {
    setForm(emptyStage)
    setEditing('new')
  }
  function startEdit(r) {
    setForm({
      name: r.name || '',
      budget: String(r.budget ?? ''),
      start_date: r.start_date || '',
      end_date: r.end_date || '',
      status: r.status || 'pendente',
    })
    setEditing(r.stage_id)
  }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      project_id: project?.id,
      name: form.name.trim(),
      budget: Number(form.budget || 0),
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      status: form.status,
    }
    if (editing === 'new') {
      await supabase.from('stages').insert(payload)
    } else {
      await supabase.from('stages').update(payload).eq('id', editing)
    }
    setSaving(false)
    setEditing(null)
    setLoading(true)
    load()
  }

  async function changeStatus(r, status, completedAt = null) {
    await supabase.from('stages')
      .update({ status, completed_at: completedAt })
      .eq('id', r.stage_id)
    setLoading(true)
    load()
  }

  async function remove(stageId) {
    if (!confirm('Excluir esta etapa?')) return
    await supabase.from('stages').delete().eq('id', stageId)
    setLoading(true)
    load()
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Etapas</h1>
      </div>

      {loading ? (
        <div className="spinner-wrap"><Spinner /></div>
      ) : rows.length === 0 ? (
        <div className="empty"><Icon name="calendar_month" />Nenhuma etapa cadastrada.</div>
      ) : (
        <div className={styles.grid}>
          {rows.map((r) => {
            const done = r.status === 'concluida'
            return (
              <div key={r.stage_id} className={`card ${styles.stageCard}`}>
                <div className={styles.head}>
                  <div className={styles.titleBlock}>
                    <span className={`badge ${STATUS_BADGE[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                    <strong>{r.name}</strong>
                  </div>
                  {isAdmin && (
                    <KebabMenu
                      items={[
                        { label: 'Editar', icon: 'edit', onClick: () => startEdit(r) },
                        { label: 'Excluir', icon: 'delete', danger: true, onClick: () => remove(r.stage_id) },
                      ]}
                    />
                  )}
                </div>
                <div className={styles.dates}>
                  {dateBR(r.start_date)} → {dateBR(r.completed_at || r.end_date)}
                  {done && r.completed_at && <span className={styles.doneTag}> · concluída em {dateBR(r.completed_at)}</span>}
                </div>
                {r.budget > 0 && (
                  <div className={styles.money}>
                    <span className="muted">Orçamento da etapa: <strong>{money(r.budget)}</strong></span>
                  </div>
                )}
                {isAdmin && (
                  <div className={styles.stageActions}>
                    {r.status === 'pendente' && (
                      <button
                        className="btn btn-ghost btn-block btn-sm"
                        onClick={() => changeStatus(r, 'em_andamento')}
                      >
                        <Icon name="play_arrow" size={18} /> Iniciar etapa
                      </button>
                    )}
                    {r.status === 'em_andamento' && (
                      <>
                        <button
                          className="btn btn-primary btn-block btn-sm"
                          onClick={() => changeStatus(r, 'concluida', new Date().toISOString().slice(0, 10))}
                        >
                          <Icon name="check_circle" size={18} /> Confirmar conclusão
                        </button>
                        <button
                          className="btn btn-ghost btn-block btn-sm"
                          onClick={() => changeStatus(r, 'pausada')}
                        >
                          <Icon name="pause" size={18} /> Pausar etapa
                        </button>
                      </>
                    )}
                    {r.status === 'pausada' && (
                      <button
                        className="btn btn-ghost btn-block btn-sm"
                        onClick={() => changeStatus(r, 'em_andamento')}
                      >
                        <Icon name="play_arrow" size={18} /> Retomar etapa
                      </button>
                    )}
                    {r.status === 'concluida' && (
                      <button
                        className="btn btn-ghost btn-block btn-sm"
                        onClick={() => changeStatus(r, 'em_andamento', null)}
                      >
                        <Icon name="undo" size={18} /> Reabrir etapa
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {isAdmin && (
        <button className="btn-fab" aria-label="Nova etapa" onClick={startNew}>
          <Icon name="add" size={28} />
        </button>
      )}

      {isAdmin && (
        <BottomSheet
          open={editing !== null}
          onClose={() => setEditing(null)}
          title={editing === 'new' ? 'Nova etapa' : 'Editar etapa'}
        >
          <form className="stack" onSubmit={save}>
            <div className="field">
              <label>Nome da etapa</label>
              <input className="input" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
            </div>
            <div className="row">
              <div className="field">
                <label>Orçamento (R$)</label>
                <input className="input" type="number" step="0.01" min="0" value={form.budget}
                  onChange={(e) => setForm({ ...form, budget: e.target.value })} />
              </div>
              <div className="field">
                <label>Status</label>
                <select className="select" value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label>Início</label>
                <input className="input" type="date" value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="field">
                <label>Previsão de fim</label>
                <input className="input" type="date" value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <button className="btn btn-primary btn-block" disabled={saving}>
              {saving ? <Spinner small /> : 'Salvar'}
            </button>
          </form>
        </BottomSheet>
      )}
    </div>
  )
}
