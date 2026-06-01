# Reforma AI

Web app **mobile-first** para gerenciar a obra de reforma do apartamento: lançamentos de
materiais, mão de obra e reembolsos; notas fiscais; lista de compras; orçamento previsto vs.
gasto; etapas/cronograma; e fotos do andamento. O sogro acompanha tudo em modo **somente
leitura**.

**Stack:** React + Vite + CSS puro (CSS Modules) · Supabase (Postgres + Auth + Storage).

---

## 1. Configuração local

```bash
npm install
cp .env.example .env   # já preenchido com a URL e a chave deste projeto
npm run dev            # http://localhost:5173
```

O `.env` usa a **publishable key** (pública por design). A segurança real é garantida por
**RLS + Auth** no Supabase.

---

## 2. Criar os usuários

Como não há tela de cadastro (intencional), os usuários são criados direto no Supabase:

1. Painel do Supabase → **Authentication → Users → Add user**.
2. Crie:
   - **você** — `design@kavicki.com` (será o admin)
   - **seu sogro** — e-mail dele (ficará como visualizador)
   - Marque *Auto Confirm User* para não precisar de e-mail de confirmação.
3. Um *trigger* cria automaticamente o perfil de cada um com papel **`viewer`**.
4. Promova **você** a admin rodando no **SQL Editor**:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'design@kavicki.com');
```

Pronto: você cria/edita/exclui tudo; o sogro vê tudo mas sem botões de edição (e o RLS
bloqueia escrita no backend mesmo que alguém tente forçar).

---

## 3. Estrutura

```
src/
  lib/        supabase.js, format.js (BRL/datas), useProject.js
  auth/       AuthProvider.jsx (sessão + papel)
  components/ BottomNav, Spinner, ProgressBar, Toast
  routes/     Login, Dashboard, Entries, EntryForm, Stages, Budget, Shopping, Photos
  styles/     tokens.css (variáveis) + global.css
```

### Banco de dados (já aplicado via migrações)
- **Tabelas:** `profiles`, `projects`, `stages`, `categories`, `entries`, `attachments`,
  `photos`, `shopping_items`.
- **Views:** `v_project_totals` (gasto, a pagar, pago, saldo, **gasto estimado**, duração),
  `v_category_totals`, `v_stage_totals`.
- **RLS:** todos autenticados leem; só `admin` escreve (função `is_admin()`).
- **Storage:** buckets privados `notas` (notas fiscais) e `fotos` (galeria), acessados via
  *signed URLs*.

---

## 4. Build e deploy (SFTP em subdomínio)

```bash
npm run build      # gera a pasta dist/
npm run preview    # testa o build localmente antes de enviar
```

Envie **todo o conteúdo de `dist/`** para a pasta do subdomínio via SFTP.

- O app usa **HashRouter** e `base: './'`, então funciona em qualquer subpasta/subdomínio
  **sem configurar rewrites no servidor** (as rotas ficam como `/#/lancamentos`).
- Para atualizar, rode `npm run build` de novo e reenvie `dist/`.

> Se um dia quiser URLs sem `#`, troque `HashRouter` por `BrowserRouter` em
> `src/main.jsx` e adicione um `.htaccess`/regra de rewrite redirecionando tudo para
> `index.html`.

---

## 5. Como usar
- **Início:** visão geral — gasto total, a pagar, pago, gasto estimado, saldo e duração.
- **Gastos:** lista de lançamentos com filtros (a pagar / pagos / reembolsos) e anexo de notas.
- **Compras:** lista de materiais com status *a comprar* / *comprado* e estimativa de gasto.
- **Etapas:** cronograma com orçado vs. gasto por etapa.
- **Orçamento:** define o orçamento total e mostra o gasto por categoria.
- **Fotos:** galeria do andamento da obra.
