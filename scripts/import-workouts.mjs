// Import dated workouts into a program. Copy into scripts/ of the repo, then: [TARGET=prod] node scripts/import-workouts.mjs <file.json> [--program name] [--dry-run]. Skips existing (program, date, title); publish 07:00 Paris.
import { readFileSync } from 'node:fs'
import { sql, target } from './lib.mjs'
const args = process.argv.slice(2)
const data = JSON.parse(readFileSync(args[0], 'utf8'))
const pi = args.indexOf('--program')
const programName = pi > -1 ? args[pi + 1] : data.program
const dry = args.includes('--dry-run')
const q = (s) => (s == null ? 'null' : `'${String(s).replaceAll("'", "''")}'`)
const n = (v) => (v == null ? 'null' : Number(v))
const [prog] = await sql(`select id, owner_id from public.programs where lower(trim(name)) = lower(${q(programName)}) and archived_at is null`)
if (!prog) throw new Error(`Programme introuvable : ${programName}`)
const ex = new Map((await sql('select id, name from public.exercises')).map((e) => [e.name.trim().toLowerCase(), e.id]))
const exId = (name) => { const id = ex.get(name.trim().toLowerCase()); if (!id) throw new Error(`Exercice manquant : ${name}`); return id }
let stmts = []
for (const w of data.workouts) {
  const exists = await sql(`select id from public.workouts where program_id = '${prog.id}' and date = '${w.date}' and title = ${q(w.title)}`)
  if (exists.length) { console.log(`Existe déjà, ignorée : ${w.date} ${w.title}`); continue }
  const publish = `(${q(w.date + ' 07:00')}::timestamp at time zone 'Europe/Paris')`
  let s = `with w as (insert into public.workouts (title, notes, date, days, program_id, publish_at, created_by)
    values (${q(w.title)}, ${q(w.notes ?? '')}, '${w.date}', ${n(w.days ?? 1)}, '${prog.id}', ${publish}, ${q(prog.owner_id)}) returning id)`
  w.blocks.forEach((b, bi) => {
    const params = { ...b.params }
    if (b.groups?.length) params.groups = b.groups.map((g, gi) => ({ ...g, items: b.items.flatMap((it, i) => (it.group === gi ? [i] : [])) }))
    s += `, b${bi} as (insert into public.workout_blocks (workout_id, position, kind, title, format, params, notes)
      select id, ${bi}, ${q(b.kind)}, ${q(b.title)}, ${q(b.format)}, ${q(JSON.stringify(params))}::jsonb, ${q(b.notes ?? '')} from w returning id)`
    b.items.forEach((it, ii) => {
      const levels = {}
      for (const [lv, o] of Object.entries(it.levels ?? {})) {
        const { exercise, ...rest } = o
        levels[lv] = { ...rest, ...(exercise ? { exercise_id: exId(exercise) } : {}) }
      }
      s += `, i${bi}_${ii} as (insert into public.block_items (block_id, position, exercise_id, reps, load_kg, load_kg_f, pct_1rm, distance_m, calories, duration_s, notes, levels)
        select id, ${ii}, '${exId(it.exercise)}', ${q(it.reps ?? '')}, ${n(it.load_kg)}, ${n(it.load_kg_f)}, ${n(it.pct_1rm)}, ${n(it.distance_m)}, ${n(it.calories)}, ${n(it.duration_s)}, ${q(it.notes ?? '')}, ${q(JSON.stringify(levels))}::jsonb from b${bi} returning id)`
    })
  })
  s += ` select id from w`
  stmts.push([w, s])
}
console.log(`Cible ${target}, programme ${programName} : ${stmts.length} séance(s) à créer${dry ? ' (simulation)' : ''}`)
if (!dry) for (const [w, s] of stmts) { const [r] = await sql(s); console.log(`Créée : ${w.date} ${w.title} ${r.id}`) }
