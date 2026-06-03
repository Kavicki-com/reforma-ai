import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from '../auth/AuthProvider'
import { useSubscription } from './useSubscription'

const ProjectContext = createContext(null)

const LAST_KEY = 'krovo:lastProjectId'
const DEFAULT_LIMIT = 5 // trial / sem assinatura ativa
const isActiveStatus = (p) => p?.status !== 'concluida'

export function ProjectProvider({ children }) {
  const { user } = useAuth()
  const { subscription, isActive } = useSubscription()
  const [projects, setProjects] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) { setProjects([]); setActiveId(null); setLoading(false); return }
    const { data } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: true })
    const list = data || []
    setProjects(list)
    // Mantém a obra ativa se ainda existir; senão usa a última salva; senão a 1ª.
    setActiveId((prev) => {
      const saved = (typeof localStorage !== 'undefined' && localStorage.getItem(LAST_KEY)) || null
      const stillValid = (id) => id && list.some((p) => p.id === id)
      if (stillValid(prev)) return prev
      if (stillValid(saved)) return saved
      return list[0]?.id ?? null
    })
    setLoading(false)
  }, [user])

  useEffect(() => { refresh() }, [refresh])

  const setActiveProject = useCallback((id) => {
    setActiveId(id)
    if (typeof localStorage !== 'undefined') {
      if (id) localStorage.setItem(LAST_KEY, id)
      else localStorage.removeItem(LAST_KEY)
    }
  }, [])

  // Cria uma obra e a torna ativa. O limite é validado no banco (trigger);
  // aqui só repassamos o erro tratado para a UI.
  const createProject = useCallback(async (fields) => {
    if (!user) return { error: 'Sessão expirada.' }
    const payload = { name: (fields?.name || '').trim(), owner_id: user.id }
    if (!payload.name) return { error: 'Informe um nome para a obra.' }
    if (fields?.budget_total != null && fields.budget_total !== '') {
      payload.budget_total = Number(fields.budget_total) || 0
    }
    const { data, error } = await supabase
      .from('projects')
      .insert(payload)
      .select('*')
      .single()
    if (error) {
      const limitHit = /project_limit_reached/.test(error.message || '')
      return { error: limitHit ? 'limit' : (error.message || 'Erro ao criar obra.') }
    }
    setProjects((arr) => [...arr, data])
    setActiveProject(data.id)
    return { data }
  }, [user, setActiveProject])

  // Exclui a obra e seus dados. As tabelas filhas são ON DELETE CASCADE,
  // então só precisamos limpar os arquivos de storage antes.
  const deleteProject = useCallback(async (id) => {
    try {
      const [{ data: photos }, { data: atts }] = await Promise.all([
        supabase.from('photos').select('file_path').eq('project_id', id),
        supabase.from('attachments').select('file_path, entries!inner(project_id)').eq('entries.project_id', id),
      ])
      const fotoPaths = (photos || []).map((p) => p.file_path).filter(Boolean)
      const notaPaths = (atts || []).map((a) => a.file_path).filter(Boolean)
      if (fotoPaths.length) await supabase.storage.from('fotos').remove(fotoPaths)
      if (notaPaths.length) await supabase.storage.from('notas').remove(notaPaths)
    } catch { /* arquivos órfãos não impedem a exclusão da obra */ }

    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) return { error: error.message || 'Erro ao excluir obra.' }

    const remaining = projects.filter((p) => p.id !== id)
    setProjects(remaining)
    if (activeId === id) setActiveProject(remaining[0]?.id ?? null)
    return {}
  }, [projects, activeId, setActiveProject])

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeId) ?? null,
    [projects, activeId],
  )

  const activeCount = useMemo(() => projects.filter(isActiveStatus).length, [projects])
  // Limite vem do plano ativo; trial/sem assinatura ativa => DEFAULT_LIMIT (5).
  const maxActive = (isActive && subscription?.plans?.max_active_projects) || DEFAULT_LIMIT
  const canCreate = activeCount < maxActive
  const needsOnboarding = Boolean(user) && !loading && projects.length === 0

  const value = {
    projects,
    activeProject,
    setActiveProject,
    createProject,
    deleteProject,
    refresh,
    loading,
    activeCount,
    maxActive,
    canCreate,
    needsOnboarding,
  }

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProjects() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProjects precisa estar dentro de ProjectProvider')
  return ctx
}
