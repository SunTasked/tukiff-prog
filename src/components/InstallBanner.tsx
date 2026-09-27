import { useEffect, useState } from 'react'
import { installHint } from '../domain/install'
import { canPromptInstall, isStandalone, onInstallChange, promptInstall } from '../lib/install'
import { getItem, setItem } from '../lib/storage'

const DISMISS_KEY = 'installBannerDismissed'

export function InstallBanner() {
  const [canPrompt, setCanPrompt] = useState(canPromptInstall)
  const [dismissed, setDismissed] = useState(() => getItem(DISMISS_KEY) === '1')

  useEffect(() => onInstallChange(() => setCanPrompt(canPromptInstall())), [])

  const hint = installHint({ standalone: isStandalone(), userAgent: navigator.userAgent, canPrompt })
  if (hint === 'none' || dismissed) return null

  const dismiss = () => {
    setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">Installe l’application</p>
        <button aria-label="Fermer" className="-m-2 p-2 text-zinc-500" onClick={dismiss}>
          ✕
        </button>
      </div>
      {hint === 'ios' && (
        <p className="mt-1 text-zinc-400">
          Dans Safari, touche <b className="text-zinc-200">Partager</b> (carré avec une flèche) puis{' '}
          <b className="text-zinc-200">Sur l’écran d’accueil</b>. Tu resteras connecté et recevras les notifications.
        </p>
      )}
      {hint === 'android-manual' && (
        <p className="mt-1 text-zinc-400">
          Dans Chrome, ouvre le menu <b className="text-zinc-200">⋮</b> puis{' '}
          <b className="text-zinc-200">Installer l’application</b> (ou « Ajouter à l’écran d’accueil »).
        </p>
      )}
      {hint === 'android-prompt' && (
        <button className="mt-2 w-full rounded-xl bg-lime-400 py-2 font-semibold text-zinc-950" onClick={promptInstall}>
          Installer
        </button>
      )}
    </div>
  )
}
