import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Gauge, Lock, ShieldAlert, SlidersHorizontal } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { Button, Field, Input } from '../components/ui'
import { A11yMenu, Footer, Logo } from '../components/Layout'
import { useToast } from '../components/Toast'

const DEMO_PASSWORD = 'CmDemo!2026'
const DEMO = [
  { email: 'approver@example.com', name: 'Team Approver', role: 'מאשר/ת · ראש צוות שירות א׳' },
  { email: 'manager@example.com', name: 'Division Manager', role: 'מנהל/ת אגף שירות לקוחות' },
  { email: 'governance@example.com', name: 'Governance Admin', role: 'Governance · כל הארגון' },
]
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export default function Login() {
  const { session } = useAuth()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  const signIn = async (e?: FormEvent, override?: { email: string; password: string }) => {
    e?.preventDefault()
    const em = (override?.email ?? email).trim(); const pw = override?.password ?? password
    const errs: typeof errors = {}
    if (!EMAIL_RE.test(em)) errs.email = 'כתובת דוא״ל לא תקינה'
    if (pw.length < 8) errs.password = 'סיסמה: לפחות 8 תווים'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw })
    setBusy(false)
    if (error) toast('error', error.message.includes('Invalid') ? 'דוא״ל או סיסמה שגויים' : 'ההתחברות נכשלה. נסו שוב.')
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.1fr_1fr]">
      <a href="#login" className="skip-link">דילוג לטופס הכניסה</a>
      <aside className="relative overflow-hidden bg-ink px-6 py-10 text-white lg:px-14 lg:py-16">
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full border-[28px] border-signal/15" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 left-24 h-80 w-80 rounded-full border-[18px] border-white/5" />
        <div className="relative flex items-center justify-between"><Logo light /><A11yMenu /></div>
        <div className="relative mt-10 max-w-lg lg:mt-24">
          <p className="text-sm font-semibold tracking-wide text-signal">מגדל בקרה לסוכני AI</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight lg:text-5xl">חופש פעולה ל-AI,<br />בלי לאבד שליטה.</h1>
          <p className="mt-4 text-white/80">מגדירים לכל סוכן רמת אוטונומיה וגבולות, ו-C.M אוכפת, מסלימה לאדם כשצריך ומתעדת כל פעולה.</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {[[SlidersHorizontal, 'חוגת אוטונומיה', '4 רמות, מ״מייעץ״ ועד ״אוטונומי מבוקר״'],
              [Gauge, 'Guardrails + AI', 'ספי סכום, ציון סיכון וסנטימנט בזמן אמת'],
              [ShieldAlert, 'Kill switch', 'עצירה מיידית, הקפאה ותחקיר ביומן']].map(([I, t, d]) => {
              const Icon = I as typeof Gauge
              return (
                <li key={t as string} className="flex gap-3">
                  <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10"><Icon className="h-5 w-5 text-signal" /></span>
                  <span><span className="block font-bold">{t as string}</span><span className="text-sm text-white/75">{d as string}</span></span>
                </li>
              )
            })}
          </ul>
        </div>
      </aside>

      <main id="login" className="flex flex-col px-6 py-10 lg:px-14 lg:py-16">
        <div className="mx-auto w-full max-w-md flex-1">
          <h2 className="text-2xl font-bold">כניסה למערכת</h2>
          <p className="mt-1 text-sm text-muted">לבדיקת המערכת השתמשו במשתמשי הדמו למטה — כל אחד מייצג תפקיד אחר עם הרשאות שונות.</p>

          <div className="mt-6" />

          <form onSubmit={signIn} noValidate className="flex flex-col gap-4">
            <Field label="דוא״ל" required error={errors.email}>
              {({ id, describedBy, invalid }) => (
                <Input id={id} type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  aria-describedby={describedBy} aria-invalid={invalid} className="text-left" />
              )}
            </Field>
            <Field label="סיסמה" required error={errors.password}>
              {({ id, describedBy, invalid }) => (
                <Input id={id} type="password" dir="ltr" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
                  aria-describedby={describedBy} aria-invalid={invalid} className="text-left" />
              )}
            </Field>
            <Button type="submit" loading={busy}><Lock className="h-4 w-4" aria-hidden />כניסה</Button>
          </form>

          <section aria-labelledby="demo-title" className="mt-8 rounded-2xl border border-signal/50 bg-signal-soft p-4">
            <h3 id="demo-title" className="text-sm font-bold">כניסה מהירה למשתמשי דמו (לבדיקה)</h3>
            <p className="mt-0.5 text-xs text-muted">שלושה תפקידים עם הרשאות שונות בפועל. נתוני דמה בלבד.</p>
            <div className="mt-3 grid gap-2">
              {DEMO.map((d) => (
                <button key={d.email} onClick={() => signIn(undefined, { email: d.email, password: DEMO_PASSWORD })} disabled={busy}
                  className="flex min-h-[44px] items-center justify-between rounded-xl border border-line bg-white px-3 py-2 text-right hover:border-brand">
                  <span><span className="block text-sm font-bold">{d.name}</span><span className="block text-xs text-muted">{d.role}</span></span>
                  <span className="text-xs font-semibold text-brand">כניסה ←</span>
                </button>
              ))}
            </div>
          </section>
        </div>
        <Footer />
      </main>
    </div>
  )
}
