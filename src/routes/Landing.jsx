import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { money } from '../lib/format'
import Icon from '../components/Icon'
import Accordion from '../components/Accordion'
import CompanyFooter from '../components/CompanyFooter'
import styles from './Landing.module.css'

const logo = `${import.meta.env.BASE_URL}pwa-192.png`
const heroPhoto = `${import.meta.env.BASE_URL}hero-architect-update.png`

// Link de cadastro (Login abre direto no modo signup).
const SIGNUP = '/login?cadastro=1'

// Fallback caso a busca de planos falhe — mantém a seção de preços sempre visível.
const FALLBACK_PLANS = [
  { code: 'mensal', name: 'Plano Mensal', billing_period: 'monthly', amount: 19.9, trial_days: 7, max_active_projects: 5 },
  { code: 'anual', name: 'Plano Anual', billing_period: 'yearly', amount: 199, trial_days: 7, max_active_projects: 10 },
]

const FEATURES = [
  { icon: 'receipt_long', title: 'Lançamentos de gastos', text: 'Registre cada despesa da obra em segundos e veja o total por categoria, etapa e fornecedor.' },
  { icon: 'view_timeline', title: 'Etapas e cronograma', text: 'Da demolição ao acabamento: acompanhe o andamento de cada etapa e o que falta pra terminar.' },
  { icon: 'shopping_cart', title: 'Lista de materiais', text: 'Monte a lista de compras, marque o que já chegou e nunca mais compre cimento duas vezes.' },
  { icon: 'document_scanner', title: 'Nota fiscal por foto (IA)', text: 'Fotografe a nota e a IA lança os itens pra você — sem digitar nada.' },
  { icon: 'photo_library', title: 'Fotos e relatório', text: 'Registre o antes e depois de cada etapa e gere o histórico completo da obra.' },
  { icon: 'ios_share', title: 'Resumo pra compartilhar', text: 'Um link público com o resumo da obra pra mostrar ao cliente, à família ou ao sócio.' },
]

const STEPS = [
  { n: '1', icon: 'home_work', title: 'Crie sua obra', text: 'Cadastro em 2 minutos. Dê um nome à obra, defina o orçamento e pronto.' },
  { n: '2', icon: 'photo_camera', title: 'Lance os gastos', text: 'Digite ou simplesmente fotografe a nota fiscal — a IA cuida do resto.' },
  { n: '3', icon: 'insights', title: 'Acompanhe tudo', text: 'Orçamento, etapas, materiais e fotos num só painel. E um link pra compartilhar.' },
]

const PROOFS = [
  { icon: 'savings', title: 'Cada real no lugar', text: 'Veja quanto já foi gasto em cada etapa e quanto ainda resta do orçamento — antes da surpresa, não depois.' },
  { icon: 'notifications_active', title: 'Sem estouro de orçamento', text: 'O painel mostra o avanço do gasto em tempo real. Você decide com o número na mão, não no achismo.' },
  { icon: 'history', title: 'Histórico completo', text: 'Notas, fotos e lançamentos guardados por etapa. A memória da obra inteira, pra sempre.' },
]

const FAQ = [
  { q: 'Preciso de cartão pra testar?', a: 'Não. Você cria a conta, usa tudo por 7 dias e só cadastra o pagamento se quiser continuar.' },
  { q: 'Como funciona o período grátis?', a: 'São 7 dias com acesso a todas as funções — lançamentos, etapas, materiais, fotos, leitura de nota por IA e resumo público. Sem limite de uso durante o teste.' },
  { q: 'Posso cancelar quando quiser?', a: 'Sim. A assinatura pode ser cancelada a qualquer momento, direto no app, sem multa e sem ligação pra "reter" você.' },
  { q: 'Funciona no celular?', a: 'Funciona — e muito bem. O Krovo é um app web que você instala na tela inicial do celular (Android e iPhone) e usa como um app normal, inclusive no canteiro de obras.' },
  { q: 'Quantas obras posso gerenciar?', a: 'No plano mensal, até 5 obras ativas ao mesmo tempo. No anual, até 10. Obras concluídas não contam no limite.' },
  { q: 'Como funciona a leitura de nota por IA?', a: 'Você fotografa a nota fiscal ou o cupom e a IA identifica os itens, valores e o total, criando o lançamento pra você revisar e salvar.' },
]

const MARQUEE = ['sua obra no controle', 'cada real no lugar', 'sem surpresa no fim do mês', 'da demolição ao acabamento', 'a nota vira lançamento']

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

export default function Landing() {
  const [plans, setPlans] = useState(null)

  // Reveal-on-scroll: elementos com .reveal ganham .in ao entrar na viewport.
  useEffect(() => {
    const els = document.querySelectorAll(`.${styles.reveal}`)
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add(styles.in)
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [plans]) // re-observa quando os cards de plano chegam do Supabase

  useEffect(() => {
    let active = true
    supabase
      .from('plans')
      .select('code, name, billing_period, amount, trial_days, max_active_projects')
      .eq('active', true)
      .order('amount', { ascending: true })
      .then(({ data }) => {
        if (active) setPlans(data?.length ? data : FALLBACK_PLANS)
      })
    return () => { active = false }
  }, [])

  const shown = plans ?? FALLBACK_PLANS
  const mensal = shown.find((p) => p.billing_period === 'monthly')
  const anual = shown.find((p) => p.billing_period === 'yearly')
  const economia = mensal && anual ? mensal.amount * 12 - anual.amount : 0
  const trialDays = shown[0]?.trial_days ?? 7

  return (
    <div className={styles.landing}>
      {/* ===== Barra de anúncio (Coldture) ===== */}
      <Link to={SIGNUP} id="lp-topo-trial" className={styles.announce}>
        <Icon name="celebration" size={16} /> {trialDays} dias grátis — teste sem cartão de crédito
      </Link>

      {/* ===== Navegação ===== */}
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <a href="#" className={styles.brand} onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
            <img src={logo} alt="" /> <span>Krovo</span>
          </a>
          <nav className={styles.navLinks}>
            <button id="lp-nav-recursos" onClick={() => scrollTo('recursos')}>Recursos</button>
            <button id="lp-nav-como-funciona" onClick={() => scrollTo('como-funciona')}>Como funciona</button>
            <button id="lp-nav-planos" onClick={() => scrollTo('planos')}>Planos</button>
            <button id="lp-nav-duvidas" onClick={() => scrollTo('duvidas')}>Dúvidas</button>
          </nav>
          <div className={styles.navActions}>
            <Link to="/login" id="lp-nav-entrar" className={styles.navLogin}>Entrar</Link>
            <Link to={SIGNUP} id="lp-nav-comecar-gratis" className={styles.navCta}>Começar grátis</Link>
          </div>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <h1 className={styles.heroTitle}>
              Sua obra no <em>controle</em>.
            </h1>
            <p className={styles.heroSub}>
              Custos, etapas, materiais e fotos da sua reforma num só lugar.
              Fotografe a nota fiscal e o gasto entra sozinho — e você sabe
              exatamente pra onde foi cada real.
            </p>
            <div className={styles.heroCtas}>
              <Link to={SIGNUP} id="lp-hero-comecar-gratis" className={styles.ctaPrimary}>
                Começar grátis <Icon name="arrow_forward" size={20} />
              </Link>
              <button id="lp-hero-ver-como-funciona" className={styles.ctaGhost} onClick={() => scrollTo('como-funciona')}>
                Ver como funciona
              </button>
            </div>
            <p className={styles.heroNote}>
              <Icon name="credit_card_off" size={16} /> {trialDays} dias grátis · sem cartão pra testar
            </p>
          </div>

          {/* Foto da arquiteta + card do dashboard (CSS) sobreposto */}
          <div className={styles.heroMedia}>
            <img
              className={styles.heroPhoto}
              src={heroPhoto}
              alt="Arquiteta usando o Krovo no canteiro de obras"
            />
            <div className={styles.mock} aria-hidden="true">
              <div className={styles.mockHead}>
                <div>
                  <span className={styles.mockTitle}>Reforma do apê</span>
                  <span className={styles.mockBadge}>Em andamento</span>
                </div>
              </div>
              <div className={styles.mockBody}>
                <span className={styles.mockPct}>67%</span>
                <div className={styles.mockBars}>
                  {[['Demolição', 100], ['Elétrica', 80], ['Pintura', 30]].map(([label, v]) => (
                    <div key={label} className={styles.mockBar}>
                      <span>{label}</span>
                      <div className={styles.mockTrack}><div style={{ width: `${v}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
              <ul className={styles.mockEntries}>
                <li><Icon name="receipt_long" size={18} /> Cimento CP-II (12 sacos)</li>
                <li><Icon name="bolt" size={18} /> Eletricista — mão de obra</li>
                <li><Icon name="format_paint" size={18} /> Tinta acrílica 18L</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Faixa de confiança (Coldture) ===== */}
      <div className={styles.strip}>
        <span><Icon name="verified" size={18} /> {trialDays} dias grátis</span>
        <span><Icon name="credit_card_off" size={18} /> Sem cartão pra testar</span>
        <span><Icon name="event_repeat" size={18} /> Cancele quando quiser</span>
        <span><Icon name="pix" size={18} /> Pague com cartão ou PIX</span>
      </div>

      {/* ===== Marquee (air up) ===== */}
      <div className={styles.marquee}>
        <div className={styles.marqueeTrack}>
          {[...MARQUEE, ...MARQUEE].map((t, i) => (
            <span key={i}>{t} <Icon name="construction" size={18} /></span>
          ))}
        </div>
      </div>

      {/* ===== Recursos ===== */}
      <section id="recursos" className={styles.section}>
        <div className={`${styles.sectionHead} ${styles.reveal}`}>
          <p className={styles.kicker}>Recursos</p>
          <h2>Tudo que sua reforma precisa.</h2>
          <p className={styles.sectionSub}>Sem planilha, sem caderninho, sem nota perdida na carteira.</p>
        </div>
        <div className={styles.featGrid}>
          {FEATURES.map((f, i) => (
            <div key={f.title} className={`${styles.feat} ${styles.reveal}`} style={{ '--d': `${i * 70}ms` }}>
              <span className={styles.featIcon}><Icon name={f.icon} size={26} /></span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Destaque IA (Coldture "brand new") ===== */}
      <section className={styles.ia}>
        <div className={styles.iaInner}>
          <div className={`${styles.iaText} ${styles.reveal}`}>
            <p className={styles.iaKicker}><Icon name="auto_awesome" size={16} /> Inteligência artificial</p>
            <h2>A nota fiscal vira lançamento. Sozinha.</h2>
            <p>
              Chegou do depósito com a nota na mão? Fotografa. A IA do Krovo lê os
              itens, os valores e o total, e cria o lançamento pra você só revisar
              e salvar. O caderninho de obra acabou de se aposentar.
            </p>
            <Link to={SIGNUP} id="lp-ia-testar-leitura-nota" className={styles.ctaPrimary}>
              Testar leitura de nota <Icon name="arrow_forward" size={20} />
            </Link>
          </div>
          <div className={`${styles.iaCard} ${styles.reveal}`} style={{ '--d': '120ms' }} aria-hidden="true">
            <div className={styles.iaPhoto}>
              <Icon name="photo_camera" size={28} />
              <span>nota-deposito.jpg</span>
            </div>
            <div className={styles.iaArrow}><Icon name="south" size={20} /></div>
            <ul className={styles.iaItems}>
              <li><Icon name="check_circle" size={16} /> Argamassa ACIII 20kg × 8 <strong>R$ 247,20</strong></li>
              <li><Icon name="check_circle" size={16} /> Rejunte cinza 5kg × 2 <strong>R$ 63,80</strong></li>
              <li><Icon name="check_circle" size={16} /> Porcelanato 80×80 × 12cx <strong>R$ 2.149,00</strong></li>
            </ul>
            <p className={styles.iaDone}>3 itens lançados em "Revestimentos"</p>
          </div>
        </div>
      </section>

      {/* ===== Como funciona (air up "crazy easy") ===== */}
      <section id="como-funciona" className={styles.section}>
        <div className={`${styles.sectionHead} ${styles.reveal}`}>
          <p className={styles.kicker}>Como funciona</p>
          <h2>Fácil de verdade.</h2>
        </div>
        <div className={styles.steps}>
          {STEPS.map((s, i) => (
            <div key={s.n} className={`${styles.step} ${styles.reveal}`} style={{ '--d': `${i * 90}ms` }}>
              <span className={styles.stepNum}>{s.n}</span>
              <Icon name={s.icon} size={32} className={styles.stepIcon} />
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Benefícios (air up "clinically proven") ===== */}
      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={`${styles.sectionHead} ${styles.reveal}`}>
          <p className={styles.kicker}>Por que Krovo</p>
          <h2>Obra sem surpresa no fim do mês.</h2>
        </div>
        <div className={styles.proofs}>
          {PROOFS.map((p, i) => (
            <div key={p.title} className={`${styles.proof} ${styles.reveal}`} style={{ '--d': `${i * 90}ms` }}>
              <Icon name={p.icon} size={30} className={styles.proofIcon} />
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Planos ===== */}
      <section id="planos" className={styles.section}>
        <div className={`${styles.sectionHead} ${styles.reveal}`}>
          <p className={styles.kicker}>Planos</p>
          <h2>Menos que um saco de cimento por mês.</h2>
          <p className={styles.sectionSub}>Todos os planos começam com {trialDays} dias grátis — sem cartão.</p>
        </div>
        <div className={styles.plans}>
          {shown.map((p, i) => {
            const isYear = p.billing_period === 'yearly'
            return (
              <div key={p.code} className={`${styles.plan} ${isYear ? styles.planBest : ''} ${styles.reveal}`} style={{ '--d': `${i * 120}ms` }}>
                {isYear && economia > 0 && (
                  <span className={styles.planBadge}>Economize {money(economia)}</span>
                )}
                <h3>{p.name}</h3>
                <p className={styles.planPrice}>
                  {money(p.amount)} <span>/{isYear ? 'ano' : 'mês'}</span>
                </p>
                {isYear
                  ? <p className={styles.planEquiv}>≈ {money(p.amount / 12)}/mês</p>
                  : <p className={styles.planEquiv}>&nbsp;</p>}
                <ul className={styles.planFeatures}>
                  <li><Icon name="check_circle" size={18} /> Todas as funções, sem limite de uso</li>
                  <li><Icon name="check_circle" size={18} /> Até {p.max_active_projects ?? 5} obras ativas</li>
                  <li><Icon name="check_circle" size={18} /> Leitura de nota fiscal por IA</li>
                  <li><Icon name="check_circle" size={18} /> Resumo público pra compartilhar</li>
                  <li><Icon name="check_circle" size={18} /> Cancele quando quiser</li>
                </ul>
                <Link to={SIGNUP} id={`lp-plano-${p.billing_period}`} className={isYear ? styles.ctaPrimary : styles.ctaOutline}>
                  Começar {p.trial_days ?? trialDays} dias grátis
                </Link>
              </div>
            )
          })}
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="duvidas" className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={`${styles.sectionHead} ${styles.reveal}`}>
          <p className={styles.kicker}>Dúvidas</p>
          <h2>Perguntas frequentes.</h2>
        </div>
        <div className={styles.faq}>
          {FAQ.map((f, i) => (
            <div key={f.q} className={styles.reveal} style={{ '--d': `${i * 60}ms` }}>
              <Accordion title={f.q} defaultOpen={i === 0}>
                <p className={styles.faqAnswer}>{f.a}</p>
              </Accordion>
            </div>
          ))}
        </div>
      </section>

      {/* ===== CTA final (air up "still thirsty?") ===== */}
      <section className={styles.section}>
        <div className={`${styles.finalCta} ${styles.reveal}`}>
          <h2>Ainda anotando a obra no caderninho?</h2>
          <p>Crie sua conta agora e organize sua reforma ainda hoje. {trialDays} dias grátis, sem cartão.</p>
          <Link to={SIGNUP} id="lp-final-comecar-gratis" className={styles.ctaInverse}>
            Começar grátis <Icon name="arrow_forward" size={20} />
          </Link>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <img src={logo} alt="" /> <span>Krovo</span>
          <p className="muted">Sua obra na mão.</p>
        </div>
        <nav className={styles.footerLinks}>
          <button id="lp-footer-recursos" onClick={() => scrollTo('recursos')}>Recursos</button>
          <button id="lp-footer-como-funciona" onClick={() => scrollTo('como-funciona')}>Como funciona</button>
          <button id="lp-footer-planos" onClick={() => scrollTo('planos')}>Planos</button>
          <button id="lp-footer-duvidas" onClick={() => scrollTo('duvidas')}>Dúvidas</button>
          <Link to="/login" id="lp-footer-entrar">Entrar</Link>
          <Link to="/termos" id="lp-footer-termos">Termos de Uso</Link>
          <Link to="/privacidade" id="lp-footer-privacidade">Política de Privacidade</Link>
        </nav>
        <CompanyFooter />
      </footer>
    </div>
  )
}
