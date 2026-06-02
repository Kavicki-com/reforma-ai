import { useState } from 'react'
import { useInstallPrompt } from '../lib/useInstallPrompt'
import BottomSheet from './BottomSheet'
import Icon from './Icon'
import styles from './InstallButton.module.css'

// Botão único de "Instalar app" reutilizável.
// - Android/Chrome/Edge: abre o instalador nativo direto (sem entrar nas
//   configurações do navegador).
// - iPhone/iPad ou navegadores sem suporte: abre um passo a passo visual.
// Some sozinho quando o app já está instalado.
export default function InstallButton({ className, label = 'Instalar app', iconSize = 22, onAfter }) {
  const { installed, promptInstall } = useInstallPrompt()
  const [sheet, setSheet] = useState(null) // null | 'ios' | 'generic'

  if (installed) return null

  async function handleClick() {
    const r = await promptInstall()
    if (r === 'ios') setSheet('ios')
    else if (r === 'unsupported') setSheet('generic')
    onAfter?.(r)
  }

  return (
    <>
      <button type="button" className={className} onClick={handleClick}>
        <Icon name="install_mobile" size={iconSize} /> {label}
      </button>

      <BottomSheet open={sheet !== null} title="Instalar o app" onClose={() => setSheet(null)}>
        {sheet === 'ios' ? (
          <ol className={styles.steps}>
            <li>
              <Icon name="ios_share" className={styles.stepIcon} />
              <span>Toque no botão <strong>Compartilhar</strong> na barra do Safari.</span>
            </li>
            <li>
              <Icon name="add_box" className={styles.stepIcon} />
              <span>Escolha <strong>Adicionar à Tela de Início</strong>.</span>
            </li>
            <li>
              <Icon name="check_circle" className={styles.stepIcon} />
              <span>Toque em <strong>Adicionar</strong>. Pronto!</span>
            </li>
          </ol>
        ) : (
          <ol className={styles.steps}>
            <li>
              <Icon name="more_vert" className={styles.stepIcon} />
              <span>Abra o menu do navegador (⋮).</span>
            </li>
            <li>
              <Icon name="install_mobile" className={styles.stepIcon} />
              <span>Escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</span>
            </li>
            <li>
              <Icon name="check_circle" className={styles.stepIcon} />
              <span>Confirme. Pronto!</span>
            </li>
          </ol>
        )}
      </BottomSheet>
    </>
  )
}
