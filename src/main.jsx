import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthProvider.jsx'
import { ProjectProvider } from './lib/ProjectContext.jsx'
import './styles/tokens.css'
import './styles/global.css'

// PWA: além da checagem ao abrir, verifica nova versão a cada hora com o app
// aberto; com registerType 'autoUpdate' a página recarrega sozinha ao ativar.
// (O host serve sw.js com cache longo — a checagem ativa contorna o atraso.)
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, reg) {
    if (reg) setInterval(() => reg.update(), 60 * 60 * 1000)
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <ProjectProvider>
          <App />
        </ProjectProvider>
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>,
)
