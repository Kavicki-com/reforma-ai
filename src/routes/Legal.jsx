import { Link } from 'react-router-dom'
import CompanyFooter from '../components/CompanyFooter'
import Icon from '../components/Icon'
import styles from './Legal.module.css'

const logo = `${import.meta.env.BASE_URL}pwa-192.png`
const UPDATED = '3 de junho de 2026'

// Layout compartilhado das páginas legais (Termos de Uso e Política de Privacidade).
function LegalLayout({ title, children }) {
  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <Link to="/" className={styles.brand}>
          <img src={logo} alt="" /> <span>Krovo</span>
        </Link>
        <Link to="/" className={styles.back}>
          <Icon name="arrow_back" size={18} /> Voltar
        </Link>
      </header>
      <main className={styles.body}>
        <h1>{title}</h1>
        <p className={styles.updated}>Última atualização: {UPDATED}</p>
        {children}
      </main>
      <CompanyFooter />
    </div>
  )
}

// Conteúdo (prosa) dos documentos, sem o layout de página — reutilizável tanto
// nas rotas /termos e /privacidade quanto nos modais da tela de cadastro.
export function TermosContent() {
  return (
    <div className={styles.prose}>
      <h2>1. Sobre o serviço</h2>
      <p>
        O Krovo é uma plataforma de gestão de obras e reformas que permite registrar
        lançamentos de gastos, etapas, listas de materiais, fotos e gerar resumos da obra,
        incluindo leitura de notas fiscais por inteligência artificial. O Krovo é um
        produto kavicki.com.
      </p>

      <h2>2. Cadastro e conta</h2>
      <p>
        Para usar o Krovo você precisa criar uma conta com dados verdadeiros e mantê-los
        atualizados. Você é responsável por guardar sua senha e por toda atividade
        realizada na sua conta. O serviço destina-se a maiores de 18 anos.
      </p>

      <h2>3. Período de teste</h2>
      <p>
        Novas contas têm um período de teste gratuito, sem necessidade de cartão de
        crédito, com acesso a todas as funções. Ao final do período, a continuidade do
        acesso depende da contratação de uma assinatura.
      </p>

      <h2>4. Assinatura e pagamento</h2>
      <p>
        As assinaturas são oferecidas nos ciclos mensal e anual, com pagamento processado
        pelo Mercado Pago (cartão de crédito ou PIX). A assinatura é renovada
        automaticamente ao final de cada ciclo. Você pode cancelar a qualquer momento,
        direto no app, mantendo o acesso até o fim do período já pago. Alterações de preço
        serão comunicadas com antecedência e valem a partir do ciclo seguinte.
      </p>

      <h2>5. Conteúdo do usuário</h2>
      <p>
        Os dados que você registra (lançamentos, fotos, notas fiscais, informações da
        obra) são seus. Você nos concede uma licença limitada para armazenar e processar
        esse conteúdo exclusivamente para operar o serviço. Não use o Krovo para
        armazenar conteúdo ilícito ou de terceiros sem autorização.
      </p>

      <h2>6. Leitura de notas por IA</h2>
      <p>
        A leitura de notas fiscais por inteligência artificial é um recurso auxiliar de
        digitação. Os valores extraídos devem sempre ser revisados antes de salvar — não
        garantimos exatidão total do reconhecimento.
      </p>

      <h2>7. Resumo público</h2>
      <p>
        O recurso de resumo público gera um link acessível por qualquer pessoa que o
        possua. A decisão de compartilhar esse link, e com quem, é sua.
      </p>

      <h2>8. Disponibilidade</h2>
      <p>
        Empregamos esforços razoáveis para manter o serviço disponível e seguro, mas não
        garantimos disponibilidade ininterrupta. Manutenções programadas e eventos fora do
        nosso controle podem causar indisponibilidade temporária.
      </p>

      <h2>9. Limitação de responsabilidade</h2>
      <p>
        O Krovo é uma ferramenta de organização e acompanhamento. As decisões sobre a
        obra — orçamentos, contratações, compras e prazos — são de responsabilidade do
        usuário. Não nos responsabilizamos por perdas decorrentes dessas decisões.
      </p>

      <h2>10. Encerramento da conta</h2>
      <p>
        Você pode excluir sua conta a qualquer momento. Podemos suspender contas que
        violem estes termos. Após a exclusão, os dados são tratados conforme a{' '}
        <Link to="/privacidade">Política de Privacidade</Link>.
      </p>

      <h2>11. Alterações destes termos</h2>
      <p>
        Estes termos podem ser atualizados. Mudanças relevantes serão comunicadas pelo
        app ou por e-mail. O uso continuado do serviço após a comunicação significa
        concordância com a nova versão.
      </p>

      <h2>12. Legislação e contato</h2>
      <p>
        Estes termos são regidos pela legislação brasileira. Em caso de dúvidas, fale com
        a gente pelo site <a href="https://kavicki.com" target="_blank" rel="noreferrer">kavicki.com</a>.
      </p>
    </div>
  )
}

export function PrivacidadeContent() {
  return (
    <div className={styles.prose}>
      <h2>1. Dados que coletamos</h2>
      <p>
        Ao criar sua conta coletamos nome, e-mail e endereço. Durante o uso, armazenamos
        os dados que você registra na plataforma: lançamentos de gastos, etapas, listas de
        materiais, fotos e imagens de notas fiscais. Os dados de pagamento (cartão ou PIX)
        são processados diretamente pelo Mercado Pago — não armazenamos o número completo
        do seu cartão.
      </p>

      <h2>2. Como usamos os dados</h2>
      <p>
        Usamos seus dados para operar o serviço: manter sua conta, processar a leitura de
        notas fiscais por IA, gerar os painéis e resumos da sua obra, processar cobranças
        e enviar comunicações sobre a sua conta e assinatura.
      </p>

      <h2>3. Compartilhamento</h2>
      <p>
        Não vendemos seus dados. Compartilhamos apenas com os provedores necessários para
        operar o serviço: infraestrutura de banco de dados e autenticação (Supabase),
        processamento de pagamentos (Mercado Pago) e o provedor de IA usado na leitura de
        notas fiscais — restrito à imagem enviada para extração dos itens.
      </p>

      <h2>4. Resumo público</h2>
      <p>
        Se você ativar o resumo público da obra, as informações incluídas nele ficam
        acessíveis a qualquer pessoa com o link. Você pode desativar o link a qualquer
        momento.
      </p>

      <h2>5. Seus direitos (LGPD)</h2>
      <p>
        Nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você pode
        solicitar acesso, correção, portabilidade ou exclusão dos seus dados pessoais, e
        revogar consentimentos. Para exercer esses direitos, fale com a gente pelo site{' '}
        <a href="https://kavicki.com" target="_blank" rel="noreferrer">kavicki.com</a>.
      </p>

      <h2>6. Segurança</h2>
      <p>
        Seus dados trafegam criptografados e cada conta é isolada das demais no banco de
        dados. O acesso à sua obra exige autenticação, exceto pelo resumo público quando
        você opta por compartilhá-lo.
      </p>

      <h2>7. Retenção</h2>
      <p>
        Mantemos seus dados enquanto sua conta existir. Ao excluir a conta, os dados são
        removidos, exceto registros que precisamos manter por obrigação legal (como
        registros fiscais de pagamento).
      </p>

      <h2>8. Cookies e armazenamento local</h2>
      <p>
        Usamos armazenamento local do navegador apenas para manter sua sessão e
        preferências do app. Não usamos cookies de publicidade de terceiros.
      </p>

      <h2>9. Alterações desta política</h2>
      <p>
        Esta política pode ser atualizada. Mudanças relevantes serão comunicadas pelo app
        ou por e-mail, com a data de atualização sempre indicada no topo desta página.
      </p>
    </div>
  )
}

// Páginas completas (rotas /termos e /privacidade).
export function Termos() {
  return <LegalLayout title="Termos de Uso"><TermosContent /></LegalLayout>
}

export function Privacidade() {
  return <LegalLayout title="Política de Privacidade"><PrivacidadeContent /></LegalLayout>
}
