// Configures Supabase Auth (URLs, OTP, and — once custom SMTP is set — SMTP + email templates).
// Usage: node scripts/auth-config.mjs <siteUrl>
// With SMTP_PASSWORD in the environment, configures Gmail SMTP and the French email templates
// (Supabase refuses template changes on the built-in SMTP).
import { api, target } from './lib.mjs'

const appName = target === 'prod' ? 'TKF Programming' : 'TKF Staging'

const siteUrl = process.argv[2]
if (!siteUrl) throw new Error('Usage: node scripts/auth-config.mjs <siteUrl>')

const smtpUser = process.env.SMTP_USER || 'guillaume.kheng@gmail.com'
// Link only: the app never asks for the OTP code (signup goes through the link back to /join/<code>).
const template = `<h2>${appName}</h2>
<p>Pour finaliser ton inscription, <a href="{{ .ConfirmationURL }}">ouvre ce lien</a>.</p>
<p>Il expire dans 1 heure.</p>`
const recoveryTemplate = `<h2>${appName}</h2>
<p>Pour choisir un nouveau mot de passe, <a href="{{ .ConfirmationURL }}">ouvre ce lien</a>.</p>
<p>Il expire dans 1 heure. Si tu n’as rien demandé, ignore cet email.</p>`

const smtp = process.env.SMTP_PASSWORD && {
  smtp_host: 'smtp.gmail.com',
  smtp_port: '465',
  smtp_user: smtpUser,
  smtp_pass: process.env.SMTP_PASSWORD,
  smtp_admin_email: smtpUser,
  smtp_sender_name: appName,
  rate_limit_email_sent: 30,
  mailer_subjects_magic_link: `Ton lien d’inscription ${appName}`,
  mailer_templates_magic_link_content: template,
  mailer_subjects_confirmation: `Ton lien d’inscription ${appName}`,
  mailer_templates_confirmation_content: template,
  mailer_subjects_recovery: `Nouveau mot de passe ${appName}`,
  mailer_templates_recovery_content: recoveryTemplate,
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
    // 8+ chars with lower, upper, digit and symbol (Supabase only accepts these exact rule strings).
    password_min_length: 8,
    password_required_characters:
      'abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789:!@#$%^&*()_+-=[]{};\'\\\\:"|<>?,./`~',
    mailer_otp_exp: 3600,
    ...smtp,
  },
})
console.log(`Auth configurée (site_url = ${siteUrl}, SMTP custom : ${smtp ? 'oui' : 'non'})`)
