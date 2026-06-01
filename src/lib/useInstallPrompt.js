import { useEffect, useState } from 'react'

// Gerencia a instalação do PWA (Chrome/Edge/Android via beforeinstallprompt;
// iOS/Safari não dispara o evento, então mostramos instruções).
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    setInstalled(standalone)

    const onPrompt = (e) => { e.preventDefault(); setDeferred(e) }
    const onInstalled = () => { setInstalled(true); setDeferred(null) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)

  async function promptInstall() {
    if (deferred) {
      deferred.prompt()
      await deferred.userChoice
      setDeferred(null)
      return 'prompted'
    }
    return isIOS ? 'ios' : 'unsupported'
  }

  return { canInstall: !!deferred, installed, isIOS, promptInstall }
}
