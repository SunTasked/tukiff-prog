// Applies pending supabase/migrations/*.sql via the Management API.
// Usage: node scripts/migrate.mjs [--dry-run]
import { appliedMigrations, applyMigration, migrationFiles } from './lib.mjs'

const dryRun = process.argv.includes('--dry-run')

const applied = await appliedMigrations()
const pending = (await migrationFiles()).filter((f) => !applied.has(f))

if (!pending.length) console.log('Aucune migration en attente.')
for (const file of pending) {
  console.log(`${dryRun ? '[dry-run] ' : ''}-> ${file}`)
  if (!dryRun) await applyMigration(file)
}
