import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { lookupCep, maskCep } from '../lib/cep'
import Spinner from '../components/Spinner'
import CompanyFooter from '../components/CompanyFooter'
import Icon from '../components/Icon'
import PasswordInput from '../components/PasswordInput'
import PasswordStrength from '../components/PasswordStrength'
import PasswordMatch from '../components/PasswordMatch'
import PlanPicker from '../components/PlanPicker'
import BottomSheet from '../components/BottomSheet'
import { TermosContent, PrivacidadeContent } from './Legal'
import { captureLead } from '../lib/leads'
import { isValidEmail } from '../lib/validation'
import styles from './Login.module.css'

const logo = `${import.meta.env.BASE_URL}pwa-192.png`

const emptyAddr = { cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', uf: '' }

export default function Login() {
  const { session, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  // 'signin' | 'signup' — a landing manda pra cá com ?cadastro=1 pra abrir direto no cadastro.
  // Com HashRouter a query fica dentro do hash (#/login?cadastro=1), então lemos do router.
  const location = useLocation()
  const [mode, setMode] = useState(() =>
    window.location.hash.includes('cadastro=1') ? 'signup' : 'signin',
  )
  // Reage à URL mesmo com o componente já montado (ex.: landing → Entrar → landing → Começar grátis)
  useEffect(() => {
    const wantsSignup = new URLSearchParams(location.search).get('cadastro') === '1'
    setMode(wantsSignup ? 'signup' : 'signin')
    setStep(0)
    setError('')
  }, [location.search])
  const [step, setStep] = useState(0) // wizard do signup: 0 conta, 1 endereço, 2 plano

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [addr, setAddr] = useState(emptyAddr)
  const [planCode, setPlanCode] = useState(null)

  const [cepLoading, setCepLoading] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Modal de termos/privacidade: 'termos' | 'privacidade' | null. Abre como
  // sheet sem tirar o usuário do wizard de cadastro.
  const [legal, setLegal] = useState(null)

  const isSignup = mode === 'signup'

  useEffect(() => {
    if (session) navigate('/', { replace: true })
  }, [session, navigate])

  function switchMode() {
    setMode(isSignup ? 'signin' : 'signup')
    setStep(0)
    setError('')
  }

  function setAddrField(k, v) { setAddr((a) => ({ ...a, [k]: v })) }

  async function onCepBlur() {
    const clean = addr.cep.replace(/\D/g, '')
    if (clean.length !== 8) return
    setCepLoading(true)
    const res = await lookupCep(clean)
    setCepLoading(false)
    if (res) {
      setAddr((a) => ({
        ...a,
        street: res.street || a.street,
        neighborhood: res.neighborhood || a.neighborhood,
        city: res.city || a.city,
        uf: res.uf || a.uf,
      }))
    } else {
      setError('CEP não encontrado.')
    }
  }

  function validateStep() {
    if (step === 0) {
      if (!fullName.trim()) return 'Informe seu nome.'
      if (!email.trim()) return 'Informe seu e-mail.'
      if (!isValidEmail(email)) return 'Informe um e-mail válido.'
      if (password.length < 6) return 'A senha precisa ter pelo menos 6 caracteres.'
      if (password !== password2) return 'As senhas não conferem.'
    }
    if (step === 1) {
      if (addr.cep.replace(/\D/g, '').length !== 8) return 'Informe um CEP válido.'
      if (!addr.street.trim() || !addr.number.trim() || !addr.city.trim() || !addr.uf.trim()) {
        return 'Preencha o endereço completo.'
      }
    }
    if (step === 2 && !planCode) return 'Escolha um plano.'
    return ''
  }

  function next(e) {
    e.preventDefault()
    const err = validateStep()
    if (err) { setError(err); return }
    setError('')
    setStep((s) => s + 1)
  }

  function back() {
    setError('')
    setStep((s) => Math.max(0, s - 1))
  }

  async function doSignup() {
    const err = validateStep()
    if (err) { setError(err); return }
    setBusy(true)
    const { data, error } = await signUp(email.trim(), password, fullName.trim(), {
      ...addr,
      cep: addr.cep.replace(/\D/g, ''),
      selected_plan: planCode,
    })
    setBusy(false)
    if (error) {
      const tooMany = error.status === 429 || /rate limit|too many/i.test(error.message)
      setError(
        tooMany
          ? 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.'
          : /registered|already/i.test(error.message)
            ? 'Este e-mail já está cadastrado.'
            : 'Não foi possível criar a conta. Tente novamente.',
      )
      return
    }
    if (data?.user && data.user.identities && data.user.identities.length === 0) {
      setError('Este e-mail já está cadastrado.')
      return
    }
    // Com sessão imediata (confirmação desligada) vai direto pro pagamento.
    if (data?.session) { navigate('/assinatura', { replace: true }); return }
    // Confirmação ligada: tela "Confirme seu e-mail" (o plano fica salvo no metadata).
    navigate('/confirme-email', { state: { email: email.trim() } })
  }

  async function doSignin(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await signIn(email.trim(), password)
    setBusy(false)
    if (error) { setError('E-mail ou senha inválidos.'); return }
    navigate('/', { replace: true })
  }

  const STEPS = ['Conta', 'Endereço', 'Plano']

  // No passo do plano alargamos o form pra acomodar os dois cards lado a lado.
  const wide = isSignup && step === 2

  return (
    <div className={`${styles.wrap} ${wide ? styles.wrap_wide : ''}`}>
      <Link to="/" id="auth-ir-site" className={styles.siteLink}>
        <Icon name="arrow_back" /> Ir para o site
      </Link>
      <div className={styles.brand}>
        <img className={styles.logo} src={logo} alt="Krovo" />
        <h1>Krovo</h1>
        <p className="muted">Sua obra na mão</p>
      </div>

      {!isSignup ? (
        <form className={`card ${styles.card}`} onSubmit={doSignin}>
          <div className="field">
            <label>E-mail</label>
            <input className="input" type="email" autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Senha</label>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          <Link to="/recuperar-senha" id="auth-esqueci-senha" className={styles.forgot}>Esqueci minha senha</Link>
          {error && <p className={styles.error}>{error}</p>}
          <button id="auth-entrar" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? <Spinner small /> : 'Entrar'}
          </button>
          <p className={styles.toggle}>
            Não tem conta?
            <button type="button" id="auth-ir-criar-conta" className={styles.toggleBtn} onClick={switchMode}>Criar conta</button>
          </p>
        </form>
      ) : (
        <>
        <div className={styles.stepper}>
          {STEPS.map((label, i) => (
            <div key={label} className={`${styles.stepItem} ${i <= step ? styles.fill : ''}`}>
              <span className={`${styles.dot} ${i < step ? styles.dotDone : ''} ${i === step ? styles.dotActive : ''}`}>{i + 1}</span>
              <span className={`${styles.stepLabel} ${i === step ? styles.stepLabelActive : ''}`}>{label}</span>
            </div>
          ))}
        </div>
        <form className={`card ${styles.card}`} onSubmit={step < 2 ? next : (e) => { e.preventDefault(); doSignup() }}>

          {step === 0 && (
            <>
              <div className="field">
                <label>Nome</label>
                <input className="input" type="text" autoComplete="name"
                  value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="field">
                <label>E-mail</label>
                <input className="input" type="email" autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => { if (isValidEmail(email)) captureLead(fullName, email) }} required />
              </div>
              <div className="field">
                <label>Senha</label>
                <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
                <PasswordStrength value={password} />
              </div>
              <div className="field">
                <label>Confirmar senha</label>
                <PasswordInput value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" required />
                <PasswordMatch value={password} confirm={password2} />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="field">
                <label>CEP</label>
                <div className={styles.cepRow}>
                  <input className="input" inputMode="numeric" placeholder="00000-000"
                    value={maskCep(addr.cep)} onChange={(e) => setAddrField('cep', e.target.value)}
                    onBlur={onCepBlur} required />
                  {cepLoading && <Spinner small />}
                </div>
              </div>
              <div className="field">
                <label>Logradouro</label>
                <input className="input" value={addr.street} onChange={(e) => setAddrField('street', e.target.value)} required />
              </div>
              <div className={styles.addrRow}>
                <div className="field">
                  <label>Número</label>
                  <input className="input" inputMode="numeric" value={addr.number} onChange={(e) => setAddrField('number', e.target.value)} required />
                </div>
                <div className="field">
                  <label>Complemento</label>
                  <input className="input" value={addr.complement} onChange={(e) => setAddrField('complement', e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>Bairro</label>
                <input className="input" value={addr.neighborhood} onChange={(e) => setAddrField('neighborhood', e.target.value)} />
              </div>
              <div className={styles.addrRow}>
                <div className="field">
                  <label>Cidade</label>
                  <input className="input" value={addr.city} onChange={(e) => setAddrField('city', e.target.value)} required />
                </div>
                <div className="field" style={{ maxWidth: 90 }}>
                  <label>UF</label>
                  <input className="input" maxLength={2} value={addr.uf}
                    onChange={(e) => setAddrField('uf', e.target.value.toUpperCase())} required />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="muted">
                Escolha seu plano. Você tem <strong>7 dias grátis</strong> e só é cobrado depois.
              </p>
              <PlanPicker value={planCode} onChange={setPlanCode} />
            </>
          )}

          {error && <p className={styles.error}>{error}</p>}

          <p className={styles.consent}>
            Ao continuar você confirma estar de acordo com as{' '}
            <button type="button" id="auth-ver-politicas" className={styles.linkBtn} onClick={() => setLegal('privacidade')}>políticas</button> e{' '}
            <button type="button" id="auth-ver-termos" className={styles.linkBtn} onClick={() => setLegal('termos')}>termos de uso</button> do Krovo.
          </p>

          <div className={styles.actions}>
            <button id="auth-criar-conta" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? <Spinner small /> : step < 2 ? 'Continuar' : 'Criar conta'}
            </button>
            {step > 0 && (
              <button type="button" id="auth-voltar" className="btn btn-block" onClick={back} disabled={busy}>Voltar</button>
            )}
          </div>

          <p className={styles.toggle}>
            Já tem conta?
            <button type="button" id="auth-ir-entrar" className={styles.toggleBtn} onClick={switchMode}>Entrar</button>
          </p>
        </form>
        </>
      )}

      <BottomSheet
        open={!!legal}
        title={legal === 'termos' ? 'Termos de Uso' : 'Política de Privacidade'}
        onClose={() => setLegal(null)}
      >
        {legal === 'termos' ? <TermosContent /> : legal === 'privacidade' ? <PrivacidadeContent /> : null}
      </BottomSheet>

      <CompanyFooter />
    </div>
  )
}
