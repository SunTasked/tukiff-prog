// Shared helpers for admin scripts (Supabase Management API).
// Target: staging by default; production only with TARGET=prod (e.g. `TARGET=prod node scripts/migrate.mjs`).
export const urls = { prod: process.env.SUPABASE_URL, staging: process.env.SUPABASE_STAGING_URL }
export const target = process.env.TARGET ?? 'staging'
if (!(target in urls)) throw new Error(`TARGET inconnu : ${target} (staging | prod)`)
export const url = urls[target]
if (!url) throw new Error(`URL Supabase manquante pour la cible ${target}`)
export const refOf = (u) => new URL(u).hostname.split('.')[0]
export const ref = refOf(url)
console.error(`[cible : ${target} (${ref})]`)
const token = process.env.SUPABASE_AUTH_TOKEN
if (!token) throw new Error('SUPABASE_AUTH_TOKEN manquant')

export async function api(path, { method = 'GET', body, project = ref } = {}) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${project}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text}`)
  return text ? JSON.parse(text) : null
}

export const sql = (query) => api('/database/query', { method: 'POST', body: { query } })

export async function serviceKey() {
  const keys = await api('/api-keys?reveal=true')
  return keys.find((k) => k.name === 'service_role').api_key
}
