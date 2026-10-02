// Prepares a production release, on a branch made from an up-to-date `staging`:
//   1. updates the dependencies within their ranges (npm update) and fixes vulnerabilities (npm audit fix),
//      then refuses to go on while `npm audit` still reports a high or critical vulnerability,
//   2. runs lint, tests and build,
//   3. bumps the version of package.json and gathers releases/next-update/*.json into releases/v<version>.json.
// Commit the result, merge it into `staging`, check the app on the staging URL, then merge `staging` into `main`.
// Major upgrades (npm outdated) are listed but not applied.
// Usage: node scripts/release.mjs <mineur|correctif|majeur> [--dry-run]
import { execSync } from 'node:child_process'
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

const LEVELS = { majeur: 'major', mineur: 'minor', correctif: 'patch' }
const level = LEVELS[process.argv[2]]
if (!level) throw new Error('Usage : node scripts/release.mjs <mineur|correctif|majeur> [--dry-run]')
const dryRun = process.argv.includes('--dry-run')

const root = new URL('../', import.meta.url)
const nextDir = new URL('releases/next-update/', root)
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' })
const read = (cmd) => execSync(cmd, { cwd: root, encoding: 'utf8' })

const CATEGORIES = ['admin', 'coach', 'athlete']
const fragments = readdirSync(nextDir).filter((f) => f.endsWith('.json')).sort()
const notes = Object.fromEntries(CATEGORIES.map((c) => [c, []]))
for (const file of fragments) {
  const content = JSON.parse(readFileSync(new URL(file, nextDir), 'utf8'))
  for (const [key, items] of Object.entries(content)) {
    if (!CATEGORIES.includes(key) || !Array.isArray(items)) throw new Error(`${file} : catégorie inconnue « ${key} » (${CATEGORIES.join(', ')})`)
    notes[key].push(...items)
  }
}
if (!fragments.length) throw new Error('releases/next-update/ est vide : rien à publier')

const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
const [major, minor, patch] = pkg.version.split('.').map(Number)
const version = { major: `${major + 1}.0.0`, minor: `${major}.${minor + 1}.0`, patch: `${major}.${minor}.${patch + 1}` }[level]
console.log(`Version ${pkg.version} -> ${version}`)
for (const c of CATEGORIES) for (const item of notes[c]) console.log(`  [${c}] ${item}`)
if (dryRun) process.exit(0)

console.log('\nMise à jour des dépendances…')
run('npm update')
run('npm audit fix')
try {
  run('npm audit --audit-level=high')
} catch {
  throw new Error('Vulnérabilités hautes ou critiques restantes : mise à jour majeure à faire à la main (voir npm audit)')
}
const outdated = read('npm outdated || true').trim()
if (outdated) console.log(`\nMises à jour majeures non appliquées :\n${outdated}`)

console.log('\nVérifications…')
run('npm run lint')
run('npm test')
run('npm run build')

run(`npm version ${version} --no-git-tag-version`)
const file = `releases/v${version}.json`
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })
writeFileSync(new URL(file, root), `${JSON.stringify({ version, date: today, ...notes }, null, 2)}\n`)
for (const f of fragments) rmSync(new URL(f, nextDir))
console.log(`\n${file} écrit. Commiter, merger dans staging, tester l'URL staging, puis PR staging -> main.`)
