import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock, Inbox, RefreshCw, Snowflake, XCircle } from 'lucide-react'
import { supabase, dbMessage } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { ACTION_TYPE, AUTONOMY, REQUEST_STATUS } from '../lib/labels'
import type { AgentAction, ApprovalRequest, Autonomy } from '../lib/types'
import { fmtDate, fmtMoney, minutesUntil, slaText, timeAgo } from '../lib/format'
import { Badge, Button, EmptyState, Field, Modal, PageHeader, Spinner, Textarea } from '../components/ui'
import ActionInsight from '../components/ActionInsight'
import { useToast } from '../components/Toast'

type Row = ApprovalRequest & { agent_actions: AgentAction & { processes: { name: string; autonomy_level: Autonomy } } }
type Tab = 'open' | 'frozen' | 'history'

export default function Approvals() {
  const { profile, teams } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [tab, setTab] = useState<Tab>('open')
  const [decide, setDecide] = useState<{ row: Row; decision: 'approved' | 'rejected' } | null>(null)
  const [note, setNote] = useState('')
  const [noteErr, setNoteErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('approval_requests')
      .select('*, agent_actions(*, processes(name, autonomy_level))')
      .order('created_at', { ascending: false }).limit(200)
    if (error) toast('error', dbMessage(error))
    setRows((data as Row[]) ?? [])
  }, [toast])
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t) }, [load])

  const lists = useMemo(() => {
    const r = rows ?? []
    const open = r.filter((x) => x.status === 'pending' || x.status === 'escalated')
      .sort((a, b) => (a.status === 'escalated' ? -1 : 0) - (b.status === 'escalated' ? -1 : 0) || +new Date(a.due_at) - +new Date(b.due_at))
    return { open, frozen: r.filter((x) => x.status === 'frozen'), history: r.filter((x) => x.status === 'approved' || x.status === 'rejected') }
  }, [rows])

  const submit = async () => {
    if (!decide) return
    if (decide.decision === 'rejected' && note.trim().length < 3) { setNoteErr('בדחייה חובה לכתוב נימוק (לפחות 3 תווים)'); return }
    if (note.length > 500) { setNoteErr('עד 500 תווים'); return }
    setBusy(true)
    const { error } = await supabase.rpc('decide_approval', { p_request_id: decide.row.id, p_decision: decide.decision, p_note: note.trim() || null })
    setBusy(false)
    if (error) { toast('error', dbMessage(error)); load(); setDecide(null); return }
    toast('success', decide.decision === 'approved' ? 'הבקשה אושרה והפעולה בוצעה' : 'הבקשה נדחתה. הסוכן לא יבצע את הפעולה')
    setDecide(null); setNote(''); load()
  }

  const teamName = teams.find((t) => t.id === profile?.team_id)?.name
  const tabs: { k: Tab; label: string; n: number }[] = [
    { k: 'open', label: 'ממתינות להחלטה', n: lists.open.length },
    { k: 'frozen', label: 'מוקפאות', n: lists.frozen.length },
    { k: 'history', label: 'היסטוריה', n: lists.history.length },
  ]
  const shown = lists[tab]

  return (
    <>
      <PageHeader title="תור אישורים"
        subtitle={profile?.role === 'approver' ? `בקשות של סוכני AI שעצרו וממתינות לך · ${teamName ?? ''}` : 'כל הבקשות בתחום האחריות שלך, כולל בקשות שהוסלמו בחריגת SLA'}
        actions={<Button variant="secondary" onClick={load}><RefreshCw aria-hidden className="h-4 w-4" />רענון</Button>} />

      <div role="tablist" aria-label="סינון בקשות" className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-card">
        {tabs.map((t) => (
          <button key={t.k} role="tab" aria-selected={tab === t.k} onClick={() => setTab(t.k)}
            className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-xs font-semibold sm:gap-2 sm:px-3 sm:text-sm ${tab === t.k ? 'bg-ink text-white' : 'text-muted hover:bg-canvas'}`}>
            {t.label}<span className={`num rounded-full px-2 text-xs ${tab === t.k ? 'bg-signal text-ink' : 'bg-canvas'}`}>{t.n}</span>
          </button>
        ))}
      </div>

      {rows === null ? <Spinner /> : shown.length === 0 ? (
        <EmptyState icon={tab === 'frozen' ? <Snowflake className="h-6 w-6" /> : <Inbox className="h-6 w-6" />}
          title={tab === 'open' ? 'אין בקשות שממתינות לך' : tab === 'frozen' ? 'אין בקשות מוקפאות' : 'עדיין אין החלטות'}
          text={tab === 'open' ? 'כשסוכן יחרוג מכלל (סכום, סיכון או סנטימנט) — הבקשה תופיע כאן ותקבל/י התראה.' : tab === 'frozen' ? 'בקשות מוקפאות כשסוכן מושעה ב-Kill switch, וחוזרות לתור אחרי שהסוכן מוחזר לפעילות.' : 'אחרי שתאשר/י או תדחה/י בקשה, היא תישמר כאן לתיעוד.'} />
      ) : (
        <ul className="grid gap-4">
          {shown.map((r) => {
            const a = r.agent_actions
            const overdue = minutesUntil(r.due_at) < 0
            return (
              <li key={r.id}>
                <article className={`rounded-2xl border bg-white p-4 shadow-card sm:p-5 ${r.status === 'escalated' ? 'border-danger/50' : 'border-line'}`} aria-labelledby={`t-${r.id}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 id={`t-${r.id}`} className="font-bold">{a.processes.name}</h2>
                      <p className="text-xs text-muted">{ACTION_TYPE[a.action_type]} · לקוח {a.customer_ref} · {timeAgo(r.created_at)} · רמת אוטונומיה: {AUTONOMY[a.processes.autonomy_level].label}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {r.kind === 'recommendation' && <Badge tone="info">המלצה לביצוע ידני</Badge>}
                      <Badge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <div><div className="text-xs text-muted">סכום מבוקש</div><div className="num text-xl font-bold">{fmtMoney(a.requested_amount)}</div></div>
                    {(r.status === 'pending' || r.status === 'escalated') && (
                      <div className={`flex items-center gap-1.5 text-sm font-semibold ${overdue ? 'text-danger' : 'text-muted'}`}>
                        <Clock aria-hidden className="h-4 w-4" />SLA: {slaText(r.due_at)}
                      </div>
                    )}
                  </div>
                  <blockquote className="mt-3 rounded-xl border-s-4 border-signal bg-signal-soft/50 px-3 py-2 text-sm">{a.customer_message}</blockquote>
                  <div className="mt-3"><ActionInsight a={a} /></div>

                  {(r.status === 'pending' || r.status === 'escalated') && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                      <Button onClick={() => { setDecide({ row: r, decision: 'approved' }); setNote(''); setNoteErr(null) }} className="flex-1 sm:flex-none">
                        <CheckCircle2 aria-hidden className="h-4 w-4" />{r.kind === 'recommendation' ? 'אישור וביצוע ידני' : 'אישור וביצוע'}
                      </Button>
                      <Button variant="secondary" onClick={() => { setDecide({ row: r, decision: 'rejected' }); setNote(''); setNoteErr(null) }} className="flex-1 sm:flex-none">
                        <XCircle aria-hidden className="h-4 w-4" />דחייה
                      </Button>
                    </div>
                  )}
                  {(r.status === 'approved' || r.status === 'rejected') && (
                    <p className="mt-3 text-sm text-muted">הוחלט ב-{fmtDate(r.decided_at)}{r.decision_note ? ` · נימוק: ${r.decision_note}` : ''}</p>
                  )}
                </article>
              </li>
            )
          })}
        </ul>
      )}

      <Modal open={Boolean(decide)} onClose={() => setDecide(null)}
        title={decide?.decision === 'approved' ? 'אישור הבקשה' : 'דחיית הבקשה'}
        footer={<>
          <Button variant="secondary" onClick={() => setDecide(null)}>ביטול</Button>
          <Button variant={decide?.decision === 'approved' ? 'primary' : 'danger'} loading={busy} onClick={submit}>
            {decide?.decision === 'approved' ? 'אישור סופי' : 'דחייה סופית'}
          </Button>
        </>}>
        {decide && (
          <>
            <p className="mb-4 text-sm">{decide.row.agent_actions.processes.name} · {fmtMoney(decide.row.agent_actions.requested_amount)} · לקוח {decide.row.agent_actions.customer_ref}</p>
            <Field label={decide.decision === 'rejected' ? 'נימוק הדחייה' : 'הערה (לא חובה)'} required={decide.decision === 'rejected'} error={noteErr}
              help="הנימוק נשמר ביומן הביקורת ונשלח לבעלי התהליך.">
              {({ id, describedBy, invalid }) => (
                <Textarea id={id} rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid} />
              )}
            </Field>
          </>
        )}
      </Modal>
    </>
  )
}
