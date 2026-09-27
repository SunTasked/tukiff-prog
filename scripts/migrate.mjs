// Applies pending supabase/migrations/*.sql via the Management API.
// Usage: node scripts/migrate.mjs [--dry-run]
import { readdir, readFile } from 'node:fs/promises'
import { sql } from './lib.mjs'

const dir = new URL('../supabase/migrations/', import.meta.url)
const dryRun = process.argv.includes('--dry-run')

await sql(`
  create schema if not exists internal;
  create table if not exists internal.migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  );
`)
const applied = new Set((await sql('select name from internal.migrations')).map((r) => r.name))
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()
const pending = files.filter((f) => !applied.has(f))

if (!pending.length) console.log('Aucune migration en attente.')
for (const file of pending) {
  console.log(`${dryRun ? '[dry-run] ' : ''}-> ${file}`)
  if (dryRun) continue
  const body = await readFile(new URL(file, dir), 'utf8')
  const name = file.replaceAll("'", "''")
  await sql(`begin;\n${body}\n;insert into internal.migrations(name) values ('${name}');\ncommit;`)
}
