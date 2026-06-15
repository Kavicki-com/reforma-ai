import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { lookupCep, maskCep } from '../lib/cep'
import PasswordInput from '../components/PasswordInput'
import PasswordStrength from '../components/PasswordStrength'
import PasswordMatch from '../components/PasswordMatch'
import BottomSheet from '../components/BottomSheet'
import Toast from '../components/Toast'
import Spinner from '../components/Spinner'
import Icon from '../components/Icon'
import styles from './Configuracoes.module.css'

const emptyAddr = { cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', uf: '' }

export default function Configuracoes() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [toast, setToast] = useState('')

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Configurações</h1>
      <ProfileSection userId={user?.id} setToast={setToast} />
      <PasswordSection setToast={setToast} />
      <DangerSection signOut={signOut} navigate={navigate} />
      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  )
}

function ProfileSection({ userId, setToast }) {
  const [fullName, setFullName] = useState('')
  const [addr, setAddr] = useState(emptyAddr)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [cepLoading, setCepLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!userId) return
    let active = true
    supabase
      .from('profiles')
      .select('full_name, cep, street, number, complement, neighborhood, city, uf')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (!active || !data) return
        setFullName(data.full_name || '')
        setAddr({
          cep: data.cep || '', street: data.street || '', number: data.number || '',
          complement: data.complement || '', neighborhood: data.neighborhood || '',
          city: data.city || '', uf: data.uf || '',
        })
        setLoading(false)
      })
    return () => { active = false }
  }, [userId])

  function setField(k, v) { setAddr((a) => ({ ...a, [k]: v })) }

  async function onCepBlur() {
    const clean = addr.cep.replace(/\D/g, '')
    if (clean.length !== 8) return
    setCepLoading(true)
    const res = await lookupCep(clean)
    setCepLoading(false)
    if (res) setAddr((a) => ({ ...a, street: res.street || a.street, neighborhood: res.neighborhood || a.neighborhood, city: res.city || a.city, uf: res.uf || a.uf }))
  }

  async function save(e) {
    e.preventDefault()
    setError(''); setBusy(true)
    const { error: err } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        cep: addr.cep.replace(/\D/g, '') || null,
        street: addr.street || null, number: addr.number || null,
        complement: addr.complement || null, neighborhood: addr.neighborhood || null,
        city: addr.city || null, uf: addr.uf || null,
      })
      .eq('id', userId)
    setBusy(false)
    if (err) { setError('Não foi possível salvar. Tente novamente.'); return }
    setToast('Dados atualizados!')
  }

  if (loading) return <div className={`card ${styles.card}`}><div className="center"><Spinner /></div></div>

  return (
    <form className={`card ${styles.card}`} onSubmit={save}>
      <h2 className={styles.cardTitle}>Dados de cadastro</h2>
      {error && <p className={styles.error}>{error}</p>}
      <div className="field">
        <label>Nome</label>
        <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </div>
      <div className="field">
        <label>CEP</label>
        <div className={styles.cepRow}>
          <input className="input" inputMode="numeric" placeholder="00000-000"
            value={maskCep(addr.cep)} onChange={(e) => setField('cep', e.target.value)} onBlur={onCepBlur} />
          {cepLoading && <Spinner small />}
        </div>
      </div>
      <div className="field">
        <label>Logradouro</label>
        <input className="input" value={addr.street} onChange={(e) => setField('street', e.target.value)} />
      </div>
      <div className={styles.row}>
        <div className="field">
          <label>Número</label>
          <input className="input" inputMode="numeric" value={addr.number} onChange={(e) => setField('number', e.target.value)} />
        </div>
        <div className="field">
          <label>Complemento</label>
          <input className="input" value={addr.complement} onChange={(e) => setField('complement', e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Bairro</label>
        <input className="input" value={addr.neighborhood} onChange={(e) => setField('neighborhood', e.target.value)} />
      </div>
      <div className={styles.row}>
        <div className="field">
          <label>Cidade</label>
          <input className="input" value={addr.city} onChange={(e) => setField('city', e.target.value)} />
        </div>
        <div className="field" style={{ maxWidth: 90 }}>
          <label>UF</label>
          <input className="input" maxLength={2} value={addr.uf} onChange={(e) => setField('uf', e.target.value.toUpperCase())} />
        </div>
      </div>
      <button id="config-salvar-perfil" className="btn btn-primary btn-block" disabled={busy}>{busy ? <Spinner small /> : 'Salvar'}</button>
    </form>
  )
}

function PasswordSection({ setToast }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(e) {
    e.preventDefault()
    setError('')
    if (pw.length < 6) { setError('A senha precisa ter pelo menos 6 caracteres.'); return }
    if (pw !== pw2) { setError('As senhas não conferem.'); return }
    setBusy(true)
    const { error: err } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (err) { setError('Não foi possível alterar a senha. Faça login novamente e tente de novo.'); return }
    setPw(''); setPw2('')
    setToast('Senha alterada!')
  }

  return (
    <form className={`card ${styles.card}`} onSubmit={save}>
      <h2 className={styles.cardTitle}>Alterar senha</h2>
      {error && <p className={styles.error}>{error}</p>}
      <div className="field">
        <label>Nova senha</label>
        <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required />
        <PasswordStrength value={pw} />
      </div>
      <div className="field">
        <label>Confirmar nova senha</label>
        <PasswordInput value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required />
        <PasswordMatch value={pw} confirm={pw2} />
      </div>
      <button id="config-alterar-senha" className="btn btn-primary btn-block" disabled={busy}>{busy ? <Spinner small /> : 'Alterar senha'}</button>
    </form>
  )
}

function DangerSection({ signOut, navigate }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function remove() {
    setBusy(true); setError('')
    try {
      const { data, error: err } = await supabase.functions.invoke('delete-account', { body: {} })
      if (err || !data?.ok) throw new Error(data?.error || 'Falha ao excluir.')
      await signOut()
      navigate('/login', { replace: true })
    } catch (e) {
      setError(e.message || 'Não foi possível excluir a conta.')
      setBusy(false)
    }
  }

  return (
    <div className={`card ${styles.card} ${styles.danger}`}>
      <h2 className={styles.cardTitle}>Excluir conta</h2>
      <p className="muted">Esta ação é permanente e remove sua obra, dados e assinatura. Não dá pra desfazer.</p>
      <button id="config-excluir-conta" className="btn btn-danger btn-block" onClick={() => { setError(''); setOpen(true) }}>Excluir minha conta</button>

      <BottomSheet open={open} title="Excluir conta" onClose={() => !busy && setOpen(false)}>
        {error && <p className={styles.error}>{error}</p>}
        <p className="muted" style={{ marginBottom: 'var(--sp-4)' }}>
          Tem certeza? Tudo será apagado permanentemente: sua obra, lançamentos, fotos e assinatura.
        </p>
        <button id="config-excluir-confirmar" className="btn btn-danger btn-block" disabled={busy} onClick={remove}>
          {busy ? <Spinner small /> : 'Sim, excluir tudo'}
        </button>
        <button id="config-excluir-voltar" className="btn btn-block" disabled={busy} style={{ marginTop: 'var(--sp-2)' }} onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </BottomSheet>
    </div>
  )
}
