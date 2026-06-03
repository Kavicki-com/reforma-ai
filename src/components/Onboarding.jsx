import { useState } from 'react'
import { useProjects } from '../lib/ProjectContext'
import Spinner from './Spinner'
import Icon from './Icon'
import styles from './Onboarding.module.css'

// Mostrado quando o usuário ainda não tem nenhuma obra cadastrada.
export default function Onboarding() {
  const { createProject } = useProjects()
  const [form, setForm] = useState({ name: '', budget_total: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { error: err } = await createProject(form)
    setSaving(false)
    if (err) {
      setError(err === 'limit' ? 'Limite de obras atingido.' : err)
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={`card ${styles.card}`}>
        <Icon name="domain" size={40} className={styles.icon} />
        <h1>Crie sua primeira obra</h1>
        <p className="muted">
          Cadastre a obra que você vai gerenciar. Você poderá criar outras depois.
        </p>
        <form className="stack" onSubmit={submit}>
          <div className="field">
            <label>Nome da obra</label>
            <input className="input" value={form.name} autoFocus required
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex.: Reforma do apartamento" />
          </div>
          <div className="field">
            <label>Orçamento total (opcional)</label>
            <input className="input" type="number" step="0.01" min="0" value={form.budget_total}
              onChange={(e) => setForm({ ...form, budget_total: e.target.value })} />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <button className="btn btn-primary btn-block" disabled={saving}>
            {saving ? <Spinner small /> : 'Criar obra'}
          </button>
        </form>
      </div>
    </div>
  )
}
