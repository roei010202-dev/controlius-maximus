import { useCallback, useEffect, useState } from 'react'
import { Bot, CalendarCheck, CalendarX, ExternalLink, RotateCcw, ShieldCheck } from 'lucide-react'
import { callFunction, dbMessage, supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import type { Incident } from '../lib/types'
import { fmtDate } from '../lib/format'
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Spinner, Textarea } from '../components/ui'
import { useToast } from '../components/Toast'

type Row = Incident & { processes: { name: string } }

export default function Incidents() {
  const { profile } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [retrying, setRetrying] = useState<string | null>(null)
  const [reinstate, setReinstate] = useState<Row | null>(null)
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('incidents').select('*, processes(name)').order('created_at', { ascending: false })
    setRows((data as Row[]) ?? [])
  }, [])
  useEffect(() => { load() }, [load])

  const retry = async (id: string) => {
    setRetrying(id)
    try {
      const r = await callFunction<{ calendar_status: string; ai_status: string }>('incident', { action: 'retry', incident_id: id })
      toast(r.calendar_status === 'created' ? 'success' : 'error', r.calendar_status === 'created' ? 'פגישת התחקיר נוצרה ביומן' : 'היומן עדיין לא זמין. נסו שוב מאוחר יותר.')
    } catch (e) { toast('error', (e as Error).message) } finally { setRetrying(null); load() }
  }

  const doReinstate = async () => {
    if (!reinstate) return
    if (note.trim().length < 5) { setErr('חובה לתעד את מסקנות התחקיר (לפחות 5 תווים)'); return }
    setBusy(true)
    const { error } = await supabase.rpc('reinstate_process', { p_incident_id: reinstate.id, p_note: note.trim() })
    setBusy(false)
    if (error) { toast('error', dbMessage(error)); return }
    toast('success', 'הסוכן חזר לפעילות, והבקשות המוקפאות חזרו לתור עם SLA חדש')
    setReinstate(null); setNote(''); load()
  }

  return (
    <>
      <PageHeader title="תקריות" subtitle="כל הפעלת Kill switch פותחת תקרית: הקפאה, סיכום AI, פגישת תחקיר ביומן, והחלטת Governance על חזרה לפעילות." />
      {rows === null ? <Spinner /> : rows.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title="אין תקריות" text="מצוין. אם סוכן יתנהג באופן חריג — Kill switch במגדל הבקרה משעה אותו מיד ופותח תקרית כאן." />
      ) : (
        <ul className="grid gap-4">
          {rows.map((i) => (
            <li key={i.id}>
              <Card as="article" className={i.status === 'open' ? 'border-danger/50' : ''}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold">{i.processes.name}</h2>
                    <p className="text-xs text-muted">נפתחה {fmtDate(i.created_at)}{i.resolved_at ? ` · נסגרה ${fmtDate(i.resolved_at)}` : ''}</p>
                  </div>
                  <Badge tone={i.status === 'open' ? 'danger' : 'ok'}>{i.status === 'open' ? 'פתוחה — הסוכן מושעה' : 'נסגרה — הסוכן הוחזר'}</Badge>
                </div>
                <p className="mt-3 text-sm"><b>סיבת ההשעיה:</b> {i.reason}</p>

                <div className="mt-4 grid gap-3 md:grid-cols-[1.4fr_1fr]">
                  <div className="rounded-xl bg-canvas p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted"><Bot aria-hidden className="h-4 w-4" />סיכום תחקיר (AI)</div>
                    {i.ai_status === 'ok' && i.ai_summary ? <div className="whitespace-pre-line text-sm leading-relaxed">{i.ai_summary.replace(/\*\*/g, '')}</div>
                      : <p className="text-sm text-warn">{i.ai_status === 'pending' ? 'הסיכום בהכנה…' : 'שירות ה-AI לא היה זמין. אפשר לנסות שוב.'}</p>}
                  </div>
                  <div className="rounded-xl bg-canvas p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted">
                      {i.calendar_status === 'created' ? <CalendarCheck aria-hidden className="h-4 w-4" /> : <CalendarX aria-hidden className="h-4 w-4" />}פגישת תחקיר · Google Calendar
                    </div>
                    {i.calendar_status === 'created' ? (
                      <>
                        <p className="text-sm">נקבעה ל-{fmtDate(i.calendar_event_start)}</p>
                        {i.calendar_event_link && <a href={i.calendar_event_link} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">פתיחה ביומן<ExternalLink aria-hidden className="h-3.5 w-3.5" /><span className="sr-only">(נפתח בחלון חדש)</span></a>}
                      </>
                    ) : <p className="text-sm text-warn">{i.calendar_status === 'pending' ? 'ממתין ליצירה…' : 'יצירת האירוע נכשלה (השירות החיצוני לא הגיב).'}</p>}
                    {i.status === 'open' && (i.calendar_status !== 'created' || i.ai_status !== 'ok') && (
                      <Button variant="secondary" className="mt-2 min-h-[36px] text-xs" loading={retrying === i.id} onClick={() => retry(i.id)}><RotateCcw aria-hidden className="h-3.5 w-3.5" />ניסיון חוזר</Button>
                    )}
                  </div>
                </div>

                {i.resolution_note && <p className="mt-3 text-sm"><b>מסקנות התחקיר:</b> {i.resolution_note}</p>}
                {i.status === 'open' && (
                  <div className="mt-4 border-t border-line pt-4">
                    {profile?.role === 'governance'
                      ? <Button variant="signal" onClick={() => { setReinstate(i); setNote(''); setErr(null) }}><ShieldCheck aria-hidden className="h-4 w-4" />סגירת תחקיר והחזרת הסוכן לפעילות</Button>
                      : <p className="text-sm text-muted">החזרת הסוכן לפעילות דורשת החלטת Governance אחרי התחקיר.</p>}
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal open={Boolean(reinstate)} onClose={() => setReinstate(null)} title="החזרת הסוכן לפעילות"
        footer={<><Button variant="secondary" onClick={() => setReinstate(null)}>ביטול</Button><Button onClick={doReinstate} loading={busy}>אישור החזרה</Button></>}>
        <p className="mb-4 text-sm">הבקשות המוקפאות של <b>{reinstate?.processes.name}</b> יחזרו לתור האישורים עם SLA חדש.</p>
        <Field label="מסקנות התחקיר ומה תוקן" required error={err}>
          {({ id, describedBy, invalid }) => <Textarea id={id} rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid} />}
        </Field>
      </Modal>
    </>
  )
}
