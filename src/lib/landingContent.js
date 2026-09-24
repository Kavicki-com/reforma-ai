// Sem JSX/imports: também é lido pelo vite.config.js para gerar o JSON-LD do index.html.

export const SITE_URL = 'https://krovo.kavicki.com/'

export const FALLBACK_PLANS = [
  { code: 'mensal', name: 'Plano Mensal', billing_period: 'monthly', amount: 19.9, trial_days: 7, max_active_projects: 5 },
  { code: 'anual', name: 'Plano Anual', billing_period: 'yearly', amount: 199, trial_days: 7, max_active_projects: 10 },
]

export const FAQ = [
  { q: 'O que é o Krovo?', a: 'O Krovo é um app de gestão de obras e reformas. Nele você controla os gastos, as etapas, a lista de materiais e as fotos da obra num só lugar, lança despesas fotografando a nota fiscal (a IA lê os itens) e compartilha um resumo da obra por link.' },
  { q: 'Preciso de cartão pra testar?', a: 'Não. Você cria a conta, usa tudo por 7 dias e só cadastra o pagamento se quiser continuar.' },
  { q: 'Como funciona o período grátis?', a: 'São 7 dias com acesso a todas as funções — lançamentos, etapas, materiais, fotos, leitura de nota por IA e resumo público. Sem limite de uso durante o teste.' },
  { q: 'Posso cancelar quando quiser?', a: 'Sim. A assinatura pode ser cancelada a qualquer momento, direto no app, sem multa e sem ligação pra "reter" você.' },
  { q: 'Funciona no celular?', a: 'Funciona — e muito bem. O Krovo é um app web que você instala na tela inicial do celular (Android e iPhone) e usa como um app normal, inclusive no canteiro de obras.' },
  { q: 'Quantas obras posso gerenciar?', a: 'No plano mensal, até 5 obras ativas ao mesmo tempo. No anual, até 10. Obras concluídas não contam no limite.' },
  { q: 'Como funciona a leitura de nota por IA?', a: 'Você fotografa a nota fiscal ou o cupom e a IA identifica os itens, valores e o total, criando o lançamento pra você revisar e salvar.' },
]

export function structuredData() {
  const org = {
    '@type': 'Organization',
    '@id': `${SITE_URL}#org`,
    name: 'Krovo',
    url: SITE_URL,
    logo: `${SITE_URL}pwa-512.png`,
    parentOrganization: { '@type': 'Organization', name: 'Kavicki', url: 'https://kavicki.com' },
  }
  return {
    '@context': 'https://schema.org',
    '@graph': [
      org,
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}#site`,
        name: 'Krovo',
        url: SITE_URL,
        inLanguage: 'pt-BR',
        publisher: { '@id': `${SITE_URL}#org` },
      },
      {
        '@type': 'SoftwareApplication',
        name: 'Krovo',
        url: SITE_URL,
        description: 'App de gestão de obras e reformas: controle de gastos, etapas, lista de materiais, fotos e leitura de nota fiscal por IA.',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web, Android, iOS',
        inLanguage: 'pt-BR',
        publisher: { '@id': `${SITE_URL}#org` },
        offers: FALLBACK_PLANS.map((p) => ({
          '@type': 'Offer',
          name: p.name,
          price: p.amount.toFixed(2),
          priceCurrency: 'BRL',
          url: SITE_URL,
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQ.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  }
}
