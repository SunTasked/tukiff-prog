import { PASSWORD_RULES } from '../domain/password'
import { Input } from './ui'

/** New password + confirmation with a live checklist of the policy. */
export function PasswordFields({
  password,
  confirm,
  onPassword,
  onConfirm,
}: {
  password: string
  confirm: string
  onPassword: (v: string) => void
  onConfirm: (v: string) => void
}) {
  return (
    <>
      <Input
        label="Mot de passe"
        type="password"
        autoComplete="new-password"
        required
        value={password}
        onChange={(e) => onPassword(e.target.value)}
      />
      <ul className="grid grid-cols-2 gap-x-2 text-xs">
        {PASSWORD_RULES.map((r) => (
          <li key={r.label} className={r.test(password) ? 'text-lime-400' : 'text-zinc-500'}>
            {r.test(password) ? '✓' : '○'} {r.label}
          </li>
        ))}
      </ul>
      <Input
        label="Confirmer le mot de passe"
        type="password"
        autoComplete="new-password"
        required
        value={confirm}
        onChange={(e) => onConfirm(e.target.value)}
      />
    </>
  )
}
