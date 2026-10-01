// Imports library data (exercises, sections, templates) from a JSON file. Idempotent: matches by name/title
// (case and surrounding spaces ignored); existing templates are skipped unless --update.
// Usage: [TARGET=prod] node scripts/import-library.mjs <file.json> [--dry-run] [--update]
// File format (exercises are referenced by name, in the DB or in the same file; all keys optional except names/titles):
// { "exercises": [{ "name", "measure": "reps|load|distance|time|calories", "section", "description", "video_url" }],
//   "sections": ["Benchmark CrossFit"],  // library (template) sections; exercise sections come from exercises[].section
//   "templates": [{ "title", "section", "notes", "blocks": [{
//     "kind": "warmup|strength|skill|metcon|accessory|cooldown", "format": "for_time|amrap|emom|tabata|sets_reps|none",
//     "title", "notes", "params": { "time_cap_s", "duration_s", "interval_s", "rounds", "work_s", "rest_s", "sets",
//                                   "scaling": "Pull-up → ring row", "score": "time|rounds_reps|load|reps|none", "score_note" },
//     "groups": [{ "title": "3 rounds", "note", "start": 3, "step": 0 }],  // sub-blocks; items join one with "group": index
//     "items": [{ "exercise" | "label", "reps": "21-15-9", "load_kg", "load_kg_f", "pct_1rm", "distance_m", "calories", "duration_s",
//                 "notes", "group" }] }] }] }
import { readFileSync } from 'node:fs'
import { sql, target } from './lib.mjs'

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--'))
if (!file) throw new Error('Usage : node scripts/import-library.mjs <fichier.json> [--dry-run] [--update]')
const dryRun = args.includes('--dry-run')
const update = args.includes('--update')
const data = JSON.parse(readFileSync(file, 'utf8'))

const KINDS = ['warmup', 'strength', 'skill', 'metcon', 'accessory', 'cooldown']
const FORMATS = ['for_time', 'amrap', 'emom', 'tabata', 'sets_reps', 'none']
const MEASURES = ['reps', 'load', 'distance', 'time', 'calories']
const PARAMS = ['time_cap_s', 'duration_s', 'interval_s', 'rounds', 'work_s', 'rest_s', 'sets']
const NUMBERS = ['load_kg', 'load_kg_f', 'pct_1rm', 'distance_m', 'calories', 'duration_s']
const ITEM_KEYS = ['exercise', 'label', 'reps', 'notes', 'group', ...NUMBERS]
const SCORES = ['time', 'rounds_reps', 'load', 'reps', 'none']

const q = (s) => `'${String(s).replaceAll("'", "''")}'`
const key = (s) => String(s ?? '').trim().toLowerCase()
const errors = []
const check = (ok, msg) => ok || errors.push(msg)

// Current state ------------------------------------------------------------------------
const dbExercises = await sql(`select e.id, e.name, e.measure, e.description, e.video_url, s.name as section
  from public.exercises e left join public.exercise_sections s on s.id = e.section_id`)
const dbExerciseSections = await sql('select name from public.exercise_sections')
const dbSections = await sql('select id, name from public.library_sections')
const dbTemplates = await sql('select id, title from public.workouts where date is null')
const [owner] = await sql('select id from public.profiles where is_app_owner')
const exId = new Map(dbExercises.map((e) => [key(e.name), e.id]))
const sectionId = new Map(dbSections.map((s) => [key(s.name), s.id]))
const templateId = new Map(dbTemplates.map((t) => [key(t.title), t.id]))

// Validation (nothing is written if anything is wrong) ------------------------------------------
const exercises = data.exercises ?? []
const fileExercises = new Set()
for (const e of exercises) {
  check(e.name?.trim() && e.name.trim().length <= 80, `Exercice sans nom ou nom > 80 caractères : ${JSON.stringify(e)}`)
  check(!e.measure || MEASURES.includes(e.measure), `Exercice ${e.name} : measure invalide (${e.measure})`)
  check(!e.video_url || /^https?:\/\//.test(e.video_url), `Exercice ${e.name} : video_url doit commencer par http(s)://`)
  check(!e.section || e.section.trim().length <= 60, `Exercice ${e.name} : section > 60 caractères`)
  check(!fileExercises.has(key(e.name)), `Exercice en double dans le fichier : ${e.name}`)
  fileExercises.add(key(e.name))
}
const knownExercise = (name) => exId.has(key(name)) || fileExercises.has(key(name))

const templates = data.templates ?? []
const sections = new Set((data.sections ?? []).map((s) => s.trim()))
for (const t of templates) if (t.section) sections.add(t.section.trim())
for (const s of sections) check(s.length >= 1 && s.length <= 60, `Section invalide : "${s}" (1 à 60 caractères)`)

const fileTemplates = new Set()
for (const t of templates) {
  const where = `Séance "${t.title}"`
  check(t.title?.trim() && t.title.trim().length <= 120, `Séance sans titre ou titre > 120 caractères`)
  check(!fileTemplates.has(key(t.title)), `Séance en double dans le fichier : ${t.title}`)
  fileTemplates.add(key(t.title))
  check(Array.isArray(t.blocks) && t.blocks.length > 0, `${where} : aucun bloc`)
  for (const [i, b] of (t.blocks ?? []).entries()) {
    const bw = `${where}, bloc ${i + 1}`
    check(KINDS.includes(b.kind), `${bw} : kind invalide (${b.kind})`)
    check(FORMATS.includes(b.format), `${bw} : format invalide (${b.format})`)
    for (const [k, v] of Object.entries(b.params ?? {}))
      check(
        k === 'scaling' || k === 'score_note' ? typeof v === 'string'
          : k === 'score' ? SCORES.includes(v)
            : PARAMS.includes(k) && Number.isInteger(v) && v >= 0,
        `${bw} : paramètre invalide ${k}=${v}`,
      )
    for (const [j, it] of (b.items ?? []).entries()) {
      const iw = `${bw}, ligne ${j + 1}`
      for (const k of Object.keys(it)) check(ITEM_KEYS.includes(k), `${iw} : champ inconnu ${k}`)
      check(it.exercise || it.label?.trim(), `${iw} : exercise ou label requis`)
      check(!it.exercise || knownExercise(it.exercise), `${iw} : exercice inconnu "${it.exercise}" (à ajouter dans exercises)`)
      for (const k of NUMBERS) check(it[k] == null || (typeof it[k] === 'number' && it[k] >= 0), `${iw} : ${k} doit être un nombre ≥ 0`)
      check(it.group == null || (Number.isInteger(it.group) && it.group >= 0 && it.group < (b.groups ?? []).length),
        `${iw} : group doit désigner un sous-bloc du bloc`)
    }
    for (const [g, gr] of (b.groups ?? []).entries())
      check(typeof gr.title === 'string' && ['start', 'step'].every((k) => gr[k] == null || (Number.isInteger(gr[k]) && gr[k] >= 0)),
        `${bw}, sous-bloc ${g + 1} : title requis, start/step entiers ≥ 0`)
  }
}
if (errors.length) {
  console.error(`${errors.length} erreur(s), rien n'a été importé :\n- ${errors.join('\n- ')}`)
  process.exit(1)
}

// Plan ---------------------------------------------------------------------------------------
const newExercises = exercises.filter((e) => !exId.has(key(e.name)))
const changedExercises = exercises.filter((e) => {
  const cur = dbExercises.find((d) => key(d.name) === key(e.name))
  return cur && ['measure', 'description', 'video_url'].some((f) => e[f] != null && e[f] !== cur[f]) ||
    (cur && e.section && key(e.section) !== key(cur.section))
})
const knownExerciseSections = new Set(dbExerciseSections.map((s) => key(s.name)))
const newExerciseSections = [...new Map(exercises.filter((e) => e.section?.trim() && !knownExerciseSections.has(key(e.section)))
  .map((e) => [key(e.section), e.section.trim()])).values()]
const newSections = [...sections].filter((s) => !sectionId.has(key(s)))
const newTemplates = templates.filter((t) => !templateId.has(key(t.title)))
const existingTemplates = templates.filter((t) => templateId.has(key(t.title)))
const list = (items, f) => (items.length ? ` : ${items.map(f).join(', ')}` : '')
console.log(`Cible : ${target}${dryRun ? ' (simulation)' : ''}`)
console.log(`Exercices à créer ${newExercises.length}${list(newExercises, (e) => e.name)}`)
console.log(`Exercices à mettre à jour ${changedExercises.length}${list(changedExercises, (e) => e.name)}`)
console.log(`Sections d'exercices à créer ${newExerciseSections.length}${list(newExerciseSections, (s) => s)}`)
console.log(`Sections de séances à créer ${newSections.length}${list(newSections, (s) => s)}`)
console.log(`Séances à créer ${newTemplates.length}${list(newTemplates, (t) => t.title)}`)
console.log(`Séances existantes ${update ? 'à remplacer' : 'ignorées'} ${existingTemplates.length}${list(existingTemplates, (t) => t.title)}`)
if (dryRun) process.exit(0)

// Exercises and sections (one statement = one transaction) --------------------------------------
const ownerSql = owner ? q(owner.id) : 'null'
const stmts = newExerciseSections.map(
  (s) => `insert into public.exercise_sections (name) values (${q(s)}) on conflict ((lower(trim(name)))) do nothing;`,
)
for (const e of exercises) {
  const section = e.section?.trim()
    ? `(select id from public.exercise_sections where lower(trim(name)) = ${q(key(e.section))})`
    : 'null'
  stmts.push(`insert into public.exercises (name, measure, section_id, description, video_url, created_by)
    values (${q(e.name.trim())}, ${q(e.measure ?? 'reps')}, ${section}, ${e.description ? q(e.description) : 'null'},
            ${e.video_url ? q(e.video_url) : 'null'}, ${ownerSql})
    on conflict ((lower(trim(name)))) do update set
      section_id = ${e.section?.trim() ? 'excluded.section_id' : 'exercises.section_id'},
      measure = ${e.measure ? 'excluded.measure' : 'exercises.measure'},
      description = ${e.description ? 'excluded.description' : 'exercises.description'},
      video_url = ${e.video_url ? 'excluded.video_url' : 'exercises.video_url'};`)
}
for (const s of newSections) {
  stmts.push(`insert into public.library_sections (name) values (${q(s)}) on conflict ((lower(trim(name)))) do nothing;`)
}
if (stmts.length) await sql(stmts.join('\n'))

// Templates --------------------------------------------------------------------------------
for (const e of await sql('select id, name from public.exercises')) exId.set(key(e.name), e.id)
for (const s of await sql('select id, name from public.library_sections')) sectionId.set(key(s.name), s.id)
const ex = (name) => exId.get(key(name))
const toWorkout = (t, id) => ({
  ...(id && { id }),
  title: t.title.trim(),
  notes: t.notes ?? '',
  blocks: t.blocks.map((b) => ({
    kind: b.kind,
    format: b.format,
    title: b.title ?? '',
    notes: b.notes ?? '',
    // Sub-blocks are stored in params, with the positions of their items (see src/features/workouts/api.ts).
    params: b.groups?.length
      ? { ...b.params, groups: b.groups.map(({ title, note = '', start, step }, g) => ({
          title, note, start, step, items: (b.items ?? []).flatMap((it, i) => (it.group === g ? [i] : [])) })) }
      : b.params ?? {},
    items: (b.items ?? []).map(({ exercise, group: _g, ...it }) => ({ ...it, exercise_id: exercise ? ex(exercise) : null })),
  })),
})
const toWrite = update ? templates : newTemplates
for (const t of toWrite) {
  const section = t.section ? q(sectionId.get(key(t.section))) : 'section_id'
  const payload = JSON.stringify(toWorkout(t, templateId.get(key(t.title))))
  await sql(`do $imp$ declare v uuid; begin
    v := public.save_workout(${q(payload)}::jsonb);
    update public.workouts set section_id = ${section}, created_by = coalesce(created_by, ${ownerSql}) where id = v;
  end $imp$;`)
}
console.log(`Import terminé : ${newExercises.length} exercices créés, ${newExerciseSections.length + newSections.length} sections créées, ${toWrite.length} séances écrites.`)
