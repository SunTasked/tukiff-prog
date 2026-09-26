// Configures the Vercel project: env vars (from Supabase) and preview protection off.
// Usage: node scripts/vercel-setup.mjs
import { api } from './lib.mjs'

const project = 'tukiff-prog'
const team = 'slug=tukiff'
const token = process.env.VERCEL_TOKEN

async function vercel(path, { method = 'GET', body } = {}) {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`https://api.vercel.com${path}${sep}${team}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`)
  return json
}

const keys = await api('/api-keys?reveal=true')
const publishable = keys.find((k) => k.type === 'publishable').api_key

const env = [
  { key: 'VITE_SUPABASE_URL', value: process.env.SUPABASE_URL, target: ['production', 'preview', 'development'] },
  { key: 'VITE_SUPABASE_ANON_KEY', value: publishable, target: ['production', 'preview', 'development'] },
  // Password login for test accounts: previews only.
  { key: 'VITE_DEV_LOGIN', value: '1', target: ['preview'] },
]
for (const e of env) {
  await vercel(`/v10/projects/${project}/env?upsert=true`, { method: 'POST', body: { ...e, type: 'plain' } })
  console.log(`env ${e.key} -> ${e.target.join(',')}`)
}

await vercel(`/v9/projects/${project}`, { method: 'PATCH', body: { ssoProtection: null, framework: 'vite' } })
console.log('Protection des previews désactivée')
