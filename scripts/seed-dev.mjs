// Dev/test dataset: users c1, c2 (coaches), a1, a2, a3 (athletes) with password "a",
// programs, library templates and scheduled workouts around the current week.
// Re-runnable: removes the previous seed first. Usage: node scripts/seed-dev.mjs [--clean]
// The "a" password bypasses the password policy (hash written directly), dev only.
import { createClient } from '@supabase/supabase-js'
import { api, serviceKey, sql } from './lib.mjs'

const DOMAIN = 'tkf.test'
const PASSWORD = 'a'
const OWNER = 'guillaume.kheng@gmail.com' // real coach, added to the CrossFit program
const USERS = [
  { name: 'c1', role: 'coach', share: true },
  { name: 'c2', role: 'coach', share: false },
  { name: 'a1', role: 'athlete', share: true },
  { name: 'a2', role: 'athlete', share: true },
  { name: 'a3', role: 'athlete', share: false },
]
const PROGRAMS = {
  CrossFit: ['c1', 'c2', 'a1', 'a2', 'a3', OWNER],
  Haltéro: ['c1', 'a1'],
  Hyrox: ['a2'],
}

const url = process.env.SUPABASE_URL
const admin = createClient(url, await serviceKey(), { auth: { persistSession: false } })
const publishable = (await api('/api-keys?reveal=true')).find((k) => k.type === 'publishable').api_key
const q = (s) => `'${String(s).replaceAll("'", "''")}'`
const emailOf = (name) => (name.includes('@') ? name : `${name}@${DOMAIN}`)

// Clean previous seed -------------------------------------------------------------
const seedUsers = await sql(`select id from auth.users where email like '%@${DOMAIN}'`)
const ids = seedUsers.map((u) => q(u.id)).join(',')
if (ids) await sql(`delete from public.workouts where created_by in (${ids})`)
await sql(`delete from public.programs where name in (${Object.keys(PROGRAMS).map(q).join(',')})`)
for (const u of seedUsers) await admin.auth.admin.deleteUser(u.id)
console.log(`Seed précédent supprimé (${seedUsers.length} utilisateurs).`)
if (process.argv.includes('--clean')) process.exit(0)

// Users -------------------------------------------------------------------------------
const userId = {}
for (const u of USERS) {
  const { data, error } = await admin.auth.admin.createUser({
    email: emailOf(u.name),
    password: `Tmp-${crypto.randomUUID()}!`,
    email_confirm: true,
    user_metadata: { password_set: true },
  })
  if (error) throw error
  userId[u.name] = data.user.id
  await sql(`
    update auth.users set encrypted_password = extensions.crypt(${q(PASSWORD)}, extensions.gen_salt('bf'))
      where id = ${q(data.user.id)};
    update public.profiles set role = ${q(u.role)}, display_name = ${q(u.name)}, share_scores = ${u.share},
      enrolled_at = now() where id = ${q(data.user.id)};`)
}
const [owner] = await sql(`select id from auth.users where email = ${q(OWNER)}`)
if (owner) userId[OWNER] = owner.id
console.log('Utilisateurs :', USERS.map((u) => emailOf(u.name)).join(', '))

// Act as c1 through the real API (RLS + RPCs) ---------------------------------------------
const c1 = createClient(url, publishable, { auth: { persistSession: false } })
const login = await c1.auth.signInWithPassword({ email: emailOf('c1'), password: PASSWORD })
if (login.error) throw login.error
const must = (r) => {
  if (r.error) throw new Error(r.error.message)
  return r.data
}

const programId = {}
for (const [name, members] of Object.entries(PROGRAMS)) {
  programId[name] = must(await c1.from('programs').insert({ name }).select().single()).id
  const rows = members.filter((m) => userId[m]).map((m) => ({ program_id: programId[name], user_id: userId[m] }))
  must(await c1.from('program_members').insert(rows))
}

const ex = Object.fromEntries(must(await c1.from('exercises').select('id, name')).map((e) => [e.name, e.id]))
const item = (name, fields = {}, levels = {}) => {
  if (!ex[name]) throw new Error(`Exercice inconnu : ${name}`)
  return { exercise_id: ex[name], label: '', reps: '', levels, ...fields }
}
const block = (kind, format, params, items, extra = {}) => ({
  id: crypto.randomUUID(), kind, format, params, items, title: '', notes: '', ...extra,
})
const warmup = block('warmup', 'none', {}, [item('Row', { calories: 15 }), item('Air Squat', { reps: '20' }), item('Push-up', { reps: '10' })], { notes: '2 rounds, rythme tranquille' })

const TEMPLATES = {
  'Chipper DU': [
    warmup,
    block('metcon', 'for_time', { rounds: 3, time_cap_s: 25 * 60 }, [
      item('Double-Under', { reps: '100' }, { scaled: { exercise_id: ex['Single-Under'], reps: '200' }, foundation: { exercise_id: ex['Single-Under'], reps: '100' } }),
      item('Pull-up', { reps: '21' }, { foundation: { exercise_id: ex['Ring Row'] } }),
      item('Run', { distance_m: 400 }),
      item('Chest-to-Bar Pull-up', { reps: '15' }, { scaled: { exercise_id: ex['Pull-up'] }, foundation: { exercise_id: ex['Ring Row'] } }),
      item('Echo Bike', { calories: 20 }, { foundation: { calories: 15 } }),
      item('Bar Muscle-up', { reps: '9' }, { elite: { exercise_id: ex['Ring Muscle-up'] }, scaled: { exercise_id: ex['Chest-to-Bar Pull-up'] }, foundation: { exercise_id: ex['Jumping Pull-up'] } }),
    ]),
  ],
  Fran: [
    warmup,
    block('metcon', 'for_time', { time_cap_s: 10 * 60 }, [
      item('Thruster', { reps: '21-15-9', load_kg: 43 }, { elite: { load_kg: 50 }, scaled: { load_kg: 30 }, foundation: { load_kg: 20, reps: '15-12-9' } }),
      item('Pull-up', { reps: '21-15-9' }, { foundation: { exercise_id: ex['Ring Row'] } }),
    ], { title: 'Fran' }),
  ],
  'Squat lourd + Cindy': [
    warmup,
    block('strength', 'sets_reps', { sets: 5 }, [item('Back Squat', { reps: '5', pct_1rm: 80 })], { notes: 'Repos 2 min entre les séries' }),
    block('metcon', 'amrap', { duration_s: 20 * 60 }, [
      item('Pull-up', { reps: '5' }, { foundation: { exercise_id: ex['Ring Row'] } }),
      item('Push-up', { reps: '10' }),
      item('Air Squat', { reps: '15' }),
    ], { title: 'Cindy' }),
  ],
  'EMOM gym': [
    warmup,
    block('skill', 'emom', { interval_s: 60, rounds: 12 }, [
      item('Toes-to-Bar', { reps: '10' }, { scaled: { exercise_id: ex['Knees-to-Elbows'] } }),
      item('Wall Ball', { reps: '15', load_kg: 9 }, { scaled: { load_kg: 6 } }),
      item('Burpee', { reps: '10' }),
    ], { notes: 'Alterner les 3 mouvements chaque minute' }),
    block('accessory', 'tabata', { rounds: 8, work_s: 20, rest_s: 10 }, [item('Hollow Hold', { duration_s: 20 })]),
  ],
  'Haltéro : clean & jerk': [
    block('warmup', 'none', {}, [item('Front Squat', { reps: '5', load_kg: 40 }), item('Push Press', { reps: '5', load_kg: 30 })]),
    block('strength', 'emom', { interval_s: 90, rounds: 10 }, [item('Clean & Jerk', { reps: '1', pct_1rm: 75 })], { notes: '1 rep toutes les 1\'30' }),
    block('accessory', 'sets_reps', { sets: 4 }, [item('Front Rack Lunge', { reps: '8', load_kg: 40 })]),
  ],
  'Hyrox simulation': [
    block('metcon', 'for_time', { time_cap_s: 45 * 60 }, [
      item('Run', { distance_m: 1000 }),
      item('Ski Erg', { calories: 50 }),
      item('Run', { distance_m: 1000 }),
      item('Sled Push', { distance_m: 50 }),
      item('Run', { distance_m: 1000 }),
      item('Walking Lunge', { distance_m: 100 }),
      item('Wall Ball', { reps: '100', load_kg: 6 }),
    ]),
  ],
}

const templateId = {}
for (const [title, blocks] of Object.entries(TEMPLATES)) {
  templateId[title] = must(await c1.rpc('save_workout', { p: { title, notes: '', blocks } }))
}

// Schedule: 2 past weeks, current week, next week --------------------------------------
const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const now = new Date()
const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7), 12)
const dayOf = (week, dow) => iso(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + week * 7 + dow, 12))
const at7 = (date) => new Date(`${date}T07:00:00`).toISOString()

// [template, day of week (0 = Monday), targets]
const WEEK_PLAN = [
  ['Chipper DU', 0, ['CrossFit']],
  ['Haltéro : clean & jerk', 1, ['Haltéro']],
  ['Fran', 2, ['CrossFit']],
  ['Hyrox simulation', 3, ['Hyrox']],
  ['Squat lourd + Cindy', 4, ['CrossFit']],
  ['EMOM gym', 5, ['all']],
]

let count = 0
for (const week of [-2, -1, 0, 1]) {
  for (const [title, dow, targets] of WEEK_PLAN) {
    const date = dayOf(week, dow)
    const id = must(await c1.rpc('schedule_workout', { p_template: templateId[title], p_date: date }))
    if (!targets.includes('all')) {
      must(await c1.from('workout_assignments').delete().eq('workout_id', id))
      must(await c1.from('workout_assignments').insert(targets.map((t) => ({ workout_id: id, program_id: programId[t] }))))
    }
    // Past and current weeks: published on Monday 7:00. Next week: scheduled (Mon-Wed) or draft.
    const publish = week <= 0 ? at7(dayOf(week, 0)) : dow <= 2 ? at7(dayOf(1, 0)) : null
    must(await c1.from('workouts').update({ publish_at: publish }).eq('id', id))
    count++
  }
}
// Today's workout for the CrossFit program, whatever the day of week.
const todays = must(await c1.rpc('schedule_workout', { p_template: templateId['Chipper DU'], p_date: iso(now) }))
must(await c1.from('workout_assignments').delete().eq('workout_id', todays))
must(await c1.from('workout_assignments').insert({ workout_id: todays, program_id: programId.CrossFit }))
must(await c1.from('workouts').update({ publish_at: new Date().toISOString() }).eq('id', todays))
count++

// One workout only for a3 today, to test athlete targeting.
const special = must(await c1.rpc('schedule_workout', { p_template: templateId.Fran, p_date: iso(now) }))
must(await c1.from('workout_assignments').delete().eq('workout_id', special))
must(await c1.from('workout_assignments').insert({ workout_id: special, athlete_id: userId.a3 }))
must(await c1.from('workouts').update({ title: 'Fran (perso a3)', publish_at: new Date().toISOString() }).eq('id', special))

console.log(`Programmes : ${Object.keys(PROGRAMS).join(', ')} · ${Object.keys(TEMPLATES).length} modèles · ${count + 1} séances programmées`)

// Results: each athlete logs scores through the API (RLS applies), on published workouts up to today.
// Deterministic pseudo-random so reruns give the same data.
let seed = 42
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
const between = (min, max) => Math.round(min + rand() * (max - min))
const PROFILES = {
  a1: { levels: ['rx'], skill: 0.8, skip: 0.1 },
  a2: { levels: ['rx', 'scaled'], skill: 0.6, skip: 0.2 },
  a3: { levels: ['scaled', 'foundation'], skill: 0.4, skip: 0.2 },
  c1: { levels: ['elite', 'rx'], skill: 0.9, skip: 0.3 },
}
const COMMENTS = ['Grosse séance 🔥', 'Les DU ont piqué', 'Bras cramés', 'Rythme régulier', null, null, null]

function scoreFor(format, params, skill) {
  switch (format) {
    case 'for_time': {
      const cap = params.time_cap_s ?? 1200
      const t = Math.round(cap * (0.95 - skill * 0.5 + rand() * 0.25))
      return t >= cap ? { capped: true, reps: between(80, 200) } : { time_s: t }
    }
    case 'amrap':
      return { rounds: Math.round(8 + skill * 12 + rand() * 4), reps: between(0, 14) }
    case 'sets_reps':
      return { load_kg: Math.round((60 + skill * 80 + rand() * 20) / 2.5) * 2.5 }
    case 'tabata':
      return { reps: between(60, 160) }
    default:
      return {}
  }
}

let resultCount = 0
for (const [name, p] of Object.entries(PROFILES)) {
  const client = createClient(url, publishable, { auth: { persistSession: false } })
  const auth = await client.auth.signInWithPassword({ email: emailOf(name), password: PASSWORD })
  if (auth.error) throw auth.error
  const mine = must(await client.rpc('my_workouts', { p_from: dayOf(-2, 0), p_to: iso(now) }))
  for (const w of mine) {
    if (rand() < p.skip) continue
    const blocks = must(await client.from('workout_blocks').select('id, kind, format, params').eq('workout_id', w.id))
    for (const b of blocks) {
      if (b.kind === 'warmup') continue
      const level = p.levels[between(0, p.levels.length - 1)]
      const comment = COMMENTS[between(0, COMMENTS.length - 1)]
      must(await client.from('results').insert({
        workout_id: w.id, block_id: b.id, level, comment, ...scoreFor(b.format, b.params, p.skill),
      }))
      resultCount++
    }
  }
}
console.log(`Résultats : ${resultCount} (a3 et c2 ne partagent pas leurs scores)`)

// Personal records (a3 has no Back Squat 1RM, to show the "1RM ?" link).
const RECORDS = {
  a1: { 'Back Squat': [[1, 120], [5, 100]], Deadlift: [[1, 160]], 'Clean & Jerk': [[1, 90]], Fran: '4:05' },
  a2: { 'Back Squat': [[1, 95], [3, 88]], 'Clean & Jerk': [[1, 65]], Fran: '5:40' },
  a3: { Deadlift: [[1, 100]] },
  c1: { 'Back Squat': [[1, 140]], 'Clean & Jerk': [[1, 105]], Fran: '3:20' },
}
let recordCount = 0
for (const [name, recs] of Object.entries(RECORDS)) {
  const client = createClient(url, publishable, { auth: { persistSession: false } })
  await client.auth.signInWithPassword({ email: emailOf(name), password: PASSWORD })
  for (const [key, value] of Object.entries(recs)) {
    const rows =
      typeof value === 'string'
        ? [{ benchmark_name: key, score_type: 'time', time_s: Number(value.split(':')[0]) * 60 + Number(value.split(':')[1]) }]
        : value.map(([rep_max, load_kg]) => ({ exercise_id: ex[key], rep_max, load_kg }))
    must(await client.from('personal_records').insert(rows.map((r) => ({ ...r, date: dayOf(-3, 2) }))))
    recordCount += rows.length
  }
}
console.log(`Records : ${recordCount}`)
