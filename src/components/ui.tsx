import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Loader2, X } from 'lucide-react'
import type { Tone } from '../lib/labels'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'signal'
const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark',
  secondary: 'bg-white text-ink border border-line hover:bg-canvas',
  danger: 'bg-danger text-white hover:bg-[#912018]',
  ghost: 'text-brand hover:bg-brand-soft',
  signal: 'bg-signal text-ink hover:bg-[#d99800]',
}

export function Button({ variant = 'primary', loading, children, className = '', disabled, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT[variant]} ${className}`}
    >
      {loading && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

export function Card({ children, className = '', as: As = 'section', ...rest }:
  { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article'; 'aria-labelledby'?: string }) {
  return <As {...rest} className={`rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5 ${className}`}>{children}</As>
}

const TONE: Record<Tone, string> = {
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-brand-soft text-brand-dark',
  neutral: 'bg-canvas text-muted border border-line',
}
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[tone]}`}>{children}</span>
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

/** Label + control + help + error, wired with ids for screen readers. */
export function Field({ label, help, error, required, children }:
  { label: string; help?: string; error?: string | null; required?: boolean; children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode }) {
  const id = useId()
  const helpId = help ? `${id}-help` : undefined
  const errId = error ? `${id}-err` : undefined
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}{required && <span className="text-danger" aria-hidden> *</span>}
        {required && <span className="sr-only"> (שדה חובה)</span>}
      </label>
      {children({ id, describedBy: [helpId, errId].filter(Boolean).join(' ') || undefined, invalid: Boolean(error) })}
      {help && <p id={helpId} className="text-xs text-muted">{help}</p>}
      {error && <p id={errId} className="text-xs font-semibold text-danger">{error}</p>}
    </div>
  )
}

const controlCls = 'min-h-[44px] w-full rounded-xl border border-line bg-white px-3 text-sm text-ink placeholder:text-[#667085] aria-[invalid=true]:border-danger'
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${controlCls} ${p.className ?? ''}`} />
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`${controlCls} ${p.className ?? ''}`} />
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={`${controlCls} py-2 ${p.className ?? ''}`} />

export function Spinner({ label = 'טוען…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
      <Loader2 aria-hidden className="h-5 w-5 animate-spin" />{label}
    </div>
  )
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-white px-6 py-10 text-center">
      <div aria-hidden className="mb-1 rounded-full bg-signal-soft p-3 text-ink">{icon}</div>
      <h2 className="text-base font-bold">{title}</h2>
      <p className="max-w-sm text-sm text-muted">{text}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/** Accessible modal: role=dialog, focus moves in, Esc closes, focus returns. */
export function Modal({ open, onClose, title, children, footer }:
  { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const node = ref.current
    const first = node?.querySelector<HTMLElement>('input, textarea, select, button:not([data-close])')
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && node) {
        const f = Array.from(node.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, textarea, select'))
        if (!f.length) return
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus() }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus() }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-bold">{title}</h2>
          <button data-close onClick={onClose} aria-label="סגירה" className="rounded-lg p-1 text-muted hover:bg-canvas"><X className="h-5 w-5" /></button>
        </div>
        {children}
        {footer && <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: Tone }) {
  const accent = tone === 'danger' ? 'text-danger' : tone === 'warn' ? 'text-warn' : tone === 'ok' ? 'text-ok' : 'text-ink'
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className={`num mt-1 text-2xl font-bold ${accent}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  )
}
