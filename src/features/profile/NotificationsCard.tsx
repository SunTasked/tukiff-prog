import { useEffect, useState } from 'react'
import { Button, Card, ErrorText } from '../../components/ui'
import { isStandalone } from '../../lib/install'
import { supabase } from '../../lib/supabase'

const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent)

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

/** Enable / disable push notifications on this device (one subscription per device). */
export function NotificationsCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (supported) currentSubscription().then((s) => setEnabled(!!s))
  }, [])

  async function enable() {
    setBusy(true)
    setError('')
    try {
      if ((await Notification.requestPermission()) !== 'granted') {
        throw new Error('Notifications refusées. Autorise-les dans les réglages du téléphone pour cette app.')
      }
      const reg = await navigator.serviceWorker.ready
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
        }))
      const { endpoint, keys } = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({ endpoint, p256dh: keys.p256dh, auth: keys.auth }, { onConflict: 'endpoint' })
      if (error) throw new Error(error.message)
      setEnabled(true)
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(false)
  }

  async function disable() {
    setBusy(true)
    const sub = await currentSubscription()
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      await sub.unsubscribe()
    }
    setEnabled(false)
    setBusy(false)
  }

  async function test() {
    setMessage('')
    const { data, error } = await supabase.functions.invoke('notify', { body: {} })
    if (error) setError(error.message)
    else setMessage(data.sent ? 'Notification envoyée, elle arrive dans quelques secondes.' : 'Aucun appareil abonné.')
  }

  return (
    <Card className="flex flex-col gap-2">
      <h2 className="font-semibold">Notifications</h2>
      {!supported || (isIos && !isStandalone()) ? (
        <p className="text-sm text-zinc-400">
          {isIos
            ? 'Sur iPhone, les notifications ne marchent que dans l’app installée : Partager → Sur l’écran d’accueil, puis ouvre l’app depuis l’icône.'
            : 'Ce navigateur ne gère pas les notifications.'}
        </p>
      ) : (
        <>
          <p className="text-sm text-zinc-400">Être prévenu quand une nouvelle séance est publiée pour toi.</p>
          {enabled ? (
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1 py-2 text-sm" disabled={busy} onClick={test}>
                Tester
              </Button>
              <Button variant="danger" className="flex-1 py-2 text-sm" disabled={busy} onClick={disable}>
                Désactiver
              </Button>
            </div>
          ) : (
            <Button className="py-2" disabled={busy || enabled === null} onClick={enable}>
              Activer sur cet appareil
            </Button>
          )}
        </>
      )}
      {message && <p className="text-sm text-lime-400">{message}</p>}
      <ErrorText>{error}</ErrorText>
    </Card>
  )
}
