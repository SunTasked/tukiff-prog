// Account admin via the Supabase Auth admin API.
// Usage:
//   node scripts/admin.mjs create-user <email> [--role coach|athlete] [--password <pwd>]
//   node scripts/admin.mjs set-role <email> <coach|athlete|none>
//   node scripts/admin.mjs login-link <email> [redirectUrl]   (no email sent)
//   node scripts/admin.mjs delete-user <email>
//   node scripts/admin.mjs list
import { serviceKey, sql } from './lib.mjs'

const key = await serviceKey()
const [cmd, email, ...rest] = process.argv.slice(2)
const opt = (name) => {
  const i = rest.indexOf(`--${name}`)
  return i >= 0 ? rest[i + 1] : undefined
}

async function auth(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`)
  return json
}

const quote = (s) => `'${String(s).replaceAll("'", "''")}'`
async function setRole(email, role) {
  const value = role === 'none' ? 'null' : quote(role)
  const rows = await sql(
    `update public.profiles p set role = ${value} from auth.users u
     where u.id = p.id and u.email = ${quote(email)} returning p.id`,
  )
  if (!rows.length) throw new Error(`Utilisateur introuvable : ${email}`)
}

switch (cmd) {
  case 'create-user': {
    const password = opt('password')
    await auth('/admin/users', { method: 'POST', body: { email, email_confirm: true, ...(password && { password }) } })
    if (opt('role')) await setRole(email, opt('role'))
    console.log(`Créé : ${email}`)
    break
  }
  case 'set-role':
    await setRole(email, rest[0])
    console.log(`${email} -> ${rest[0]}`)
    break
  case 'login-link': {
    const link = await auth('/admin/generate_link', {
      method: 'POST',
      body: { type: 'magiclink', email, ...(rest[0] && { redirect_to: rest[0] }) },
    })
    console.log(`Lien : ${link.action_link}\nCode : ${link.email_otp}`)
    break
  }
  case 'delete-user': {
    const [u] = await sql(`select id from auth.users where email = ${quote(email)}`)
    if (!u) throw new Error(`Utilisateur introuvable : ${email}`)
    await auth(`/admin/users/${u.id}`, { method: 'DELETE' })
    console.log(`Supprimé : ${email}`)
    break
  }
  case 'list':
    console.table(
      await sql(`select u.email, p.role, p.display_name, u.last_sign_in_at
                 from auth.users u left join public.profiles p on p.id = u.id order by u.created_at`),
    )
    break
  default:
    console.log('Commandes : create-user, set-role, login-link, delete-user, list')
}
