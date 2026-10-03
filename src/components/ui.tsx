import type React from 'react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { pendingRequests } from '../lib/supabase'
import { Markdown } from './Markdown'

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

export function Textarea({
  label,
  className = '',
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm text-zinc-400">{label}</span>}
      <textarea
        rows={2}
        className={`w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100 outline-none focus:border-lime-400 ${className}`}
        {...props}
      />
    </label>
  )
}

/** Horizontal single-choice chips. */
export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Record<T, string>
  value: T | null
  onChange: (v: T) => void
}) {
  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {(Object.keys(options) as T[]).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
            value === k ? 'bg-lime-400 font-semibold text-zinc-950' : 'bg-zinc-800 text-zinc-300'
          }`}
        >
          {options[k]}
        </button>
      ))}
    </div>
  )
}

const smallInput =
  'w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-zinc-100 outline-none focus:border-lime-400'

/** Compact labelled field for dense forms. */
export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-0.5 block text-xs text-zinc-500">{label}</span>
      {children}
    </label>
  )
}

export function SmallInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={smallInput} {...props} />
}

/**
 * Blocks the screen while a write is slow to answer, so taps don't pile up.
 * Appears after a short delay: quick saves show nothing.
 */
export function BusyOverlay() {
  const pending = useSyncExternalStore(pendingRequests.subscribe, pendingRequests.count)
  const busy = pending > 0
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!busy) return setVisible(false)
    const t = setTimeout(() => setVisible(true), 300)
    return () => clearTimeout(t)
  }, [busy])
  if (!busy) return null
  // Invisible until the delay: still swallows taps (double-submits) from the first millisecond.
  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center ${visible ? 'bg-black/40' : ''}`} aria-busy="true">
      {visible && <div className="size-10 animate-spin rounded-full border-2 border-zinc-700 border-t-lime-400" />}
    </div>
  )
}

/** Encircled cross that closes a sheet, modal or panel. */
export function CloseButton({ onClick, className = '' }: { onClick: () => void; className?: string }) {
  return (
    <button type="button" aria-label="Fermer" onClick={onClick} className={`-m-1 shrink-0 p-1 text-zinc-400 active:text-zinc-200 ${className}`}>
      <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M15 9l-6 6M9 9l6 6" />
      </svg>
    </button>
  )
}

/** The (?) button that shows or hides a help bubble. */
export function HelpButton({ open, onClick, label }: { open: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className={`grid size-5 shrink-0 place-items-center rounded-full border text-xs ${open ? 'border-lime-400 text-lime-400' : 'border-zinc-600 text-zinc-400'}`}
      aria-label={label}
      aria-expanded={open}
      onClick={onClick}
    >
      ?
    </button>
  )
}

/** Help bubble under a (?): light markdown (blank line = paragraph, - list, **bold**); tap closes it. */
export function HelpBubble({ text, onClose, className = '' }: { text: string; onClose: () => void; className?: string }) {
  return (
    <div
      className={`absolute z-10 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm leading-snug text-zinc-300 shadow-lg shadow-black ${className}`}
      onClick={onClose}
    >
      <Markdown text={text} gap="gap-2.5" />
    </div>
  )
}
