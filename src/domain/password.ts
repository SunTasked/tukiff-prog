// Mirrors the Supabase Auth password policy (see scripts/auth-config.mjs).
export const PASSWORD_RULES = [
  { label: '8 caractères minimum', test: (p: string) => p.length >= 8 },
  { label: 'une minuscule', test: (p: string) => /[a-z]/.test(p) },
  { label: 'une majuscule', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'un chiffre', test: (p: string) => /[0-9]/.test(p) },
  { label: 'un caractère spécial', test: (p: string) => /[!@#$%^&*()_+\-=[\]{};'\\:"|<>?,./`~]/.test(p) },
] as const

export const isValidPassword = (p: string) => PASSWORD_RULES.every((r) => r.test(p))
