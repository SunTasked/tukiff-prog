// Sends web push notifications.
//  - Scheduled call (pg_cron, header x-notify-secret): newly published workouts -> assigned members,
//    one message per member.
//  - User call (Authorization: Bearer <user JWT>): test notification to the caller's own devices.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

type Message = { title: string; body: string; url: string }

async function sendTo(userIds: string[], messageFor: (userId: string) => Message) {
  if (!userIds.length) return 0
  const { data: subs } = await admin.from('push_subscriptions').select('*').in('user_id', userIds)
  let sent = 0
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(messageFor(s.user_id)),
          { TTL: 24 * 3600 },
        )
        sent++
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        // Expired or revoked subscription: forget it.
        if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('id', s.id)
        else console.error('push failed', status, (e as Error).message)
      }
    }),
  )
  return sent
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  if (req.headers.get('x-notify-secret') === Deno.env.get('NOTIFY_SECRET')) {
    const { data, error } = await admin.rpc('claim_notifications')
    if (error) return json({ error: error.message }, 500)
    const byUser = new Map<string, { title: string; date: string }[]>()
    for (const r of data ?? []) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r])
    const sent = await sendTo([...byUser.keys()], (userId) => {
      const list = byUser.get(userId)!.sort((a, b) => a.date.localeCompare(b.date))
      return list.length === 1
        ? { title: 'Nouvelle séance', body: list[0].title, url: `/?day=${list[0].date}` }
        : { title: `${list.length} nouvelles séances`, body: list.map((w) => w.title).join(' · '), url: `/?day=${list[0].date}` }
    })
    return json({ workouts: new Set((data ?? []).map((r) => r.workout_id)).size, members: byUser.size, sent })
  }

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  const { data: user } = token ? await admin.auth.getUser(token) : { data: { user: null } }
  if (!user?.user) return json({ error: 'unauthorized' }, 401)
  const sent = await sendTo([user.user.id], () => ({ title: 'TKF Programming', body: 'Les notifications fonctionnent 💪', url: '/' }))
  return json({ sent })
})
