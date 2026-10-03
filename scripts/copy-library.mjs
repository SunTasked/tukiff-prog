// Replaces the staging benchmark library (library sections, templates = workouts without a date, their blocks and
// items) with the production one; production is only read. Exercises used by the templates and missing on staging are
// copied too. Benchmarks are not editable in the app: their content is fed through the database.
// Staging records linked to a removed template keep their values, unlinked (on delete set null).
// Staging only (refuses TARGET=prod). Without --go it only prints the plan.
// Usage: node scripts/copy-library.mjs [--go]
import { randomBytes } from 'node:crypto'
import { api, ref, refOf, sql, target, urls } from './lib.mjs'

if (target !== 'staging') throw new Error('copy-library ne vise que staging (retirer TARGET)')
const prodRef = refOf(urls.prod)
if (prodRef === ref) throw new Error('Les URL staging et prod désignent le même projet')
const prod = (query) =>
  api('/database/query', { method: 'POST', project: prodRef, body: { query: `begin transaction read only;\n${query};\ncommit;` } })

const json = async (query) => (await prod(`select coalesce(json_agg(t), '[]') j from (${query}) t`))[0].j
const sections = await json('select id, name, created_at from public.library_sections')
const workouts = await json(`select id, title, notes, date, created_at, updated_at, publish_at, program_id, section_id, days
  from public.workouts where date is null`)
const blocks = await json(`select b.* from public.workout_blocks b join public.workouts w on w.id = b.workout_id where w.date is null`)
const items = await json(`select i.* from public.block_items i join public.workout_blocks b on b.id = i.block_id
  join public.workouts w on w.id = b.workout_id where w.date is null`)
const staged = new Set((await sql('select id from public.exercises')).map((r) => r.id))
const needed = [...new Set(items.map((i) => i.exercise_id).filter((id) => id && !staged.has(id)))]
const exercises = needed.length
  ? await json(`select id, name, description, video_url, measure, section_id, created_at from public.exercises
      where id in (${needed.map((id) => `'${id}'`).join(', ')})`)
  : []

console.log(`Prod ${prodRef} -> staging ${ref} : ${sections.length} sections, ${workouts.length} benchmarks, ` +
  `${blocks.length} blocs, ${items.length} lignes, ${exercises.length} exercices manquants`)
if (!process.argv.includes('--go')) {
  console.log('Rien n’a été fait. Relancer avec --go pour remplacer la bibliothèque de staging.')
  process.exit(0)
}

const lit = (rows) => {
  const tag = `$j${randomBytes(6).toString('hex')}$`
  return `${tag}${JSON.stringify(rows)}${tag}`
}
const insert = (table, rows) =>
  rows.length ? `insert into public.${table} select * from json_populate_recordset(null::public.${table}, ${lit(rows)});` : ''
// Exercise sections of copied exercises may not exist on staging: keep the exercise, without section.
await sql(`begin;
  delete from public.workouts where date is null;
  delete from public.library_sections;
  insert into public.exercises (id, name, description, video_url, measure, section_id, created_at)
    select id, name, description, video_url, measure,
      case when section_id in (select id from public.exercise_sections) then section_id end, created_at
    from json_populate_recordset(null::public.exercises, ${lit(exercises)});
  ${insert('library_sections', sections)}
  insert into public.workouts (id, title, notes, date, created_at, updated_at, publish_at, program_id, section_id, days)
    select id, title, notes, date, created_at, updated_at, publish_at, program_id, section_id, days
    from json_populate_recordset(null::public.workouts, ${lit(workouts)});
  ${insert('workout_blocks', blocks)}
  ${insert('block_items', items)}
  commit;`)
console.log('Bibliothèque de staging remplacée.')
