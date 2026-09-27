// Deploys supabase/functions/<name>/index.ts via the Management API.
// Usage: node scripts/deploy-functions.mjs [name...]   (default: all)
import { readdir, readFile } from 'node:fs/promises'
import { ref } from './lib.mjs'

// Functions called before sign-in must not require a JWT.
const publicFunctions = new Set(['join', 'notify']) // notify checks its own auth (secret or user JWT)
const dir = new URL('../supabase/functions/', import.meta.url)
const names = process.argv.slice(2).length ? process.argv.slice(2) : await readdir(dir)

for (const name of names) {
  const form = new FormData()
  form.append('metadata', JSON.stringify({ name, entrypoint_path: 'index.ts', verify_jwt: !publicFunctions.has(name) }))
  form.append('file', new Blob([await readFile(new URL(`${name}/index.ts`, dir))]), 'index.ts')
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/functions/deploy?slug=${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.SUPABASE_AUTH_TOKEN}` },
    body: form,
  })
  if (!res.ok) throw new Error(`${name}: ${res.status} ${await res.text()}`)
  console.log(`Déployée : ${name}`)
}
