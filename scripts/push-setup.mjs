// Web Push setup: VAPID keys + shared secret, stored where they are used.
//  - Supabase Edge Function secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, NOTIFY_SECRET
//  - Supabase Vault: notify_secret (read by the pg_cron job calling the notify function)
//  - Vercel env: VITE_VAPID_PUBLIC_KEY
// Does nothing if already configured, unless --rotate (rotating invalidates every subscription).
import { generateKeyPairSync, randomBytes } from 'node:crypto'
import { api, sql } from './lib.mjs'

const existing = (await api('/secrets')).map((s) => s.name)
if (existing.includes('VAPID_PRIVATE_KEY') && !process.argv.includes('--rotate')) {
  console.log('Push déjà configuré (utiliser --rotate pour régénérer les clés).')
  process.exit(0)
}

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const jwk = privateKey.export({ format: 'jwk' })
const publicKey = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]).toString('base64url')
const notifySecret = randomBytes(24).toString('base64url')

await api('/secrets', {
  method: 'POST',
  body: [
    { name: 'VAPID_PUBLIC_KEY', value: publicKey },
    { name: 'VAPID_PRIVATE_KEY', value: jwk.d },
    { name: 'VAPID_SUBJECT', value: 'mailto:guillaume.kheng@gmail.com' },
    { name: 'NOTIFY_SECRET', value: notifySecret },
  ],
})

await sql(`
  delete from vault.secrets where name = 'notify_secret';
  select vault.create_secret('${notifySecret}', 'notify_secret');`)

const res = await fetch('https://api.vercel.com/v10/projects/tukiff-prog/env?upsert=true&slug=tukiff', {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    key: 'VITE_VAPID_PUBLIC_KEY',
    value: publicKey,
    type: 'plain',
    target: ['production', 'preview', 'development'],
  }),
})
if (!res.ok) throw new Error(`Vercel: ${res.status} ${await res.text()}`)
console.log('Clés VAPID et secret de notification configurés.')
