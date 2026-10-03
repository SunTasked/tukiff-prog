// Rebuilds the staging database from production:
//   1. wipes staging (public and internal schemas, storage policies, cron jobs, auth users),
//   2. replays the migrations already applied in production,
//   3. with --prod-data only: copies the production data (public tables, auth.users, auth.identities; prod is
//      only read). Real emails and password hashes end up on staging: keep it for a release test on real data,
//      then rerun without it,
//      without it, only the exercise library (sections, exercises without authors) is copied,
//   4. applies the migrations of this checkout that production does not have yet (features waiting in `staging`),
//   5. reruns the test dataset (scripts/seed-dev.mjs).
// Use it to drop the migration of an abandoned feature, or to test a release on production data.
// Run it from an up-to-date `staging` checkout: the migrations of step 4 are the files present here.
// Storage files are not copied (production avatars do not show on staging).
// Staging only (refuses TARGET=prod). Without --go it only prints the plan.
// Usage: node scripts/reset-staging.mjs [--go] [--prod-data] [--no-seed]
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { api, appliedMigrations, applyMigration, migrationFiles, ref, refOf, sql, target, urls } from './lib.mjs'

const args = process.argv.slice(2)
const go = args.includes('--go')
const withData = args.includes('--prod-data')
const withSeed = !args.includes('--no-seed')

if (target !== 'staging') throw new Error('reset-staging ne vise que staging (retirer TARGET)')
const prodRef = refOf(urls.prod)
if (prodRef === ref) throw new Error('Les URL staging et prod désignent le même projet')

// Production: read-only transactions only.
const prod = (query) =>
  api('/database/query', { method: 'POST', project: prodRef, body: { query: `begin transaction read only;\n${query};\ncommit;` } })

const prodApplied = (await prod('select name from internal.migrations order by name')).map((r) => r.name)
const files = await migrationFiles()
const missing = prodApplied.filter((f) => !files.includes(f))
if (missing.length) throw new Error(`Migrations de la prod absentes de ce dépôt (mettre la branche à jour) : ${missing.join(', ')}`)
const base = files.filter((f) => prodApplied.includes(f))
const pending = files.filter((f) => !prodApplied.includes(f))
const stagingApplied = await appliedMigrations()
const dropped = [...stagingApplied].filter((f) => !files.includes(f)).sort()

console.log(`Staging ${ref} reconstruite depuis la prod ${prodRef} :`)
console.log(`- ${base.length} migrations de la prod (jusqu'à ${base.at(-1)})`)
console.log(`- données de la prod : ${withData ? 'oui' : 'non'}`)
console.log(`- migrations pas encore en prod : ${pending.join(', ') || 'aucune'}`)
console.log(`- migrations de staging retirées (absentes du dépôt) : ${dropped.join(', ') || 'aucune'}`)
console.log(`- jeu de test seed-dev : ${withSeed ? 'oui' : 'non'}`)
if (!go) {
  console.log('\nRien n’a été fait. Relancer avec --go pour effacer et reconstruire staging.')
  process.exit(0)
}

console.log('\nEffacement de staging…')
await sql(`
  select cron.unschedule(jobid) from cron.job;
  drop schema if exists internal cascade;
  do $$
  declare r record;
  begin
    for r in select policyname, tablename from pg_policies where schemaname = 'storage' loop
      execute format('drop policy %I on storage.%I', r.policyname, r.tablename);
    end loop;
    for r in
      select c.relname, case c.relkind when 'v' then 'view' when 'm' then 'materialized view' else 'table' end kind
      from pg_class c
      where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm')
        and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
    loop
      execute format('drop %s if exists public.%I cascade', r.kind, r.relname);
    end loop;
    for r in
      select p.oid::regprocedure sig, case p.prokind when 'p' then 'procedure' when 'a' then 'aggregate' else 'function' end kind
      from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    loop
      execute format('drop %s if exists %s cascade', r.kind, r.sig);
    end loop;
    for r in
      select t.typname from pg_type t
      where t.typnamespace = 'public'::regnamespace and t.typtype in ('e', 'd', 'c')
        and (t.typtype <> 'c' or (select relkind from pg_class where oid = t.typrelid) = 'c')
        and not exists (select 1 from pg_depend d where d.objid = t.oid and d.deptype = 'e')
    loop
      execute format('drop type if exists public.%I cascade', r.typname);
    end loop;
    for r in select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'S' loop
      execute format('drop sequence if exists public.%I cascade', r.relname);
    end loop;
  end $$;
  delete from auth.users;
`)

await appliedMigrations() // recreates internal.migrations
for (const file of base) {
  console.log(`-> ${file}`)
  await applyMigration(file)
}

const columnsOf = async (run, table) => {
  const [schema, name] = table.split('.')
  const rows = await run(`select quote_ident(column_name) c from information_schema.columns
    where table_schema = '${schema}' and table_name = '${name.replaceAll('"', '')}' and is_generated = 'NEVER'
    order by ordinal_position`)
  return rows.map((r) => r.c)
}

// Copies a production table into the (empty) staging table, 500 rows at a time, triggers and FK checks off.
async function copyTable(table, { exclude = [] } = {}) {
  const prodCols = new Set(await columnsOf(prod, table))
  const cols = (await columnsOf(sql, table)).filter((c) => prodCols.has(c) && !exclude.includes(c)).join(', ')
  const [{ n }] = await prod(`select count(*)::int n from ${table}`)
  const [{ k }] = await prod(`select coalesce(string_agg(quote_ident(a.attname), ', '), 'ctid') k
    from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
    where i.indrelid = '${table}'::regclass and i.indisprimary`)
  for (let offset = 0; offset < n; offset += 500) {
    const [{ j }] = await prod(`select coalesce(json_agg(t), '[]') j
      from (select ${cols} from ${table} order by ${k} limit 500 offset ${offset}) t`)
    const tag = `$j${randomBytes(6).toString('hex')}$`
    await sql(`begin;
      set local session_replication_role = replica;
      insert into ${table} (${cols}) overriding system value
        select ${cols} from json_populate_recordset(null::${table}, ${tag}${JSON.stringify(j)}${tag});
      commit;`)
  }
  console.log(`   ${table} : ${n}`)
}

if (withData) {
  console.log('Copie des données de la prod…')
  const tables = (await sql(`select 'public.' || quote_ident(relname) t from pg_class
    where relnamespace = 'public'::regnamespace and relkind in ('r', 'p') order by relname`)).map((r) => r.t)
  for (const table of ['auth.users', 'auth.identities', ...tables]) await copyTable(table)
  // Identity / serial columns continue after the copied ids.
  await sql(`
    do $$
    declare r record;
    begin
      for r in select table_name, column_name, pg_get_serial_sequence('public.' || quote_ident(table_name), column_name) seq
        from information_schema.columns where table_schema = 'public'
          and pg_get_serial_sequence('public.' || quote_ident(table_name), column_name) is not null
      loop
        execute format('select setval(%L, coalesce((select max(%I) from public.%I), 0) + 1, false)', r.seq, r.column_name, r.table_name);
      end loop;
    end $$;
  `)
} else {
  // The exercise library is shared reference data (no personal data once its author is removed); seed-dev needs it.
  console.log('Copie de la bibliothèque d’exercices de la prod…')
  // Sections too: the replayed migrations create them with other ids, exercises would point to missing sections.
  await sql('delete from public.exercises; delete from public.exercise_sections;')
  await copyTable('public.exercise_sections')
  await copyTable('public.exercises', { exclude: ['created_by'] })
}

for (const file of pending) {
  console.log(`-> ${file}`)
  await applyMigration(file)
}

if (withSeed) {
  console.log('Jeu de test…')
  const { status } = spawnSync('node', [new URL('seed-dev.mjs', import.meta.url).pathname], {
    stdio: 'inherit',
    env: { ...process.env, TARGET: 'staging' },
  })
  if (status) process.exit(status)
}
console.log('Staging reconstruite.')
