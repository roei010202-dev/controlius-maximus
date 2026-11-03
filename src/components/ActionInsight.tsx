import { Bot, CircleAlert, ShieldCheck } from 'lucide-react'
import { GUARDRAIL_TYPE, RISK_LEVEL, SENTIMENT } from '../lib/labels'
import type { AgentAction } from '../lib/types'
import { Badge } from './ui'

/** The AI assessment + guardrails that explain WHY the agent was stopped or allowed. */
export default function ActionInsight({ a }: { a: AgentAction }) {
  const score = a.ai_risk_score ?? 0
  const bar = score >= 70 ? 'bg-danger' : score >= 40 ? 'bg-[#dc6803]' : 'bg-ok'
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl bg-canvas p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted"><Bot aria-hidden className="h-4 w-4" />הערכת AI</div>
        {a.ai_status === 'ok' && a.ai_risk_level ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={RISK_LEVEL[a.ai_risk_level].tone}>{RISK_LEVEL[a.ai_risk_level].label}</Badge>
              {a.ai_sentiment && <Badge tone={a.ai_sentiment === 'very_negative' ? 'danger' : 'neutral'}>סנטימנט: {SENTIMENT[a.ai_sentiment]}</Badge>}
            </div>
            <div className="mt-2 flex items-center gap-2" aria-label={`ציון סיכון ${score} מתוך 100`}>
              <div aria-hidden className="h-2 flex-1 overflow-hidden rounded-full bg-line"><div className={`h-full ${bar}`} style={{ width: `${score}%` }} /></div>
              <span className="num text-sm font-bold">{score}</span>
            </div>
            {a.ai_reasoning && <p className="mt-2 text-sm">{a.ai_reasoning}</p>}
          </>
        ) : (
          <p className="flex items-start gap-1.5 text-sm text-warn"><CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />שירות ה-AI לא היה זמין. ההחלטה התקבלה לפי הכללים בלבד, במצב בטוח (Fail-safe).</p>
        )}
      </div>
      <div className="rounded-xl bg-canvas p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted"><ShieldCheck aria-hidden className="h-4 w-4" />Guardrails שהופעלו</div>
        {a.guardrail_hits?.length ? (
          <ul className="space-y-1.5">
            {a.guardrail_hits.map((h, i) => (
              <li key={i} className="text-sm"><span className="font-semibold">{GUARDRAIL_TYPE[h.type]?.label ?? h.type}:</span> {h.detail}</li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">אף כלל לא הופעל — הפעולה בתוך הגבולות.</p>}
      </div>
    </div>
  )
}
