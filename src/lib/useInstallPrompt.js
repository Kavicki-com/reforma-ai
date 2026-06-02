import { useEffect, useState } from 'react'

// Gerencia a instalação do PWA.
// Chrome/Edge/Android disparam 'beforeinstallprompt' — guardamos o evento para
// abrir o instalador nativo direto, sem o usuário entrar nas configurações.
// iOS/Safari não dispara o evento, então mostramos instruções (Compartilhar →
// Adicionar à Tela de Início).
//
// O evento 'beforeinstallprompt' dispara cedo, no carregamento da página. Por
// isso escutamos no nível do módulo (uma vez só) e avisamos os componentes —
// assim uma tela que monta depois (ex.: resumo público) não perde o evento.

let deferredPrompt = null
let installed = false
const subscribers = new Set()

function notify() {
  for (const fn of subscribers) fn()
}

if (typeof window !== 'undefined') {
  installed =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    notify()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferredPrompt = null
    notify()
  })
}

const isIOS =
  typeof navigator !== 'undefined' &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPad em iOS 13+ se identifica como Mac, mas tem touch
    (/Macintosh/.test(navigator.userAgent) && typeof document !== 'undefined' && 'ontouchend' in document))

export function useInstallPrompt() {
  const [, force] = useState(0)

  useEffect(() => {
    const fn = () => force((n) => n + 1)
    subscribers.add(fn)
    return () => subscribers.delete(fn)
  }, [])

  async function promptInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      deferredPrompt = null
      notify()
      return choice?.outcome === 'accepted' ? 'installed' : 'dismissed'
    }
    return isIOS ? 'ios' : 'unsupported'
  }

  return { canInstall: !!deferredPrompt, installed, isIOS, promptInstall }
}
