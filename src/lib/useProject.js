import { useProjects } from './ProjectContext'

// Compat: a partir do multi-obra, a "obra" é a obra ativa do ProjectContext.
// Mantém a assinatura { project, loading } usada pelas telas.
export function useProject() {
  const { activeProject, loading } = useProjects()
  return { project: activeProject, loading }
}
