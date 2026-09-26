import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }

const variants = {
  primary: 'bg-lime-400 text-zinc-950 active:bg-lime-300',
  secondary: 'bg-zinc-800 text-zinc-100 active:bg-zinc-700',
  danger: 'bg-zinc-800 text-red-400 active:bg-zinc-700',
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`rounded-xl px-4 py-3 font-semibold disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  )
}

export function Input({ label, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm text-zinc-400">{label}</span>}
      <input
        className={`w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100 outline-none focus:border-lime-400 ${className}`}
        {...props}
      />
    </label>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-zinc-900 p-4 ${className}`}>{children}</div>
}

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="mb-4 text-2xl font-bold">{children}</h1>
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? <p className="text-sm text-red-400">{children}</p> : null
}

export function Spinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="size-8 animate-spin rounded-full border-2 border-zinc-700 border-t-lime-400" />
    </div>
  )
}

/** Full-screen centered layout for auth / onboarding screens. */
export function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {children}
    </div>
  )
}
