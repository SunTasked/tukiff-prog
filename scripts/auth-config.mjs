// Configures Supabase Auth (URLs, OTP, and — once custom SMTP is set — SMTP + email templates).
// Usage: node scripts/auth-config.mjs <siteUrl>
// With SMTP_PASSWORD in the environment, configures Gmail SMTP and the French email templates
// (Supabase refuses template changes on the built-in SMTP).
import { api } from './lib.mjs'

const siteUrl = process.argv[2]
if (!siteUrl) throw new Error('Usage: node scripts/auth-config.mjs <siteUrl>')

const smtpUser = 'guillaume.kheng@gmail.com'
const template = `<h2>Tukiff Prog</h2>
<p>Ton code de connexion :</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
<p>Saisis-le dans l’application. Il expire dans 1 heure.</p>
<p>Ou <a href="{{ .ConfirmationURL }}">connecte-toi avec ce lien</a> (il s’ouvre dans le navigateur, pas dans l’app installée sur l’écran d’accueil).</p>`

const smtp = process.env.SMTP_PASSWORD && {
  smtp_host: 'smtp.gmail.com',
  smtp_port: '465',
  smtp_user: smtpUser,
  smtp_pass: process.env.SMTP_PASSWORD,
  smtp_admin_email: smtpUser,
  smtp_sender_name: 'Tukiff Prog',
  rate_limit_email_sent: 30,
  mailer_subjects_magic_link: 'Ton code de connexion Tukiff Prog',
  mailer_templates_magic_link_content: template,
  mailer_subjects_confirmation: 'Ton code de connexion Tukiff Prog',
  mailer_templates_confirmation_content: template,
}

await api('/config/auth', {
  method: 'PATCH',
  body: {
    site_url: siteUrl,
    uri_allow_list: [
      'https://tukiff-prog-*-tukiff.vercel.app/**', // Vercel previews
      'https://tukiff-prog.vercel.app/**',
      'http://localhost:5173/**',
    ].join(','),
    disable_signup: true, // accounts are created only by the join Edge Function
    mailer_otp_length: 6,
    mailer_otp_exp: 3600,
    ...smtp,
  },
})
console.log(`Auth configurée (site_url = ${siteUrl}, SMTP custom : ${smtp ? 'oui' : 'non'})`)
