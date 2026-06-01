import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { useProject } from '../lib/useProject'
import { dateBR } from '../lib/format'
import Spinner from '../components/Spinner'
import Icon from '../components/Icon'
import styles from './Photos.module.css'

function groupByDay(photos) {
  const map = new Map()
  for (const p of photos) {
    const day = String(p.taken_at || p.created_at || '').slice(0, 10)
    if (!map.has(day)) map.set(day, [])
    map.get(day).push(p)
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([day, items]) => ({ day, items }))
}

export default function Photos() {
  const { isAdmin } = useAuth()
  const { project } = useProject()
  const [photos, setPhotos] = useState([])
  const [urls, setUrls] = useState({})
  const [currentStages, setCurrentStages] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('photos')
      .select('*')
      .order('created_at', { ascending: false })
    const list = data || []
    setPhotos(list)
    if (list.length) {
      const { data: signed } = await supabase.storage
        .from('fotos')
        .createSignedUrls(list.map((p) => p.file_path), 3600)
      const map = {}
      ;(signed || []).forEach((s) => { if (s.signedUrl) map[s.path] = s.signedUrl })
      setUrls(map)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Etapa(s) em andamento — exibida no topo
  useEffect(() => {
    if (!project) return
    supabase
      .from('stages')
      .select('name')
      .eq('project_id', project.id)
      .eq('status', 'em_andamento')
      .order('start_date')
      .then(({ data }) => setCurrentStages(data || []))
  }, [project])

  const groups = useMemo(() => groupByDay(photos), [photos])

  async function onUpload(e) {
    const files = Array.from(e.target.files)
    if (!files.length || !project) return
    setUploading(true)
    try {
      for (const file of files) {
        const path = `${project.id}/${crypto.randomUUID()}-${file.name}`
        const up = await supabase.storage.from('fotos').upload(path, file)
        if (up.error) throw up.error
        await supabase.from('photos').insert({
          project_id: project.id,
          file_path: path,
          taken_at: new Date().toISOString().slice(0, 10),
        })
      }
      await load()
    } catch (err) {
      alert('Erro ao enviar foto: ' + err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function remove(photo) {
    if (!confirm('Excluir foto?')) return
    await supabase.storage.from('fotos').remove([photo.file_path])
    await supabase.from('photos').delete().eq('id', photo.id)
    setPhotos((p) => p.filter((x) => x.id !== photo.id))
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Fotos da obra</h1>
      </div>

      {currentStages.length > 0 && (
        <div className={`card ${styles.current}`}>
          <Icon name="construction" className={styles.currentIcon} />
          <div>
            <span className="muted">Etapa em andamento</span>
            <strong>{currentStages.map((s) => s.name).join(', ')}</strong>
          </div>
        </div>
      )}

      {loading ? (
        <div className="spinner-wrap"><Spinner /></div>
      ) : photos.length === 0 ? (
        <div className="empty"><Icon name="photo_camera" />Nenhuma foto ainda.</div>
      ) : (
        <div className={styles.days}>
          {groups.map((g) => (
            <section key={g.day}>
              <h2 className={styles.dayHeader}>{dateBR(g.day)}</h2>
              <div className={styles.grid}>
                {g.items.map((p) => (
                  <div key={p.id} className={styles.cell}>
                    {urls[p.file_path] ? (
                      <a href={urls[p.file_path]} target="_blank" rel="noreferrer">
                        <img src={urls[p.file_path]} alt={p.caption || 'foto da obra'} loading="lazy" />
                      </a>
                    ) : (
                      <div className={styles.placeholder}><Spinner small /></div>
                    )}
                    {isAdmin && (
                      <button className={styles.del} onClick={() => remove(p)} aria-label="excluir foto">
                        <Icon name="close" size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {isAdmin && (
        <label className="btn-fab" aria-label="Nova foto">
          {uploading ? <Spinner small /> : <Icon name="add_a_photo" size={26} />}
          <input type="file" accept="image/*" multiple hidden onChange={onUpload} disabled={uploading} />
        </label>
      )}
    </div>
  )
}
