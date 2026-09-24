// Pós-build: renderiza a landing no Chrome headless e grava o HTML dentro do
// #root do dist/index.html, para buscadores e crawlers de IA (que não rodam JS)
// enxergarem o conteúdo. O React substitui esse HTML ao montar (createRoot).
import { execFile } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { preview } from 'vite'

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean)

const DIST = 'dist/index.html'
const ROOT_OPEN = '<div id="root">'

// Logado, rota do app (#/login…) ou retorno de e-mail (?code=…): descarta a
// landing pré-renderizada antes de pintar, para não piscar a página errada.
const GUARD = `<script>(function(){try{var h=location.hash,s=Object.keys(localStorage).some(function(k){return /^sb-.*-auth-token$/.test(k)});if(s||location.search||(h&&h!=='#'&&h!=='#/'))document.getElementById('root').innerHTML=''}catch(e){}})()</script>`

function innerRoot(html) {
  const start = html.indexOf(ROOT_OPEN)
  if (start < 0) return null
  const tag = /<(\/?)div\b[^>]*>/g
  tag.lastIndex = start + ROOT_OPEN.length
  let depth = 1
  let m
  while ((m = tag.exec(html))) {
    depth += m[1] ? -1 : 1
    if (depth === 0) return html.slice(start + ROOT_OPEN.length, m.index)
  }
  return null
}

const chrome = CHROME_CANDIDATES.find((p) => existsSync(p))
if (!chrome) {
  console.warn('[prerender] Chrome não encontrado (defina CHROME_PATH). Build segue sem pré-renderização.')
  process.exit(0)
}

const server = await preview({ preview: { port: 4179, open: false }, logLevel: 'silent' })
const url = server.resolvedUrls.local[0]
const profile = mkdtempSync(join(tmpdir(), 'krovo-prerender-'))
try {
  const { stdout: dom } = await promisify(execFile)(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    `--user-data-dir=${profile}`,
    '--window-size=1280,2400',
    '--timeout=8000',
    '--host-resolver-rules=MAP www.googletagmanager.com 127.0.0.1, MAP www.clarity.ms 127.0.0.1',
    '--dump-dom',
    url,
  ], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 60000 })

  const body = innerRoot(dom)
  if (!body || !body.includes('<h1')) throw new Error('landing não renderizou (sem <h1> no #root)')

  const html = readFileSync(DIST, 'utf8')
  if (!html.includes(`${ROOT_OPEN}</div>`)) throw new Error('#root vazio não encontrado no dist/index.html')
  writeFileSync(DIST, html.replace(`${ROOT_OPEN}</div>`, `${ROOT_OPEN}${body}</div>\n    ${GUARD}`))
  console.log(`[prerender] landing gravada em ${DIST} (${(body.length / 1024).toFixed(1)} KB)`)
} finally {
  await server.close()
  rmSync(profile, { recursive: true, force: true })
}
