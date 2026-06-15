import { useState } from 'react'
import { useProjects } from '../lib/ProjectContext'
import { useAuth } from '../auth/AuthProvider'
import BottomSheet from './BottomSheet'
import Spinner from './Spinner'
import Icon from './Icon'
import styles from './ProjectSwitcher.module.css'

const STATUS_LABEL = {
  planejamento: 'Planejamento',
  em_andamento: 'Em andamento',
  pausada: 'Pausada',
  concluida: 'Concluída',
}
const STATUS_BADGE = {
  planejamento: 'badge-info',
  em_andamento: 'badge-info',
  pausada: 'badge-pending',
  concluida: 'badge-paid',
}

const FILTERS = [
  { key: 'andamento', label: 'Em andamento' },
  { key: 'concluida', label: 'Concluídas' },
  { key: 'todas', label: 'Todas' },
]

const emptyForm = { name: '', budget_total: '' }

export default function ProjectSwitcher({ onNavigate }) {
  const {
    projects, activeProject, setActiveProject, createProject, deleteProject,
    activeCount, maxActive, canCreate,
  } = useProjects()
  const { isAdmin } = useAuth()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('andamento')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  function closePanel() {
    setOpen(false)
    setCreating(false)
    setForm(emptyForm)
    setError('')
  }

  function pick(id) {
    setActiveProject(id)
    closePanel()
    onNavigate?.()
  }

  async function askDelete(p) {
    const ok = confirm(
      `Excluir a obra "${p.name}" e TODOS os seus dados (custos, etapas, materiais, fotos)?\n\nEsta ação não pode ser desfeita.`,
    )
    if (!ok) return
    setBusyId(p.id)
    setError('')
    const { error: err } = await deleteProject(p.id)
    setBusyId(null)
    if (err) { setError(err); return }
    // Sem obras restantes: fecha o painel (o onboarding assume a tela).
    if (projects.length <= 1) closePanel()
  }

  async function submitNew(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { error: err } = await createProject(form)
    setSaving(false)
    if (err === 'limit') {
      setError(`Você atingiu o limite de ${maxActive} obras simultâneas do seu plano. Conclua uma obra ou faça upgrade para o plano anual.`)
      return
    }
    if (err) { setError(err); return }
    closePanel()
    onNavigate?.()
  }

  const filtered = projects.filter((p) => {
    if (filter === 'todas') return true
    if (filter === 'concluida') return p.status === 'concluida'
    return p.status !== 'concluida'
  })

  return (
    <>
      <button type="button" id="obras-trocar" className={styles.trigger} onClick={() => setOpen(true)} aria-label="Trocar de obra">
        <Icon name="domain" size={20} className={styles.triggerIcon} />
        <span className={styles.triggerName}>{activeProject?.name || 'Selecionar obra'}</span>
        <Icon name="unfold_more" size={18} className={styles.triggerChevron} />
      </button>

      <BottomSheet open={open} onClose={closePanel} title="Suas obras">
        {creating ? (
          <form className="stack" onSubmit={submitNew}>
            <div className="field">
              <label>Nome da obra</label>
              <input className="input" value={form.name} autoFocus required
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Orçamento total (opcional)</label>
              <input className="input" type="number" step="0.01" min="0" value={form.budget_total}
                onChange={(e) => setForm({ ...form, budget_total: e.target.value })} />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <button id="obras-criar-salvar" className="btn btn-primary btn-block" disabled={saving}>
              {saving ? <Spinner small /> : 'Criar obra'}
            </button>
            <button type="button" id="obras-criar-voltar" className="btn btn-ghost btn-block" onClick={() => { setCreating(false); setError('') }}>
              Cancelar
            </button>
          </form>
        ) : (
          <div className="stack">
            <p className={styles.usage}>
              <strong>{activeCount}</strong> de <strong>{maxActive}</strong> obras simultâneas em uso
              <span className={styles.usageHint}> · obras concluídas não contam</span>
            </p>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.filters}>
              {FILTERS.map((f) => (
                <button key={f.key} type="button"
                  id={`obras-filtro-${f.key}`}
                  className={`${styles.chip} ${filter === f.key ? styles.chipActive : ''}`}
                  onClick={() => setFilter(f.key)}>
                  {f.label}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="empty"><Icon name="domain" />Nenhuma obra aqui.</div>
            ) : (
              <div className={styles.list}>
                {filtered.map((p) => {
                  const selected = p.id === activeProject?.id
                  return (
                    <div key={p.id} className={`${styles.row} ${selected ? styles.rowActive : ''}`}>
                      <button type="button" className={styles.rowSelect}
                        onClick={() => pick(p.id)} disabled={busyId === p.id}>
                        <div className={styles.rowMain}>
                          <strong>{p.name}</strong>
                          <span className={`badge ${STATUS_BADGE[p.status] || 'badge-info'}`}>
                            {STATUS_LABEL[p.status] || p.status}
                          </span>
                        </div>
                        {selected && <Icon name="check" size={20} className={styles.rowCheck} />}
                      </button>
                      {busyId === p.id ? (
                        <span className={styles.rowBusy}><Spinner small /></span>
                      ) : isAdmin && (
                        <button type="button" className={styles.rowDel}
                          onClick={() => askDelete(p)} aria-label={`Excluir obra ${p.name}`}>
                          <Icon name="delete" size={20} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {canCreate ? (
              <button type="button" id="obras-nova" className="btn btn-primary btn-block" onClick={() => setCreating(true)}>
                <Icon name="add" size={20} /> Nova obra
              </button>
            ) : (
              <div className={styles.limit}>
                <button type="button" className="btn btn-block" disabled>
                  <Icon name="add" size={20} /> Nova obra
                </button>
                <p className={styles.limitMsg}>
                  Limite de {maxActive} obras simultâneas atingido. Conclua uma obra ou faça upgrade para o plano anual.
                </p>
              </div>
            )}
          </div>
        )}
      </BottomSheet>
    </>
  )
}
