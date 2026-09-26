// Shared helpers for admin scripts (Supabase Management API).
export const ref = new URL(process.env.SUPABASE_URL).hostname.split('.')[0]
const token = process.env.SUPABASE_AUTH_TOKEN
if (!token) throw new Error('SUPABASE_AUTH_TOKEN manquant')

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}${path}`, {
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
