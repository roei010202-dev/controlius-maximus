import { useCallback, useEffect, useState } from 'react'
import { Bot, CalendarDays, Clock, FileText, Pencil, Users } from 'lucide-react'
import { callFunction, dbMessage, supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { ROLE_LABEL } from '../lib/labels'
import type { Profile, Role } from '../lib/types'
import { fmtDate } from '../lib/format'
import { Badge, Button, Card, Field, Modal, PageHeader, Select, Spinner } from '../components/ui'
import { useToast } from '../components/Toast'

type Tab = 'users' | 'report' | 'audit' | 'tools'
type Audit = { id: number; event: string; entity: string; created_at: string; details: Record<string, unknown>; profiles: { full_name: string | null } | null }

const EVENT_LABEL: Record<string, string> = {
  submitted: 'סוכן הגיש פעולה', approved: 'בקשה אושרה', rejected: 'בקשה נדחתה', suspended: 'Kill switch — סוכן הושעה',
  reinstated: 'סוכן הוחזר לפעילות', sla_escalated: 'הסלמה אוטומטית (SLA)', role_changed: 'שינוי תפקיד/הרשאות',
}

export default function Governance() {
  const [tab, setTab] = useState<Tab>('users')
  const tabs: { k: Tab; label: string; icon: typeof Users }[] = [
    { k: 'users', label: 'משתמשים והרשאות', icon: Users }, { k: 'report', label: 'דוח AI שבועי', icon: Bot },
    { k: 'audit', label: 'Audit log', icon: FileText }, { k: 'tools', label: 'יומן ואוטומציות', icon: CalendarDays },
  ]
  return (
    <>
      <PageHeader title="Governance" subtitle="מבט-על ארגוני: מי רשאי לעשות מה, מה קרה, ומה כדאי לשנות." />
      <div role="tablist" aria-label="אזורי Governance" className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-card">
        {tabs.map((t) => (
          <button key={t.k} role="tab" aria-selected={tab === t.k} onClick={() => setTab(t.k)}
            className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-xs font-semibold sm:gap-2 sm:px-3 sm:text-sm ${tab === t.k ? 'bg-ink text-white' : 'text-muted hover:bg-canvas'}`}>
            <t.icon aria-hidden className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>
      {tab === 'users' && <UsersTab />}
      {tab === 'report' && <ReportTab />}
      {tab === 'audit' && <AuditTab />}
      {tab === 'tools' && <ToolsTab />}
    </>
  )
}

function UsersTab() {
  const { profile: me, divisions, teams } = useAuth()
  const toast = useToast()
  const [users, setUsers] = useState<Profile[] | null>(null)
  const [edit, setEdit] = useState<Profile | null>(null)
  const [f, setF] = useState({ role: 'approver' as Role, division_id: '', team_id: '', is_active: true })
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => supabase.from('profiles').select('*').order('created_at').then(({ data }) => setUsers((data as Profile[]) ?? [])), [])
  useEffect(() => { load() }, [load])

  const open = (u: Profile) => { setEdit(u); setF({ role: u.role, division_id: u.division_id ?? '', team_id: u.team_id ?? '', is_active: u.is_active }) }
  const save = async () => {
    if (!edit) return
    setBusy(true)
    const { error } = await supabase.rpc('admin_set_user', { p_user: edit.id, p_role: f.role, p_division: f.division_id || null, p_team: f.team_id || null, p_active: f.is_active })
    setBusy(false)
    if (error) { toast('error', dbMessage(error)); return }
    toast('success', 'ההרשאות עודכנו'); setEdit(null); load()
  }
  if (!users) return <Spinner />
  return (
    <>
      <Card className="mb-5">
        <h2 className="mb-3 text-lg font-bold">מי רואה מה</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <caption className="sr-only">מטריצת הרשאות לפי תפקיד</caption>
            <thead className="bg-canvas text-xs text-muted"><tr><th scope="col" className="p-2 text-right">יכולת</th><th scope="col" className="p-2">מאשר/ת</th><th scope="col" className="p-2">מנהל/ת אגף</th><th scope="col" className="p-2">Governance</th></tr></thead>
            <tbody className="divide-y divide-line text-center">
              {[['צפייה בבקשות', 'הצוות שלו', 'האגף', 'הכל'], ['אישור/דחייה', '✓', '✓ (כולל הסלמות)', '✓'], ['הגדרת סוכן ו-Guardrails', '—', 'באגף', 'הכל'],
                ['רמת "אוטונומי מבוקר"', '—', '—', '✓'], ['Kill switch', '—', 'באגף', '✓'], ['החזרת סוכן לפעילות', '—', '—', '✓'],
                ['ניהול משתמשים, Audit, דוח AI', '—', 'Audit של האגף', '✓']].map((r) => (
                <tr key={r[0]}><th scope="row" className="p-2 text-right font-semibold">{r[0]}</th>{r.slice(1).map((c, i) => <td key={i} className="p-2">{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <ul className="grid gap-2">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-white p-3 shadow-card">
            <div>
              <div className="font-semibold">{u.full_name} {u.id === me?.id && <span className="text-xs text-muted">(את/ה)</span>}</div>
              <div className="text-xs text-muted" dir="ltr">{u.email}</div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="info">{ROLE_LABEL[u.role]}</Badge>
              {u.division_id && <Badge>{divisions.find((d) => d.id === u.division_id)?.name}</Badge>}
              {u.team_id && <Badge>{teams.find((t) => t.id === u.team_id)?.name}</Badge>}
              {!u.is_active && <Badge tone="danger">מושבת</Badge>}
              <Button variant="ghost" className="min-h-[36px] px-2" onClick={() => open(u)} aria-label={`עריכת הרשאות ${u.full_name ?? ''}`}><Pencil aria-hidden className="h-4 w-4" /></Button>
            </div>
          </li>
        ))}
      </ul>
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={`הרשאות: ${edit?.full_name ?? ''}`}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>ביטול</Button><Button loading={busy} onClick={save}>שמירה</Button></>}>
        <div className="grid gap-4">
          <Field label="תפקיד" required>{({ id }) => (
            <Select id={id} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select>)}</Field>
          {f.role !== 'governance' && <Field label="אגף" required>{({ id }) => (
            <Select id={id} value={f.division_id} onChange={(e) => setF({ ...f, division_id: e.target.value, team_id: '' })}><option value="">בחר/י…</option>{divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>)}</Field>}
          {f.role === 'approver' && <Field label="צוות" required>{({ id }) => (
            <Select id={id} value={f.team_id} onChange={(e) => setF({ ...f, team_id: e.target.value })}><option value="">בחר/י…</option>{teams.filter((t) => t.division_id === f.division_id).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>)}</Field>}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} className="h-5 w-5 accent-brand" />חשבון פעיל</label>
        </div>
      </Modal>
    </>
  )
}

function ReportTab() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<{ report?: string; generated_at?: string; stats?: { agents: { agent: string; total: number; needs_human: number; avg_risk: number | null }[] } } | null>(null)
  const run = async () => {
    setBusy(true)
    try { setRes(await callFunction('ai-report', {})) } catch (e) { toast('error', (e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-bold">דוח מנהלים שבועי (AI)</h2><p className="text-sm text-muted">ה-AI מנתח 7 ימי פעילות של כל הסוכנים ומצביע על דפוסים, חריגות והמלצה אחת לפעולה.</p></div>
        <Button onClick={run} loading={busy}><Bot aria-hidden className="h-4 w-4" />{res ? 'הפקה מחדש' : 'הפקת דוח'}</Button>
      </div>
      {res?.report && (
        <div className="mt-5 rounded-xl border-s-4 border-signal bg-signal-soft/40 p-4" aria-live="polite">
          <div className="whitespace-pre-line text-sm leading-relaxed">{res.report.replace(/\*\*/g, '')}</div>
          <p className="mt-3 text-xs text-muted">הופק {fmtDate(res.generated_at)} · נוצר ע״י AI — יש לאמת מול הנתונים לפני החלטה.</p>
        </div>
      )}
      {res?.stats && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {res.stats.agents.map((a) => <li key={a.agent} className="rounded-xl bg-canvas p-3 text-sm"><b>{a.agent}</b> · {a.total} פעולות · {a.needs_human} לאדם · סיכון ממוצע {a.avg_risk ?? '—'}</li>)}
        </ul>
      )}
    </Card>
  )
}

function AuditTab() {
  const [rows, setRows] = useState<Audit[] | null>(null)
  useEffect(() => { supabase.from('audit_log').select('id, event, entity, created_at, details, profiles(full_name)').order('created_at', { ascending: false }).limit(150).then(({ data }) => setRows((data as unknown as Audit[]) ?? [])) }, [])
  if (!rows) return <Spinner />
  return (
    <Card>
      <h2 className="mb-1 text-lg font-bold">Audit log</h2>
      <p className="mb-3 text-sm text-muted">כל החלטה ושינוי הרשאה נרשמים אוטומטית בבסיס הנתונים, כולל פעולות של אוטומציות (מסומנות ״מערכת״).</p>
      {rows.length === 0 ? <p className="text-sm text-muted">עדיין אין אירועים.</p> : (
        <ol className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
              <span><b>{EVENT_LABEL[r.event] ?? r.event}</b> · {r.profiles?.full_name ?? 'מערכת (אוטומציה)'}</span>
              <span className="text-xs text-muted">{fmtDate(r.created_at)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

function ToolsTab() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const calId = import.meta.env.VITE_GOOGLE_CALENDAR_ID as string | undefined
  const runSla = async () => {
    setBusy(true)
    const { data, error } = await supabase.rpc('run_sla_check')
    setBusy(false)
    if (error) toast('error', dbMessage(error)); else toast('success', data ? `${data} בקשות הוסלמו למנהלי האגפים` : 'אין בקשות בחריגת SLA כרגע')
  }
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
      <Card>
        <h2 className="text-lg font-bold">אוטומציות פעילות</h2>
        <ul className="mt-3 space-y-3 text-sm">
          <li className="rounded-xl bg-canvas p-3"><b>הסלמת SLA</b><br />Trigger: משימה מתוזמנת כל 5 דקות · Action: בקשה שעברה את זמן ה-SLA מוסלמת למנהל/ת האגף + התראה + Audit.</li>
          <li className="rounded-xl bg-canvas p-3"><b>Kill switch</b><br />Trigger: סטטוס סוכן משתנה ל״מושעה״ · Action: הקפאת בקשות, פתיחת תקרית, התראות, Audit — ואז סיכום AI ואירוע ב-Google Calendar.</li>
        </ul>
        <Button variant="secondary" className="mt-4" onClick={runSla} loading={busy}><Clock aria-hidden className="h-4 w-4" />הרצת בדיקת SLA עכשיו</Button>
      </Card>
      <Card>
        <h2 className="mb-3 text-lg font-bold">יומן תחקירים · Google Calendar</h2>
        {calId ? (
          <iframe title="יומן תחקירי סוכנים ב-Google Calendar" className="h-[420px] w-full rounded-xl border border-line"
            src={`https://calendar.google.com/calendar/embed?src=${encodeURIComponent(calId)}&ctz=Asia%2FJerusalem&hl=iw&mode=AGENDA&showPrint=0`} />
        ) : <p className="text-sm text-muted">היומן יוצג כאן אחרי הגדרת VITE_GOOGLE_CALENDAR_ID.</p>}
      </Card>
    </div>
  )
}
