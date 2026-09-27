// Closed sign-up: creates an account only for an email presented with a valid invitation code.
// The role is granted later by accept_invitation(), once the user proved email ownership (OTP).
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const { code, email } = await req.json().catch(() => ({}))
  if (typeof code !== 'string' || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'bad_request' }, 400)
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: inv } = await admin
    .from('invitations')
    .select('max_uses, uses')
    .eq('code', code)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (!inv || (inv.max_uses !== null && inv.uses >= inv.max_uses)) {
    return json({ error: 'invalid_invitation' }, 400)
  }

  const { error } = await admin.auth.admin.createUser({ email: email.trim().toLowerCase(), email_confirm: true })
  // Same answer whether the account already existed or not (no account enumeration).
  if (error && error.code !== 'email_exists') return json({ error: 'server_error' }, 500)
  return json({ ok: true })
})
