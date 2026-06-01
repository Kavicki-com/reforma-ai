import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// v1: uma unica obra. Busca a primeira (mais antiga).
export function useProject() {
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        setProject(data)
        setLoading(false)
      })
    return () => { active = false }
  }, [])

  return { project, loading }
}
