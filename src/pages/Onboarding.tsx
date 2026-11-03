import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, Eye, Hand, OctagonX } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { AUTONOMY, ROLE_LABEL } from '../lib/labels'
import type { Autonomy, Role } from '../lib/types'
import { Button, Field, Input } from '../components/ui'
import { Logo } from '../components/Layout'
import { useToast } from '../components/Toast'

const ROLE_GUIDE: Record<Role, { see: string[]; can: string[]; cannot: string[]; first: { text: string; to: string }[] }> = {
  approver: {
    see: ['בקשות של הסוכנים שממתינות לצוות שלך', 'הערכת הסיכון של ה-AI והכללים שהופעלו'],
    can: ['לאשר או לדחות בקשה (בדחייה — חובה נימוק)'],
    cannot: ['לראות צוותים או אגפים אחרים', 'לשנות כללים או להשעות סוכן'],
    first: [{ text: 'לפתוח את תור האישורים', to: '/approvals' }, { text: 'לאשר או לדחות בקשה אחת', to: '/approvals' }],
  },
  division_manager: {
    see: ['כל הסוכנים והפעולות באגף שלך', 'דשבורד, יומן פעולות ותקריות של האגף'],
    can: ['להגדיר תהליך, רמת אוטונומיה ו-Guardrails', 'להריץ סוכן (סימולציה) ולהפעיל Kill switch', 'לאשר בקשות שהוסלמו אליך'],
    cannot: ['לתת רמת "אוטונומי מבוקר" (רק Governance)', 'להחזיר סוכן מושעה לפעילות', 'לראות אגפים אחרים'],
    first: [{ text: 'לסקור את מגדל הבקרה', to: '/control' }, { text: 'להריץ פנייה מדומה לסוכן', to: '/control#simulator' }, { text: 'לבדוק את ה-Guardrails של סוכן', to: '/control' }],
  },
  governance: {
    see: ['את כל האגפים, הסוכנים, היומנים והתקריות', 'Audit log מלא של כל שינוי והחלטה'],
    can: ['לנהל משתמשים ותפקידים', 'לתת רמת "אוטונומי מבוקר"', 'להחזיר סוכן מושעה לפעילות אחרי תחקיר', 'להפיק דוח AI שבועי'],
    cannot: ['להוריד לעצמך הרשאות (מניעת נעילה)'],
    first: [{ text: 'להפיק דוח AI שבועי', to: '/governance' }, { text: 'לבדוק תקריות פתוחות', to: '/incidents' }, { text: 'לסקור משתמשים והרשאות', to: '/governance' }],
  },
}

export default function Onboarding() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [name, setName] = useState(profile?.full_name ?? '')
  const [nameErr, setNameErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (!profile) return null
  const guide = ROLE_GUIDE[profile.role]
  const steps = ['ברוכים הבאים', 'התפקיד שלך', 'רמות אוטונומיה', 'צעדים ראשונים']

  const next = () => {
    if (step === 0) {
      const n = name.trim()
      if (n.length < 2 || n.length > 80) { setNameErr('שם: 2–80 תווים'); return }
      setNameErr(null)
    }
    setStep((s) => Math.min(s + 1, steps.length - 1))
  }

  const finish = async (to?: string) => {
    setBusy(true)
    const { error } = await supabase.from('profiles').update({ full_name: name.trim(), onboarded: true }).eq('id', profile.id)
    setBusy(false)
    if (error) { toast('error', 'שמירה נכשלה, נסו שוב'); return }
    await refreshProfile()
    navigate(to ?? '/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-ink px-4 py-3"><div className="mx-auto max-w-3xl"><Logo light /></div></header>
      <main id="main" className="mx-auto max-w-3xl px-4 py-8">
        <ol className="mb-6 flex gap-2" aria-label="שלבי ההיכרות">
          {steps.map((s, i) => (
            <li key={s} className="flex-1" aria-current={i === step ? 'step' : undefined}>
              <div className={`h-1.5 rounded-full ${i <= step ? 'bg-signal' : 'bg-line'}`} />
              <span className={`mt-1.5 hidden text-xs sm:block ${i === step ? 'font-bold' : 'text-muted'}`}>{i + 1}. {s}</span>
            </li>
          ))}
        </ol>

        <div className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
          {step === 0 && (
            <>
              <h1 className="text-2xl font-bold sm:text-3xl">ברוכים הבאים ל-C.M</h1>
              <p className="mt-3 text-muted">סוכני AI בארגון כבר לא רק עונים — הם <b className="text-ink">מבצעים</b>: נותנים פיצוי, שולחים מייל, מעדכנים חשבון.
                C.M הוא מגדל הבקרה שמחליט מה מותר לסוכן לעשות לבד, ומתי חובה לעצור ולשאול אדם.</p>
              <div className="mt-6 max-w-sm">
                <Field label="איך לקרוא לך?" required error={nameErr} help="השם יופיע בהחלטות וביומן הפעולות.">
                  {({ id, describedBy, invalid }) => (
                    <Input id={id} value={name} onChange={(e) => setName(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid} autoComplete="name" />
                  )}
                </Field>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="text-2xl font-bold">התפקיד שלך: {ROLE_LABEL[profile.role]}</h1>
              <p className="mt-2 text-sm text-muted">ההרשאות נאכפות בבסיס הנתונים עצמו — לא רק במסך.</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {[{ t: 'מה תראה/י', I: Eye, items: guide.see, c: 'text-brand' },
                  { t: 'מה תוכל/י לעשות', I: Hand, items: guide.can, c: 'text-ok' },
                  { t: 'מה לא', I: OctagonX, items: guide.cannot, c: 'text-danger' }].map((b) => (
                  <div key={b.t} className="rounded-xl border border-line p-4">
                    <div className={`flex items-center gap-2 font-bold ${b.c}`}><b.I aria-hidden className="h-5 w-5" />{b.t}</div>
                    <ul className="mt-2 list-disc space-y-1 ps-5 text-sm">{b.items.map((x) => <li key={x}>{x}</li>)}</ul>
                  </div>
                ))}
              </div>
              {profile.role === 'approver' && profile.email && !profile.email.endsWith('@example.com') && (
                <p className="mt-4 rounded-xl bg-signal-soft p-3 text-sm">נרשמת כמשתמש/ת חדש/ה, לכן קיבלת תפקיד ברירת מחדל של מאשר/ת ב״צוות שירות א׳״. Governance יכול לשנות זאת.</p>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-2xl font-bold">ארבע רמות אוטונומיה</h1>
              <p className="mt-2 text-sm text-muted">לכל סוכן יש רמה אחת. ככל שהרמה גבוהה יותר — הסוכן עושה יותר לבד, וה-Guardrails הם הבלמים.</p>
              <ol className="mt-6 grid gap-3 sm:grid-cols-4">
                {(Object.keys(AUTONOMY) as Autonomy[]).map((k) => (
                  <li key={k} className="rounded-xl border border-line p-4">
                    <div className="flex gap-1" aria-hidden>{[1, 2, 3, 4].map((i) => <span key={i} className={`h-2 flex-1 rounded-full ${i <= AUTONOMY[k].step ? 'bg-signal' : 'bg-line'}`} />)}</div>
                    <div className="mt-3 font-bold">{AUTONOMY[k].step}. {AUTONOMY[k].label}</div>
                    <p className="mt-1 text-xs text-muted">{AUTONOMY[k].desc}</p>
                  </li>
                ))}
              </ol>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="text-2xl font-bold">צעדים ראשונים</h1>
              <p className="mt-2 text-sm text-muted">כדי להרגיש את המערכת בתוך 3 דקות:</p>
              <ul className="mt-5 space-y-2">
                {guide.first.map((f, i) => (
                  <li key={f.text}>
                    <button onClick={() => finish(f.to)} disabled={busy} className="flex w-full min-h-[48px] items-center gap-3 rounded-xl border border-line px-4 text-right hover:border-brand">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-signal text-sm font-bold">{i + 1}</span>
                      <span className="flex-1 font-semibold">{f.text}</span><ChevronLeft aria-hidden className="h-4 w-4 text-muted" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-5">
            <button onClick={() => finish()} className="text-sm font-semibold text-muted hover:text-ink hover:underline">דילוג על ההיכרות</button>
            <div className="flex gap-2">
              {step > 0 && <Button variant="secondary" onClick={() => setStep(step - 1)}><ChevronRight aria-hidden className="h-4 w-4" />הקודם</Button>}
              {step < steps.length - 1
                ? <Button onClick={next}>הבא<ChevronLeft aria-hidden className="h-4 w-4" /></Button>
                : <Button onClick={() => finish()} loading={busy}><Check aria-hidden className="h-4 w-4" />סיום והתחלה</Button>}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
