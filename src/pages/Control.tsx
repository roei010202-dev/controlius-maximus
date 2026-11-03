import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, Plus, ShieldAlert } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { AUTONOMY, PROCESS_STATUS } from '../lib/labels'
import type { AgentAction, ApprovalRequest, Process } from '../lib/types'
import { Badge, Button, Card, EmptyState, PageHeader, Spinner, Stat } from '../components/ui'
import AgentSimulator from '../components/AgentSimulator'
import KillSwitch from '../components/KillSwitch'

type A = Pick<AgentAction, 'process_id' | 'decision' | 'status' | 'created_at'>
type R = Pick<ApprovalRequest, 'status' | 'created_at' | 'decided_at'>

export default function Control() {
  const { profile, divisions } = useAuth()
  const [procs, setProcs] = useState<Process[] | null>(null)
  const [actions, setActions] = useState<A[]>([])
  const [reqs, setReqs] = useState<R[]>([])
  const [openIncidents, setOpenIncidents] = useState(0)

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 7 * 864e5).toISOString()
    const [p, a, r, i] = await Promise.all([
      supabase.from('processes').select('*').neq('status', 'archived').order('created_at'),
      supabase.from('agent_actions').select('process_id, decision, status, created_at').gte('created_at', since),
      supabase.from('approval_requests').select('status, created_at, decided_at').gte('created_at', since),
      supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    ])
    setProcs((p.data as Process[]) ?? []); setActions((a.data as A[]) ?? []); setReqs((r.data as R[]) ?? []); setOpenIncidents(i.count ?? 0)
  }, [])
  useEffect(() => { load() }, [load])

  const kpi = useMemo(() => {
    const total = actions.length
    const auto = actions.filter((x) => x.decision === 'auto_executed').length
    const waiting = reqs.filter((x) => x.status === 'pending' || x.status === 'escalated').length
    const escalated = reqs.filter((x) => x.status === 'escalated').length
    const decided = reqs.filter((x) => x.decided_at)
    const avg = decided.length ? Math.round(decided.reduce((s, x) => s + (+new Date(x.decided_at!) - +new Date(x.created_at)), 0) / decided.length / 60000) : null
    return { total, autoPct: total ? Math.round((auto / total) * 100) : 0, waiting, escalated, avg, blocked: actions.filter((x) => x.decision === 'blocked').length }
  }, [actions, reqs])

  if (!procs) return <Spinner />
  const scope = profile?.role === 'governance' ? 'כל הארגון' : divisions.find((d) => d.id === profile?.division_id)?.name

  return (
    <>
      <PageHeader title="מגדל הבקרה" subtitle={`תמונת מצב של סוכני ה-AI · ${scope ?? ''} · 7 ימים אחרונים`}
        actions={<Link to="/agents/new"><Button><Plus aria-hidden className="h-4 w-4" />סוכן/תהליך חדש</Button></Link>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="פעולות סוכנים" value={kpi.total} />
        <Stat label="בוצעו אוטומטית" value={`${kpi.autoPct}%`} tone="ok" hint="בתוך הגבולות, בלי אדם" />
        <Stat label="ממתינות לאדם" value={kpi.waiting} tone={kpi.waiting ? 'warn' : undefined} hint={kpi.escalated ? `${kpi.escalated} בחריגת SLA` : 'אין חריגות SLA'} />
        <Stat label="זמן החלטה ממוצע" value={kpi.avg == null ? '—' : `${kpi.avg} דק׳`} />
        <Stat label="תקריות פתוחות" value={openIncidents} tone={openIncidents ? 'danger' : undefined} hint={`${kpi.blocked} פעולות נחסמו`} />
      </div>

      <h2 className="mb-3 mt-8 text-lg font-bold">הסוכנים</h2>
      {procs.length === 0 ? (
        <EmptyState icon={<Bot className="h-6 w-6" />} title="עדיין אין סוכנים באגף"
          text="התחילו מהגדרת תהליך אחד שרוצים להאציל ל-AI: רמת אוטונומיה + כלל סכום אחד מספיקים להתחלה."
          action={<Link to="/agents/new"><Button><Plus aria-hidden className="h-4 w-4" />הגדרת סוכן ראשון</Button></Link>} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {procs.map((p) => {
            const a = actions.filter((x) => x.process_id === p.id)
            const parts = [
              { n: a.filter((x) => x.decision === 'auto_executed').length, c: 'bg-ok', l: 'אוטומטי' },
              { n: a.filter((x) => x.decision === 'needs_human').length, c: 'bg-signal', l: 'לאדם' },
              { n: a.filter((x) => x.decision === 'blocked').length, c: 'bg-danger', l: 'נחסם' },
            ]
            return (
              <li key={p.id}>
                <Card as="article" className={p.status === 'suspended' ? 'border-danger/60' : ''}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link to={`/agents/${p.id}`} className="font-bold hover:text-brand hover:underline">{p.name}</Link>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge tone={PROCESS_STATUS[p.status].tone}>{PROCESS_STATUS[p.status].label}</Badge>
                        <Badge tone="info">{AUTONOMY[p.autonomy_level].label}</Badge>
                        {profile?.role === 'governance' && <Badge>{divisions.find((d) => d.id === p.division_id)?.name}</Badge>}
                      </div>
                    </div>
                    {p.status === 'active' && <KillSwitch compact processId={p.id} processName={p.name} onDone={load} />}
                    {p.status === 'suspended' && <Link to="/incidents" className="flex items-center gap-1 text-xs font-semibold text-danger hover:underline"><ShieldAlert aria-hidden className="h-4 w-4" />לתקרית</Link>}
                  </div>
                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-xs text-muted"><span>החלטות ב-7 ימים</span><span className="num">{a.length}</span></div>
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-line" aria-hidden>
                      {parts.map((x) => x.n > 0 && <div key={x.l} className={x.c} style={{ width: `${(x.n / a.length) * 100}%` }} />)}
                    </div>
                    <p className="mt-1.5 text-xs text-muted">{parts.map((x) => `${x.l}: ${x.n}`).join(' · ')}</p>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-8"><AgentSimulator processes={procs} onRun={load} /></div>
    </>
  )
}
