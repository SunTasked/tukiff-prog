// CI checks of a pull request against the release rules (releases/README.md).
// Usage: node scripts/check-release.mjs <base branch>   (needs the base branch fetched as origin/<base>)
//   main:    the version is bumped, releases/v<version>.json exists, releases/next-update/ is empty,
//            no high or critical vulnerability (npm audit).
//   staging: the PR adds a note in releases/next-update/ (except release preparations, main merged back
//            and Dependabot updates).
import { execSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

const base = process.argv[2]
const sh = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim()
const version = JSON.parse(readFileSync('package.json', 'utf8')).version
const baseVersion = JSON.parse(sh(`git show origin/${base}:package.json`)).version
const fail = (msg) => {
  console.error(`::error::${msg}`)
  process.exit(1)
}

if (base === 'main') {
  if (version === baseVersion) fail(`Version inchangée (${version}) : lancer node scripts/release.mjs avant de merger dans main`)
  if (!existsSync(`releases/v${version}.json`)) fail(`releases/v${version}.json manquant`)
  if (readdirSync('releases/next-update').some((f) => f.endsWith('.json'))) fail('releases/next-update/ doit être vide : lancer node scripts/release.mjs')
  try {
    execSync('npm audit --audit-level=high', { stdio: 'inherit' })
  } catch {
    fail('Vulnérabilités hautes ou critiques : mettre à jour les dépendances avant la release')
  }
} else if (base === 'staging') {
  const head = process.env.GITHUB_HEAD_REF
  const added = sh(`git diff --name-only --diff-filter=AM origin/${base}...HEAD -- releases/next-update`)
  if (head !== 'main' && !head?.startsWith('dependabot/') && version === baseVersion && !added.split('\n').some((f) => f.endsWith('.json')))
    fail('Ajouter les nouveautés de la PR dans releases/next-update/<feature>.json (voir releases/README.md)')
}
console.log(`Règles de release OK (${base}, version ${version})`)
