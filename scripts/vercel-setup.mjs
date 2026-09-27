// Configures the Vercel project: env vars (prod Supabase for production, staging for previews) and preview protection off.
// Usage: node scripts/vercel-setup.mjs
import { api, refOf, urls } from './lib.mjs'

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

// Production uses the prod Supabase project; previews and local dev use staging.
const publishableOf = async (u) =>
  (await api('/api-keys?reveal=true', { project: refOf(u) })).find((k) => k.type === 'publishable').api_key
const wanted = [
  { target: ['production'], url: urls.prod },
  { target: ['preview', 'development'], url: urls.staging },
]

// Replace existing VITE_SUPABASE_* entries (they may cover several targets at once).
const { envs } = await vercel(`/v9/projects/${project}/env`)
for (const e of envs.filter((e) => e.key.startsWith('VITE_SUPABASE_'))) {
  await vercel(`/v9/projects/${project}/env/${e.id}`, { method: 'DELETE' })
}
for (const w of wanted) {
  const vars = { VITE_SUPABASE_URL: w.url, VITE_SUPABASE_ANON_KEY: await publishableOf(w.url) }
  for (const [key, value] of Object.entries(vars)) {
    await vercel(`/v10/projects/${project}/env`, { method: 'POST', body: { key, value, target: w.target, type: 'plain' } })
    console.log(`env ${key} -> ${w.target.join(',')} (${refOf(w.url)})`)
  }
}

await vercel(`/v9/projects/${project}`, { method: 'PATCH', body: { ssoProtection: null, framework: 'vite' } })
console.log('Protection des previews désactivée')
