import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Archive, ArrowRight, Plus, Power, Save, Trash2 } from 'lucide-react'
import { supabase, dbMessage } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { ACTION_STATUS, ACTION_TYPE, AUTONOMY, DECISION, GUARDRAIL_TYPE, PROCESS_STATUS } from '../lib/labels'
import type { ActionType, AgentAction, Autonomy, Guardrail, Process } from '../lib/types'
import { fmtDate, fmtMoney } from '../lib/format'
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Spinner, Textarea } from '../components/ui'
import KillSwitch from '../components/KillSwitch'
import { useToast } from '../components/Toast'

type Form = { name: string; description: string; autonomy_level: Autonomy; division_id: string; team_id: string; sla_minutes: string }

function validate(f: Form) {
  const e: Partial<Record<keyof Form, string>> = {}
  if (f.name.trim().length < 3 || f.name.trim().length > 80) e.name = 'שם: 3–80 תווים'
  if (f.description.length > 500) e.description = 'עד 500 תווים'
  if (!f.division_id) e.division_id = 'יש לבחור אגף'
  const sla = Number(f.sla_minutes)
  if (!Number.isInteger(sla) || sla < 5 || sla > 10080) e.sla_minutes = 'SLA בדקות: מספר שלם בין 5 ל-10,080 (שבוע)'
  return e
}

export default function AgentDetail() {
  const { id } = useParams()
  const isNew = id === 'new'
  const { profile, divisions, teams } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const isGov = profile?.role === 'governance'

  const [proc, setProc] = useState<Process | null>(null)
  const [rails, setRails] = useState<Guardrail[]>([])
  const [acts, setActs] = useState<AgentAction[]>([])
  const [f, setF] = useState<Form>({ name: '', description: '', autonomy_level: 'propose', division_id: profile?.division_id ?? '', team_id: '', sla_minutes: '60' })
  const [errs, setErrs] = useState<Partial<Record<keyof Form, string>>>({})
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(!isNew)
  const [railOpen, setRailOpen] = useState(false)

  const load = useCallback(async () => {
    if (isNew) return
    const [p, g, a] = await Promise.all([
      supabase.from('processes').select('*').eq('id', id!).maybeSingle(),
      supabase.from('guardrails').select('*').eq('process_id', id!).order('created_at'),
      supabase.from('agent_actions').select('*').eq('process_id', id!).order('created_at', { ascending: false }).limit(15),
    ])
    const pr = p.data as Process | null
    setProc(pr); setRails((g.data as Guardrail[]) ?? []); setActs((a.data as AgentAction[]) ?? []); setLoading(false)
    if (pr) setF({ name: pr.name, description: pr.description, autonomy_level: pr.autonomy_level, division_id: pr.division_id, team_id: pr.team_id ?? '', sla_minutes: String(pr.sla_minutes) })
  }, [id, isNew])
  useEffect(() => { load() }, [load])

  const save = async () => {
    const e = validate(f); setErrs(e)
    if (Object.keys(e).length) { toast('error', 'יש שדות שדורשים תיקון'); return }
    setBusy(true)
    const row = { name: f.name.trim(), description: f.description.trim(), autonomy_level: f.autonomy_level, team_id: f.team_id || null, sla_minutes: Number(f.sla_minutes) }
    const res = isNew
      ? await supabase.from('processes').insert({ ...row, division_id: f.division_id, owner_id: profile!.id }).select().single()
      : await supabase.from('processes').update(row).eq('id', id!).select().single()
    setBusy(false)
    if (res.error) { toast('error', dbMessage(res.error)); return }
    toast('success', isNew ? 'הסוכן נוצר כטיוטה. הוסיפו Guardrails והפעילו אותו.' : 'השינויים נשמרו')
    if (isNew) navigate(`/agents/${res.data.id}`, { replace: true }); else load()
  }

  const setStatus = async (status: Process['status']) => {
    if (status === 'active' && rails.filter((r) => r.is_active).length === 0 && proc?.autonomy_level !== 'advisory') {
      toast('error', 'אי אפשר להפעיל סוכן בלי Guardrail פעיל אחד לפחות')
      return
    }
    const { error } = await supabase.from('processes').update({ status }).eq('id', id!)
    if (error) toast('error', dbMessage(error)); else { toast('success', `הסטטוס עודכן: ${PROCESS_STATUS[status].label}`); load() }
  }

  if (loading) return <Spinner />
  if (!isNew && !proc) return <p className="py-10 text-center text-muted">הסוכן לא נמצא, או שאינו בתחום ההרשאות שלך.</p>

  const divTeams = teams.filter((t) => t.division_id === f.division_id)
  const editable = isNew || (proc!.status !== 'archived')

  return (
    <>
      <Link to="/control" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"><ArrowRight aria-hidden className="h-4 w-4" />חזרה למגדל הבקרה</Link>
      <PageHeader title={isNew ? 'סוכן / תהליך חדש' : proc!.name}
        subtitle={isNew ? 'מגדירים מה הסוכן עושה, כמה חופש יש לו, ומתי הוא חייב לעצור.' : `נוצר ${fmtDate(proc!.created_at)} · עודכן ${fmtDate(proc!.updated_at)}`}
        actions={!isNew && <>
          <Badge tone={PROCESS_STATUS[proc!.status].tone}>{PROCESS_STATUS[proc!.status].label}</Badge>
          {proc!.status === 'active' && <KillSwitch processId={proc!.id} processName={proc!.name} onDone={load} />}
          {proc!.status === 'draft' && <Button variant="signal" onClick={() => setStatus('active')}><Power aria-hidden className="h-4 w-4" />הפעלת הסוכן</Button>}
          {(proc!.status === 'draft' || proc!.status === 'active') && <Button variant="secondary" onClick={() => setStatus('archived')}><Archive aria-hidden className="h-4 w-4" />העברה לארכיון</Button>}
          {proc!.status === 'archived' && <Button variant="secondary" onClick={() => setStatus('draft')}>שחזור כטיוטה</Button>}
        </>} />

      {proc?.status === 'suspended' && (
        <div role="alert" className="mb-4 rounded-2xl border border-danger/40 bg-danger-soft p-4 text-sm text-danger">
          הסוכן מושעה (Kill switch). הוא לא יבצע פעולות, והבקשות שלו מוקפאות. <Link to="/incidents" className="font-bold underline">למסך התקרית</Link>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card aria-labelledby="def-title">
          <h2 id="def-title" className="mb-4 text-lg font-bold">הגדרות</h2>
          <fieldset disabled={!editable} className="grid gap-4">
            <Field label="שם התהליך" required error={errs.name}>
              {({ id, describedBy, invalid }) => <Input id={id} value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} aria-describedby={describedBy} aria-invalid={invalid} />}
            </Field>
            <Field label="תיאור — מה הסוכן עושה" error={errs.description} help="התיאור נשלח ל-AI כהקשר להערכת הסיכון.">
              {({ id, describedBy, invalid }) => <Textarea id={id} rows={3} maxLength={500} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} aria-describedby={describedBy} aria-invalid={invalid} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="אגף" required error={errs.division_id}>
                {({ id, describedBy, invalid }) => (
                  <Select id={id} value={f.division_id} disabled={!isNew || !isGov} onChange={(e) => setF({ ...f, division_id: e.target.value, team_id: '' })} aria-describedby={describedBy} aria-invalid={invalid}>
                    <option value="">בחר/י…</option>
                    {divisions.filter((d) => isGov || d.id === profile?.division_id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="צוות מטפל" help="ריק = כל צוותי האגף (הבקשות יגיעו לצוות הראשון)">
                {({ id }) => (
                  <Select id={id} value={f.team_id} onChange={(e) => setF({ ...f, team_id: e.target.value })}>
                    <option value="">כל הצוותים</option>
                    {divTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                )}
              </Field>
            </div>
            <Field label="SLA לאישור (דקות)" required error={errs.sla_minutes} help="בקשה שלא טופלה בזמן מוסלמת אוטומטית למנהל/ת האגף.">
              {({ id, describedBy, invalid }) => <Input id={id} type="number" min={5} max={10080} step={1} value={f.sla_minutes} onChange={(e) => setF({ ...f, sla_minutes: e.target.value })} aria-describedby={describedBy} aria-invalid={invalid} />}
            </Field>

            <fieldset>
              <legend className="mb-2 text-sm font-semibold">רמת אוטונומיה <span className="text-danger" aria-hidden>*</span></legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(AUTONOMY) as Autonomy[]).map((k) => {
                  const locked = k === 'supervised_autonomous' && !isGov && f.autonomy_level !== k
                  return (
                    <label key={k} className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${f.autonomy_level === k ? 'border-brand bg-brand-soft' : 'border-line'} ${locked ? 'cursor-not-allowed opacity-60' : ''}`}>
                      <input type="radio" name="autonomy" value={k} checked={f.autonomy_level === k} disabled={locked}
                        onChange={() => setF({ ...f, autonomy_level: k })} className="mt-1 h-4 w-4 accent-brand" />
                      <span>
                        <span className="block text-sm font-bold">{AUTONOMY[k].step}. {AUTONOMY[k].label}{locked && ' 🔒'}</span>
                        <span className="block text-xs text-muted">{AUTONOMY[k].desc}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          </fieldset>
          {editable && <div className="mt-5 flex justify-end"><Button onClick={save} loading={busy}><Save aria-hidden className="h-4 w-4" />{isNew ? 'יצירת הסוכן' : 'שמירה'}</Button></div>}
        </Card>

        {!isNew && (
          <div className="grid content-start gap-5">
            <Card aria-labelledby="rails-title">
              <div className="mb-3 flex items-center justify-between">
                <h2 id="rails-title" className="text-lg font-bold">Guardrails</h2>
                {editable && <Button variant="ghost" onClick={() => setRailOpen(true)}><Plus aria-hidden className="h-4 w-4" />כלל חדש</Button>}
              </div>
              {rails.length === 0 ? <p className="text-sm text-muted">אין כללים. בלי Guardrails הסוכן לא ייעצר — הוסיפו לפחות כלל אחד לפני הפעלה.</p> : (
                <ul className="divide-y divide-line">
                  {rails.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 py-2.5">
                      <div>
                        <div className="text-sm font-semibold">{GUARDRAIL_TYPE[r.type].label}</div>
                        <div className="text-xs text-muted">
                          {r.type === 'amount_threshold' && `מעל ${fmtMoney(r.threshold_amount)}`}
                          {r.type === 'risk_threshold' && `ציון סיכון מעל ${r.max_risk_score}`}
                          {r.type === 'sentiment_escalation' && 'סנטימנט קיצוני ← אדם'}
                          {r.type === 'action_block' && `חסום: ${ACTION_TYPE[r.blocked_action!]}`}
                        </div>
                      </div>
                      {editable && (
                        <div className="flex items-center gap-1">
                          <label className="flex items-center gap-1.5 text-xs">
                            <input type="checkbox" checked={r.is_active} className="h-4 w-4 accent-brand"
                              onChange={async () => { const { error } = await supabase.from('guardrails').update({ is_active: !r.is_active }).eq('id', r.id); if (error) toast('error', dbMessage(error)); load() }} />
                            פעיל
                          </label>
                          <button aria-label={`מחיקת הכלל ${GUARDRAIL_TYPE[r.type].label}`} className="rounded-lg p-2 text-danger hover:bg-danger-soft"
                            onClick={async () => { if (!confirm('למחוק את הכלל?')) return; const { error } = await supabase.from('guardrails').delete().eq('id', r.id); if (error) toast('error', dbMessage(error)); else toast('success', 'הכלל נמחק'); load() }}>
                            <Trash2 aria-hidden className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card aria-labelledby="acts-title">
              <h2 id="acts-title" className="mb-3 text-lg font-bold">פעולות אחרונות</h2>
              {acts.length === 0 ? <p className="text-sm text-muted">הסוכן עדיין לא ביצע פעולות. הריצו פנייה מדומה במגדל הבקרה.</p> : (
                <ul className="divide-y divide-line">
                  {acts.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className="text-sm">{ACTION_TYPE[a.action_type]} · <span className="num">{fmtMoney(a.requested_amount)}</span> · <span className="text-muted">{fmtDate(a.created_at)}</span></span>
                      <span className="flex gap-1"><Badge tone={DECISION[a.decision].tone}>{DECISION[a.decision].label}</Badge><Badge tone={ACTION_STATUS[a.status].tone}>{ACTION_STATUS[a.status].label}</Badge></span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </div>

      {!isNew && <GuardrailModal open={railOpen} onClose={() => setRailOpen(false)} processId={id!} onSaved={load} />}
    </>
  )
}

function GuardrailModal({ open, onClose, processId, onSaved }: { open: boolean; onClose: () => void; processId: string; onSaved: () => void }) {
  const toast = useToast()
  const [type, setType] = useState<Guardrail['type']>('amount_threshold')
  const [val, setVal] = useState('50')
  const [action, setAction] = useState<ActionType>('account_delete')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const row: Partial<Guardrail> = { process_id: processId, type }
    if (type === 'amount_threshold') {
      const n = Number(val)
      if (val.trim() === '' || !Number.isFinite(n) || n < 0 || n > 100000) { setErr('סכום בין 0 ל-100,000 ₪'); return }
      row.threshold_amount = n
    }
    if (type === 'risk_threshold') {
      const n = Number(val)
      if (!Number.isInteger(n) || n < 0 || n > 100) { setErr('ציון שלם בין 0 ל-100'); return }
      row.max_risk_score = n
    }
    if (type === 'action_block') row.blocked_action = action
    setErr(null); setBusy(true)
    const { error } = await supabase.from('guardrails').insert(row)
    setBusy(false)
    if (error) { toast('error', dbMessage(error)); return }
    toast('success', 'הכלל נוסף'); onSaved(); onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Guardrail חדש"
      footer={<><Button variant="secondary" onClick={onClose}>ביטול</Button><Button onClick={save} loading={busy}>הוספה</Button></>}>
      <div className="grid gap-4">
        <Field label="סוג הכלל" required help={GUARDRAIL_TYPE[type].help}>
          {({ id, describedBy }) => (
            <Select id={id} value={type} aria-describedby={describedBy} onChange={(e) => { const t = e.target.value as Guardrail['type']; setType(t); setVal(t === 'risk_threshold' ? '70' : '50'); setErr(null) }}>
              {(Object.keys(GUARDRAIL_TYPE) as Guardrail['type'][]).map((k) => <option key={k} value={k}>{GUARDRAIL_TYPE[k].label}</option>)}
            </Select>
          )}
        </Field>
        {(type === 'amount_threshold' || type === 'risk_threshold') && (
          <Field label={type === 'amount_threshold' ? 'סף סכום (₪)' : 'ציון סיכון מקסימלי (0–100)'} required error={err}>
            {({ id, describedBy, invalid }) => <Input id={id} type="number" min={0} max={type === 'risk_threshold' ? 100 : 100000} value={val} onChange={(e) => setVal(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid} />}
          </Field>
        )}
        {type === 'action_block' && (
          <Field label="פעולה חסומה" required>
            {({ id }) => <Select id={id} value={action} onChange={(e) => setAction(e.target.value as ActionType)}>{(Object.keys(ACTION_TYPE) as ActionType[]).map((k) => <option key={k} value={k}>{ACTION_TYPE[k]}</option>)}</Select>}
          </Field>
        )}
      </div>
    </Modal>
  )
}
