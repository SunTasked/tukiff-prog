// Staging dataset covering the use cases of docs/staging-use-cases.md (IDs UC-xx referenced below).
// Users *@tkf.test (password "a"): 2 coaches, 10 athletes (men and women, RX and scaled), 1 account in onboarding.
// Programs, library templates, workouts from 2 weeks ago to next week (dates relative to today), scores,
// "Fait", "Je passe", reactions, comments, records, avatars and 7 days of usage stats.
// Current week of "CrossFit" (stand-in for prod "Kanda WOD") copies the prod week of 28/09/2026 (content only).
// Re-runnable: removes the previous seed first. Usage: node scripts/seed-dev.mjs [--clean]
// The "a" password bypasses the password policy (hash written directly), staging only (refuses TARGET=prod).
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { api, serviceKey, sql, target, url } from './lib.mjs'

const DOMAIN = 'tkf.test'
const PASSWORD = 'a'
const OWNER = 'guillaume.kheng@gmail.com' // real coach, added to the CrossFit program when the account exists
// skill: 0-1 (drives scores), skip: share of workouts not done, rx: share of their scores done RX.
const USERS = [
  { name: 'c1', first: 'Maxime', last: 'Durand', display: 'Max', role: 'coach', admin: true, gender: 'male', avatar: true, rx: 1, skill: 0.85, skip: 0.3 },
  { name: 'c2', first: 'Julie', last: 'Bernard', display: null, role: 'coach', gender: 'female', avatar: true, rx: 1, skill: 0.7, skip: 0.4 },
  { name: 'a1', first: 'Léa', last: 'Martin', display: null, role: 'athlete', gender: 'female', avatar: true, rx: 1, skill: 0.9, skip: 0 },
  { name: 'a2', first: 'Thomas', last: 'Petit', display: 'Tom', role: 'athlete', gender: 'male', rx: 1, skill: 0.65, skip: 0.1 },
  { name: 'a3', first: 'Sarah', last: 'Robert', display: null, role: 'athlete', gender: 'female', rx: 0, skill: 0.5, skip: 0.2 },
  { name: 'a4', first: 'Hugo', last: 'Richard', display: 'Hugo le Viking', role: 'athlete', gender: 'male', avatar: true, rx: 1, skill: 0.95, skip: 0 },
  { name: 'a5', first: 'Inès', last: 'Moreau', display: null, role: 'athlete', gender: 'female', rx: 0, skill: 0.3, skip: 0.2 },
  { name: 'a6', first: 'Nicolas', last: 'Simon', display: 'Nico', role: 'athlete', gender: 'male', rx: 0.5, skill: 0.45, skip: 0.2 },
  { name: 'a7', first: 'Emma', last: 'Laurent', display: null, role: 'athlete', gender: 'female', rx: 1, skill: 0.6, skip: 0.15 },
  { name: 'a8', display: 'Paul', role: 'athlete', gender: 'male', rx: 1, skill: 0.5, skip: 1 }, // never scores (UC-report), no first/last name: nickname fallback (UC-36)
  { name: 'a9', first: 'Chloé', last: 'Michel', display: null, role: 'athlete', gender: 'female', rx: 0, skill: 0.4, skip: 0.25 },
  { name: 'a10', first: 'Karim', last: 'Lefèvre', display: null, role: 'athlete', gender: 'male', rx: 1, skill: 0.75, skip: 0.1 },
  // Onboarding: nickname set but names and gender missing -> the app asks for them (UC-02).
  { name: 'n1', display: 'n1', role: 'athlete', gender: null, rx: 1, skip: 1 },
  // Sign-up in progress: link used, nothing filled in (UC-38), shown under "Inscriptions en cours".
  { name: 'p1', display: null, role: 'athlete', gender: null, rx: 1, skip: 1, pending: true },
]
const ALL = USERS.map((u) => u.name)
// name: { owner, contributors, members, reactions, leaderboard }
const PROGRAMS = {
  CrossFit: { owner: 'c1', contributors: ['c2'], members: [...ALL, OWNER] },
  Haltéro: { owner: 'c1', contributors: [], members: ['c1', 'a1', 'a2', 'a4', 'a10'], leaderboard: false, reactions: false },
  Hyrox: { owner: 'c2', contributors: [], members: ['c2', 'a2', 'a3', 'a6', 'a7'], reactions: false },
  'Open Gym': { owner: 'c1', contributors: [], members: ['c1', 'c2', 'a1', 'a3', 'a5', 'a9', OWNER] },
  'Perso a3': { owner: 'c1', contributors: [], members: ['a3'] },
}

// Library sections: section -> templates
const SECTIONS = {
  'Benchmark CrossFit': ['Fran', 'Squat lourd + Cindy'],
  WOD: ['Chipper DU', 'EMOM gym', 'DB DT ladder'],
  Hyrox: ['Hyrox simulation'],
  Haltéro: ['Haltéro : clean & jerk'],
}

// On prod only --clean is allowed (removes *@tkf.test accounts and their data).
if (target === 'prod' && !process.argv.includes('--clean')) throw new Error('seed-dev ne crée jamais de données de test sur la prod')
const admin = createClient(url, await serviceKey(), { auth: { persistSession: false } })
const publishable = (await api('/api-keys?reveal=true')).find((k) => k.type === 'publishable').api_key
const q = (s) => `'${String(s).replaceAll("'", "''")}'`
const emailOf = (name) => (name.includes('@') ? name : `${name}@${DOMAIN}`)

// Clean previous seed -------------------------------------------------------------
const seedUsers = await sql(`select id from auth.users where email like '%@${DOMAIN}'`)
const ids = seedUsers.map((u) => q(u.id)).join(',')
// Only seed data: programs owned by test users, workouts they created, and seed sections left empty.
// Never delete by name alone, real data can share these names.
if (ids) {
  await sql(`delete from public.workouts where created_by in (${ids})`)
  await sql(`delete from public.programs where owner_id in (${ids})`)
  await sql(`delete from storage.objects where bucket_id = 'avatars' and (storage.foldername(name))[1] in (${ids})`).catch(() => {})
}
await sql(
  `delete from public.library_sections s where name in (${Object.keys(SECTIONS).map(q).join(',')})
   and not exists (select 1 from public.workouts w where w.section_id = s.id)`,
)
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
    update public.profiles set role = ${q(u.role)}, display_name = ${u.display ? q(u.display) : 'null'},
      first_name = ${u.first ? q(u.first) : 'null'}, last_name = ${u.last ? q(u.last) : 'null'}, gender = ${u.gender ? q(u.gender) : 'null'},
      is_admin = ${!!u.admin}, enrolled_at = now() where id = ${q(data.user.id)};`)
}
const [owner] = await sql(`select id from auth.users where email = ${q(OWNER)}`)
if (owner) userId[OWNER] = owner.id
console.log('Utilisateurs :', USERS.map((u) => `${emailOf(u.name)} (${u.display ?? u.first ?? '-'})`).join(', '))

// Act through the real API (RLS + RPCs) ------------------------------------------------------
const clients = {}
async function clientFor(name) {
  if (clients[name]) return clients[name]
  const client = createClient(url, publishable, { auth: { persistSession: false } })
  const { error } = await client.auth.signInWithPassword({ email: emailOf(name), password: PASSWORD })
  if (error) throw error
  return (clients[name] = client)
}
const must = (r) => {
  if (r.error) throw new Error(r.error.message)
  return r.data
}

// Avatars (UC-03): uploaded by each user like the app does, versioned URL.
for (const u of USERS.filter((x) => x.avatar)) {
  const client = await clientFor(u.name)
  const path = `${userId[u.name]}/avatar.jpg`
  const file = readFileSync(new URL(`./seed-avatars/${u.name}.jpg`, import.meta.url))
  must(await client.storage.from('avatars').upload(path, file, { upsert: true, contentType: 'image/jpeg' }))
  const avatar_url = `${client.storage.from('avatars').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`
  must(await client.from('profiles').update({ avatar_url }).eq('id', userId[u.name]))
}

const coach = { c1: await clientFor('c1'), c2: await clientFor('c2') }
const c1 = coach.c1

// Invitation links (UC-37): one named single-use link, one unnamed 24 h link.
const inDays = (d) => new Date(Date.now() + d * 86400e3).toISOString()
must(await c1.from('invitations').insert({ role: 'athlete', max_uses: 1, expires_at: inDays(7), label: 'Julien Garnier' }))
const used = must(await c1.from('invitations').insert({ role: 'athlete', max_uses: 1, expires_at: inDays(7), label: 'Marion Blanc' }).select().single())
await sql(`update public.invitations set uses = 1 where id = ${q(used.id)};
  update public.profiles set invitation_id = ${q(used.id)} where id = ${q(userId.p1)}`)
must(await c1.from('invitations').insert({ role: 'athlete', expires_at: inDays(1) }))

const programId = {}
const ownerOf = {}
for (const [name, p] of Object.entries(PROGRAMS)) {
  const client = coach[p.owner]
  const toggles = { reactions_enabled: p.reactions ?? true, leaderboard_enabled: p.leaderboard ?? true }
  programId[name] = must(await client.from('programs').insert({ name }).select().single()).id
  must(await client.from('programs').update(toggles).eq('id', programId[name]))
  ownerOf[name] = client
  for (const c of p.contributors) must(await client.from('program_coaches').insert({ program_id: programId[name], coach_id: userId[c] }))
  const rows = p.members.filter((m) => userId[m]).map((m) => ({ program_id: programId[name], user_id: userId[m] }))
  must(await client.from('program_members').insert(rows))
}

const ex = Object.fromEntries(must(await c1.from('exercises').select('id, name')).map((e) => [e.name, e.id]))
const item = (name, fields = {}) => {
  if (!ex[name]) throw new Error(`Exercice inconnu : ${name}`)
  return { exercise_id: ex[name], label: '', reps: '', ...fields }
}
// groups: [{ title, note, start, step, items: [item indices] }] stored in params like the app does.
const block = (kind, format, params, items, extra = {}) => ({
  id: crypto.randomUUID(), kind, format, params, items, title: '', notes: '', ...extra,
})
const warmup = () =>
  block('warmup', 'none', {}, [item('Row', { calories: 15 }), item('Air Squat', { reps: '20' }), item('Push-up', { reps: '10' })], { notes: '2 rounds, rythme tranquille' })
const newIds = (blocks) => blocks.map((b) => ({ ...b, id: crypto.randomUUID() }))

const TEMPLATES = {
  'Chipper DU': [
    warmup(),
    block('metcon', 'for_time', { rounds: 3, time_cap_s: 25 * 60, scaling: 'DU → 200 single-unders\nC2B → pull-ups, BMU → C2B' }, [
      item('Double-Under', { reps: '100' }),
      item('Pull-up', { reps: '21' }),
      item('Run', { distance_m: 400 }),
      item('Chest-to-Bar Pull-up', { reps: '15' }),
      item('Echo Bike', { calories: 20 }),
      item('Bar Muscle-up', { reps: '9' }),
    ], { title: 'Chipper' }),
  ],
  Fran: [
    warmup(),
    block('metcon', 'for_time', { time_cap_s: 10 * 60, scaling: 'Thruster 30/20 kg\nPull-up → ring row' }, [
      item('Thruster', { reps: '21-15-9', load_kg: 43, load_kg_f: 29 }),
      item('Pull-up', { reps: '21-15-9' }),
    ], { title: 'Fran' }),
  ],
  'Squat lourd + Cindy': [
    warmup(),
    block('strength', 'sets_reps', { sets: 5 }, [item('Back Squat', { reps: '5', pct_1rm: 80 })], { title: 'Back Squat', notes: 'Repos 2 min entre les séries' }),
    block('metcon', 'amrap', { duration_s: 20 * 60 }, [
      item('Pull-up', { reps: '5' }),
      item('Push-up', { reps: '10' }),
      item('Air Squat', { reps: '15' }),
    ], { title: 'Cindy' }),
  ],
  'EMOM gym': [
    warmup(),
    block('skill', 'emom', { interval_s: 60, rounds: 12 }, [
      item('Toes-to-Bar', { reps: '10' }),
      item('Wall Ball', { reps: '15', load_kg: 9, load_kg_f: 6 }),
      item('Burpee', { reps: '10' }),
    ], { title: 'EMOM 12', notes: 'Alterner les 3 mouvements chaque minute' }),
    block('accessory', 'tabata', { rounds: 8, work_s: 20, rest_s: 10 }, [item('Hollow Hold', { duration_s: 20 })], { title: 'Tabata gainage' }),
  ],
  'Haltéro : clean & jerk': [
    block('warmup', 'none', {}, [item('Front Squat', { reps: '5', load_kg: 40 }), item('Push Press', { reps: '5', load_kg: 30 })]),
    block('strength', 'emom', { interval_s: 90, rounds: 10, score: 'load' }, [item('Clean & Jerk', { reps: '1', pct_1rm: 75 })], { title: 'Clean & Jerk', notes: '1 rep toutes les 1\'30' }),
    block('accessory', 'sets_reps', { sets: 4, score: 'none' }, [item('Front Rack Lunge', { reps: '8', load_kg: 40, load_kg_f: 25 })], { title: 'Fentes' }),
  ],
  'Hyrox simulation': [
    block('metcon', 'for_time', { time_cap_s: 45 * 60 }, [
      item('Run', { distance_m: 1000 }),
      item('Ski Erg', { calories: 50 }),
      item('Run', { distance_m: 1000 }),
      item('Sled Push', { distance_m: 50 }),
      item('Run', { distance_m: 1000 }),
      item('Walking Lunge', { distance_m: 100 }),
      item('Wall Ball', { reps: '100', load_kg: 6, load_kg_f: 4 }),
    ], { title: 'Hyrox' }),
  ],
  // Sub-block ladder + AMRAP scored in total reps (UC-10, UC-11): same as prod Kanda WOD 29/09.
  'DB DT ladder': [
    block('metcon', 'amrap', {
      duration_s: 20 * 60, score: 'reps',
      groups: [{ title: 'DB DT', note: 'Tour 1 : 1 round, tour 2 : 2 rounds, tour 3 : 3 rounds… (+1 round à chaque tour)', start: 1, step: 1, items: [0, 1, 2] }],
    }, [
      item('Dumbbell Deadlift', { reps: '12', load_kg: 22.5, load_kg_f: 15, notes: 'par haltère' }),
      item('Dumbbell Hang Power Clean', { reps: '9', load_kg: 22.5, load_kg_f: 15, notes: 'par haltère' }),
      item('Dumbbell Push Jerk', { reps: '6', load_kg: 22.5, load_kg_f: 15, notes: 'par haltère' }),
      item('Burpee Box Jump Over', { reps: '15', notes: 'box 60/50 cm, après chaque tour' }),
    ], { title: 'DB DT ladder' }),
  ],
}

const templateId = {}
for (const [title, blocks] of Object.entries(TEMPLATES)) {
  templateId[title] = must(await c1.rpc('save_workout', { p: { title, notes: '', blocks } }))
}

for (const [name, titles] of Object.entries(SECTIONS)) {
  // Reuse a real section with the same name if it exists.
  const [existing] = await sql(`select id from public.library_sections where lower(trim(name)) = lower(trim(${q(name)}))`)
  const section = existing ?? must(await c1.from('library_sections').insert({ name }).select().single())
  must(await c1.from('workouts').update({ section_id: section.id }).in('id', titles.map((t) => templateId[t])))
}

// Dates ------------------------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const now = new Date()
const today = iso(now)
const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7), 12)
const dayOf = (week, dow) => iso(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + week * 7 + dow, 12))
const at7 = (date) => new Date(`${date}T07:00:00`).toISOString()
// Published at 7:00 on its day, like prod (a future day stays "scheduled": hatched for coaches, hidden for athletes).
const publishOn = (date) => at7(date)

async function schedule(template, date, program, publish, extra = {}) {
  const client = ownerOf[program]
  const id = must(await client.rpc('schedule_workout', { p_template: templateId[template], p_date: date, p_program: programId[program] }))
  must(await client.from('workouts').update({ publish_at: publish, ...extra }).eq('id', id))
  return id
}
async function create(program, date, title, blocks, publish, days = 1) {
  const client = ownerOf[program]
  const id = must(await client.rpc('save_workout', { p: { title, notes: '', date, days, program_id: programId[program], blocks: newIds(blocks) } }))
  must(await client.from('workouts').update({ publish_at: publish }).eq('id', id))
  return id
}

// Current week of CrossFit = prod "Kanda WOD" week of 28/09/2026 (Mon-Fri), session "WOD".
const KANDA_WEEK = [
  [
    block('metcon', 'emom', { rounds: 12, interval_s: 60, score: 'load' }, [item('Squat Snatch', { reps: '1', pct_1rm: 80 })], { title: 'Squat snatch' }),
    block('metcon', 'for_time', { time_cap_s: 720, scaling: 'OHS 30/20 kg\nPull-up → jumping pull-up ou ring row' }, [
      item('Overhead Squat', { reps: '21', load_kg: 43, load_kg_f: 29 }),
      item('Pull-up', { reps: '42' }),
      item('Overhead Squat', { reps: '15', load_kg: 43, load_kg_f: 29 }),
      item('Pull-up', { reps: '30' }),
      item('Overhead Squat', { reps: '9', load_kg: 43, load_kg_f: 29 }),
      item('Pull-up', { reps: '18' }),
    ], { title: 'Josh' }),
  ],
  [
    block('skill', 'emom', { rounds: 8, interval_s: 90, score: 'none' }, [
      item('Deadlift', { reps: '3' }),
      item('Hang Clean', { reps: '2', pct_1rm: 75 }),
      item('Push Jerk', { reps: '1' }),
    ], { title: 'Clean and jerk', notes: 'Complexe toutes les 1\'30 à 75% du RM de hang clean (même barre sur tout le complexe).' }),
    ...TEMPLATES['DB DT ladder'],
  ],
  [
    block('skill', 'sets_reps', { sets: 5, score: 'none' }, [
      item('Sled Pull', { distance_m: 10 }),
      item('Dumbbell Bench Press', { reps: '8-10' }),
      item('Double Kettlebell Overhead Lunge', { distance_m: 10, notes: '2 KB' }),
      item('Strict Toes-to-Bar', { reps: '4-6', notes: 'ou Strict Knee Raise' }),
    ], { title: 'Renfo fonctionnel' }),
    block('metcon', 'for_time', { score: 'time' }, [item('Ski Erg', { distance_m: 2000 })], { title: 'Test 2000 m Ski' }),
  ],
  [
    block('skill', 'emom', { rounds: 6, interval_s: 180, score: 'load' }, [item('Front Squat', { reps: '6', pct_1rm: 75 })], { title: 'Front Squat', notes: 'Bonus : skill pistol' }),
    // Team WOD by 2 (UC-40).
    block('metcon', 'for_time', { rounds: 3, time_cap_s: 900, score: 'time', team_size: 2 }, [
      item('Toes-to-Bar', { reps: '30' }),
      item('Power Clean', { reps: '12', load_kg: 80, load_kg_f: 50 }),
      item('Pistol', { reps: '30' }),
    ], { title: 'WOD' }),
  ],
  [
    block('skill', 'none', {
      score: 'none',
      groups: [
        { title: 'Renfo pull', note: 'Every 2\' × 4', items: [0] },
        { title: 'Complex', note: 'Every 2\' × 4', items: [1, 2] },
        { title: 'Technique HSPU', note: '', items: [3] },
      ],
    }, [
      item('Strict Chest-to-Bar Pull-up', { reps: 'X' }),
      item('Upright Row', { reps: '6', notes: 'tirage menton' }),
      item('Hang Muscle Clean', { reps: '6' }),
      item('Handstand Push-up', { notes: 'technique' }),
    ], { title: 'Renfo pull · Technique HSPU' }),
    block('metcon', 'sets_reps', { sets: 5, score: 'reps' }, [
      item('Parallette Handstand Push-up', { reps: '5' }),
      item('Kettlebell Swing', { reps: '10', load_kg: 32, load_kg_f: 24 }),
      item('Ski Erg', { reps: 'max', notes: 'max cal' }),
    ], { title: 'WOD', notes: '5 sets : 2\' on / 2\' off. Score : total des calories Ski sur les 5 sets.' }),
  ],
]
const challenge = (title, move) => [
  block('metcon', 'amrap', { duration_s: 7 * 60, score: 'reps' }, [item(move, { reps: 'max' })], { title, notes: 'Une tentative dans la semaine, quand tu veux.' }),
]

let count = 0
// Past 2 weeks: CrossFit from templates, published.
const PAST_PLAN = [
  ['Chipper DU', 0, 'CrossFit'],
  ['Haltéro : clean & jerk', 1, 'Haltéro'],
  ['Fran', 2, 'CrossFit'],
  ['Hyrox simulation', 3, 'Hyrox'],
  ['Squat lourd + Cindy', 4, 'CrossFit'],
  ['EMOM gym', 5, 'Open Gym'],
]
for (const week of [-2, -1]) {
  for (const [title, dow, program] of PAST_PLAN) {
    await schedule(title, dayOf(week, dow), program, publishOn(dayOf(week, dow)), program === 'CrossFit' ? { title: 'WOD' } : {})
    count++
  }
  await create('CrossFit', dayOf(week, 0), 'Challenge de la semaine', challenge('Max burpees', 'Burpee'), publishOn(dayOf(week, 0)), 7)
  count++
}
// Current week: prod Kanda week in CrossFit, other programs from templates, weekly challenge (7 days).
for (const [dow, blocks] of KANDA_WEEK.entries()) {
  await create('CrossFit', dayOf(0, dow), 'WOD', blocks, publishOn(dayOf(0, dow)))
  count++
}
await create('CrossFit', dayOf(0, 0), 'Challenge de la semaine', challenge('Max wall balls', 'Wall Ball'), publishOn(dayOf(0, 0)), 7)
await schedule('Haltéro : clean & jerk', dayOf(0, 1), 'Haltéro', publishOn(dayOf(0, 1)))
await schedule('Hyrox simulation', dayOf(0, 3), 'Hyrox', publishOn(dayOf(0, 3)))
await schedule('EMOM gym', dayOf(0, 5), 'Open Gym', publishOn(dayOf(0, 5)))
// Draft (no publish date) on Saturday: hatched for coaches, invisible to athletes (UC-13).
await schedule('Chipper DU', dayOf(0, 5), 'CrossFit', null, { title: 'Team WOD (brouillon)' })
// Today in a3's personal program.
await schedule('Fran', today, 'Perso a3', new Date().toISOString(), { title: 'Fran (perso a3)' })
count += 6
// Next week: Mon-Wed scheduled, Thu-Fri drafts.
for (const [title, dow] of [['Squat lourd + Cindy', 0], ['DB DT ladder', 1], ['Fran', 2], ['EMOM gym', 3], ['Chipper DU', 4]]) {
  await schedule(title, dayOf(1, dow), 'CrossFit', dow <= 2 ? publishOn(dayOf(1, dow)) : null, { title: 'WOD' })
  count++
}
console.log(`Programmes : ${Object.keys(PROGRAMS).join(', ')} · ${Object.keys(TEMPLATES).length} modèles · ${count} séances programmées`)

// Results ---------------------------------------------------------------------------------
// Each athlete logs scores through the API (RLS applies) on workouts published up to now.
// Deterministic pseudo-random so reruns give the same data.
let seed = 42
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
const between = (min, max) => Math.round(min + rand() * (max - min))
const pick = (arr) => arr[between(0, arr.length - 1)]
const COMMENTS = ['Grosse séance 🔥', 'Les DU ont piqué', 'Bras cramés', 'Rythme régulier', 'Dur mais propre', null, null, null]
const DONE_COMMENTS = ['Technique ok', 'Barre à 60', 'Épaules raides', null]

function scoreFor(type, params, skill, female) {
  switch (type) {
    case 'time': {
      const cap = params.time_cap_s ?? 900
      const t = Math.round(cap * (0.95 - skill * 0.5 + rand() * 0.2))
      return t >= cap ? { capped: true, reps: between(40, 150) } : { time_s: rand() < 0.3 ? t - between(1, 9) / 10 : t }
    }
    case 'rounds_reps':
      return { rounds: Math.round(6 + skill * 14 + rand() * 3), reps: between(0, 14) }
    case 'reps':
      return { reps: Math.round((80 + skill * 160 + rand() * 30) * (female ? 0.85 : 1)) }
    case 'load':
      return { load_kg: Math.round(((40 + skill * 80 + rand() * 15) * (female ? 0.65 : 1)) / 2.5) * 2.5 }
    default:
      return {}
  }
}
const typeOf = (b) => b.params.score ?? { for_time: 'time', amrap: 'rounds_reps', sets_reps: 'load', tabata: 'reps' }[b.format] ?? 'none'

let resultCount = 0, doneCount = 0, skipCount = 0
for (const u of USERS.filter((x) => x.skip < 1)) {
  const client = await clientFor(u.name)
  const female = u.gender === 'female'
  const mine = must(await client.rpc('my_workouts', { p_from: dayOf(-2, 0), p_to: today }))
  for (const w of mine) {
    if (!w.publish_at || new Date(w.publish_at) > now) continue // coach preview of drafts / scheduled
    if (rand() < u.skip) continue
    const blocks = must(await client.from('workout_blocks').select('id, kind, format, params').eq('workout_id', w.id).order('position'))
    for (const b of blocks) {
      if (b.kind === 'warmup') continue
      // "Je passe" on some blocks (UC-12).
      if (rand() < 0.12) {
        must(await client.from('block_skips').insert({ workout_id: w.id, block_id: b.id }))
        skipCount++
        continue
      }
      if (b.params.team_size) continue // scored by team below
      const type = typeOf(b)
      const rx = rand() < u.rx
      if (type === 'none') {
        // "Fait" (null score), sometimes with a comment (UC-20, UC-21).
        if (rand() < 0.3) continue
        must(await client.from('results').insert({ workout_id: w.id, block_id: b.id, comment: pick(DONE_COMMENTS) }))
        doneCount++
      } else {
        must(await client.from('results').insert({
          workout_id: w.id, block_id: b.id, rx, comment: pick(COMMENTS), ...scoreFor(type, b.params, u.skill, female),
        }))
        resultCount++
      }
    }
  }
}
// Team WODs (UC-40): one entry per team, by its first member; men, women and mixed teams, guests without account.
const TEAMS = [
  { by: 'a1', with: ['a5'], time_s: 405, comment: 'On a souffert' },
  { by: 'a4', with: ['a2'], time_s: 380 },
  { by: 'a7', with: ['a9'], guests: [{ name: 'Zoé', gender: 'female' }], time_s: 470, rx: false },
  { by: 'a6', with: [], guests: [{ name: 'Camille', gender: 'female' }], time_s: 450 },
]
let teamCount = 0
for (const t of TEAMS) {
  const client = await clientFor(t.by)
  const mine = must(await client.rpc('my_workouts', { p_from: dayOf(-2, 0), p_to: today }))
  for (const w of mine.filter((x) => x.publish_at && new Date(x.publish_at) <= now)) {
    const blocks = must(await client.from('workout_blocks').select('id, params').eq('workout_id', w.id))
    for (const b of blocks.filter((x) => x.params.team_size)) {
      const ids = must(await client.rpc('team_candidates', { p_block: b.id }))
      const members = t.with.map((n) => ids.find((c) => c.first_name === USERS.find((u) => u.name === n).first)?.id).filter(Boolean)
      must(await client.rpc('save_team_result', {
        p_block: b.id, p_team: null, p_members: members, p_guests: t.guests ?? [], p_time_s: t.time_s, p_capped: false,
        p_rounds: null, p_reps: null, p_load_kg: null, p_rx: t.rx ?? true, p_comment: t.comment ?? null,
      }))
      teamCount++
    }
  }
}
console.log(`Résultats : ${teamCount} scores d'équipe`)
console.log(`Résultats : ${resultCount} scores, ${doneCount} "Fait", ${skipCount} "Je passe"`)

// Personal records: loads of % blocks (a3 has no Back Squat / Hang Clean 1RM, to show the "1RM ?" link).
const RECORDS = {
  a1: { 'Back Squat': [[1, 95], [5, 80]], 'Hang Clean': [[1, 65]], 'Front Squat': [[1, 80]], 'Squat Snatch': [[1, 55]], Fran: '3:55' },
  a2: { 'Back Squat': [[1, 120], [3, 110]], 'Clean & Jerk': [[1, 85]], 'Front Squat': [[1, 100]], Fran: '5:40' },
  a3: { Deadlift: [[1, 90]] },
  a4: { 'Back Squat': [[1, 170]], 'Hang Clean': [[1, 120]], 'Squat Snatch': [[1, 95]], 'Clean & Jerk': [[1, 125]], Fran: '2:48' },
  a7: { 'Back Squat': [[1, 85]], 'Front Squat': [[1, 70]] },
  c1: { 'Back Squat': [[1, 140]], 'Clean & Jerk': [[1, 105]], 'Hang Clean': [[1, 100]], Fran: '3:20' },
}
let recordCount = 0
for (const [name, recs] of Object.entries(RECORDS)) {
  const client = await clientFor(name)
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

// Usage stats for the admin "Stats" tab (UC-30): 7 days of sessions, screen loads, launches and a few errors.
// Written directly (track_usage only records the caller at now()).
const PAGES = [['/', 900, 40], ['/workouts/:id', 700, 25], ['/calendar', 1200, 10], ['/community', 800, 6], ['/records', 600, 6], ['/profile', 400, 3]]
const events = []
for (const u of USERS.filter((x) => x.skip < 1)) {
  for (let d = 6; d >= 0; d--) {
    if (rand() < u.skip + 0.15) continue
    for (let s = between(1, 2); s > 0; s--) {
      // Mostly 6-9h and 17-20h, Paris time.
      const at = new Date(now.getTime() - d * 86400e3)
      at.setHours(pick([6, 7, 8, 12, 17, 18, 19]), between(0, 59), between(0, 59))
      if (at > now) at.setTime(now.getTime() - between(60, 3600) * 1000)
      const t = at.getTime()
      events.push([u.name, t, 'session', rand() < 0.8 ? 'standalone' : 'browser', null])
      events.push([u.name, t + 500, 'load', '', between(700, 2600)])
      let tt = t + 2000
      for (const [key, ms, weight] of PAGES) {
        if (rand() * 45 > weight) continue
        events.push([u.name, (tt += between(5, 90) * 1000), 'view', key, between(ms * 0.4, ms * 1.8)])
      }
    }
  }
}
events.push(['a6', now.getTime() - 2 * 86400e3, 'error', 'TypeError: Load failed', null])
events.push(['a9', now.getTime() - 86400e3, 'error', 'TypeError: Load failed', null])
events.push(['a2', now.getTime() - 3 * 3600e3, 'error', 'Failed to fetch dynamically imported module', null])
const values = events.map(([n, t, kind, key, ms]) => `(${q(userId[n])}, ${q(new Date(t).toISOString())}, ${q(kind)}, ${q(key)}, ${ms ?? 'null'})`)
await sql(`insert into public.usage_events (user_id, at, kind, key, ms) values ${values.join(',')}`)
await sql(`insert into public.usage_last_seen (user_id, last_at)
  select user_id, max(at) from public.usage_events where user_id in (${Object.values(userId).map(q).join(',')}) group by user_id
  on conflict (user_id) do update set last_at = excluded.last_at`)
console.log(`Stats : ${events.length} événements d'usage`)
