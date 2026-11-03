import { useEffect, useMemo, useState } from 'react'
import { ScrollText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ACTION_STATUS, ACTION_TYPE, DECISION } from '../lib/labels'
import type { AgentAction } from '../lib/types'
import { fmtDate, fmtMoney } from '../lib/format'
import { Badge, EmptyState, Input, Modal, PageHeader, Select, Spinner } from '../components/ui'
import ActionInsight from '../components/ActionInsight'

type Row = AgentAction & { processes: { name: string } }

export default function ActionLog() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [q, setQ] = useState('')
  const [proc, setProc] = useState('')
  const [dec, setDec] = useState('')
  const [open, setOpen] = useState<Row | null>(null)

  useEffect(() => {
    supabase.from('agent_actions').select('*, processes(name)').order('created_at', { ascending: false }).limit(300)
      .then(({ data }) => setRows((data as Row[]) ?? []))
  }, [])

  const procs = useMemo(() => Array.from(new Map((rows ?? []).map((r) => [r.process_id, r.processes.name]))), [rows])
  const shown = (rows ?? []).filter((r) => (!proc || r.process_id === proc) && (!dec || r.decision === dec)
    && (!q || r.customer_ref.toLowerCase().includes(q.toLowerCase()) || r.customer_message.includes(q)))

  return (
    <>
      <PageHeader title="יומן פעולות" subtitle="כל פעולה שסוכן ביקש לבצע: מה ה-AI העריך, איזה כלל הופעל ומה הוחלט. רשומה אינה ניתנת לעריכה — זה התיעוד לביקורת." />
      <div className="mb-4 grid gap-2 rounded-2xl bg-white p-3 shadow-card sm:grid-cols-3">
        <label className="sr-only" htmlFor="log-q">חיפוש</label>
        <Input id="log-q" placeholder="חיפוש לפי מזהה לקוח או תוכן…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="sr-only" htmlFor="log-p">סוכן</label>
        <Select id="log-p" value={proc} onChange={(e) => setProc(e.target.value)}><option value="">כל הסוכנים</option>{procs.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</Select>
        <label className="sr-only" htmlFor="log-d">החלטה</label>
        <Select id="log-d" value={dec} onChange={(e) => setDec(e.target.value)}><option value="">כל ההחלטות</option>{Object.entries(DECISION).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
      </div>

      {rows === null ? <Spinner /> : shown.length === 0 ? (
        <EmptyState icon={<ScrollText className="h-6 w-6" />} title="אין פעולות להצגה" text="שנו את הסינון, או הריצו פנייה מדומה במגדל הבקרה." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          <table className="w-full text-sm">
            <caption className="sr-only">יומן פעולות סוכנים, {shown.length} רשומות</caption>
            <thead className="hidden bg-canvas text-right text-xs text-muted md:table-header-group">
              <tr><th scope="col" className="p-3">זמן</th><th scope="col" className="p-3">סוכן</th><th scope="col" className="p-3">פעולה</th><th scope="col" className="p-3">סכום</th><th scope="col" className="p-3">סיכון AI</th><th scope="col" className="p-3">החלטה</th><th scope="col" className="p-3">סטטוס</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((r) => (
                <tr key={r.id} className="grid grid-cols-2 gap-1 p-3 hover:bg-canvas md:table-row md:p-0">
                  <td className="text-xs text-muted md:p-3 md:text-sm">{fmtDate(r.created_at)}</td>
                  <td className="col-span-2 font-semibold md:p-3"><button className="text-right hover:text-brand hover:underline" onClick={() => setOpen(r)}>{r.processes.name}</button><div className="text-xs font-normal text-muted">{r.customer_ref}</div></td>
                  <td className="md:p-3">{ACTION_TYPE[r.action_type]}</td>
                  <td className="num md:p-3">{fmtMoney(r.requested_amount)}</td>
                  <td className="num md:p-3">{r.ai_status === 'ok' ? r.ai_risk_score : <span className="text-warn">AI לא זמין</span>}</td>
                  <td className="md:p-3"><Badge tone={DECISION[r.decision].tone}>{DECISION[r.decision].label}</Badge></td>
                  <td className="md:p-3"><Badge tone={ACTION_STATUS[r.status].tone}>{ACTION_STATUS[r.status].label}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={open ? `${open.processes.name} · ${open.customer_ref}` : ''}>
        {open && (
          <div className="grid gap-3">
            <p className="text-sm text-muted">{ACTION_TYPE[open.action_type]} · {fmtMoney(open.requested_amount)} · {fmtDate(open.created_at)}</p>
            <blockquote className="rounded-xl border-s-4 border-signal bg-signal-soft/50 px-3 py-2 text-sm">{open.customer_message}</blockquote>
            <ActionInsight a={open} />
          </div>
        )}
      </Modal>
    </>
  )
}
