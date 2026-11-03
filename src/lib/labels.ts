import type { ActionType, AgentAction, ApprovalRequest, Autonomy, Guardrail, ProcessStatus, Role } from './types'

export const ROLE_LABEL: Record<Role, string> = {
  approver: 'מאשר/ת (ראש צוות)',
  division_manager: 'מנהל/ת אגף',
  governance: 'Governance',
}

export const AUTONOMY: Record<Autonomy, { label: string; short: string; desc: string; step: number }> = {
  advisory: { label: 'מייעץ', short: 'מייעץ', step: 1, desc: 'הסוכן ממליץ; אדם מחליט ומבצע. כל בקשה מגיעה לאדם כהמלצה.' },
  propose: { label: 'מציע פעולה', short: 'מציע', step: 2, desc: 'הסוכן מציע פעולה; כל פעולה ממתינה לאישור לפני ביצוע.' },
  execute_with_approval: { label: 'מבצע עם אישור', short: 'מבצע+אישור', step: 3, desc: 'מבצע לבד כשאין חריגה; כל חריגה מכלל עוברת לאישור אנושי.' },
  supervised_autonomous: { label: 'אוטונומי מבוקר', short: 'אוטונומי', step: 4, desc: 'מבצע לבד גם מעל סף סכום (ומדווח למנהל); מסלים רק סיכון גבוה או סנטימנט קיצוני. ניתן ע״י Governance בלבד.' },
}

export const PROCESS_STATUS: Record<ProcessStatus, { label: string; tone: Tone }> = {
  draft: { label: 'טיוטה', tone: 'neutral' },
  active: { label: 'פעיל', tone: 'ok' },
  suspended: { label: 'מושעה', tone: 'danger' },
  archived: { label: 'בארכיון', tone: 'neutral' },
}

export const ACTION_TYPE: Record<ActionType, string> = {
  compensation: 'פיצוי ללקוח',
  refund: 'החזר כספי',
  reply: 'מענה ללקוח',
  account_update: 'עדכון פרטי חשבון',
  account_delete: 'מחיקת חשבון',
}

export const DECISION: Record<AgentAction['decision'], { label: string; tone: Tone }> = {
  auto_executed: { label: 'בוצע אוטומטית', tone: 'ok' },
  needs_human: { label: 'הועבר לאדם', tone: 'warn' },
  blocked: { label: 'נחסם', tone: 'danger' },
}

export const ACTION_STATUS: Record<AgentAction['status'], { label: string; tone: Tone }> = {
  pending: { label: 'ממתין', tone: 'warn' },
  executed: { label: 'בוצע', tone: 'ok' },
  rejected: { label: 'נדחה', tone: 'danger' },
  blocked: { label: 'נחסם', tone: 'danger' },
  frozen: { label: 'מוקפא', tone: 'info' },
  escalated: { label: 'הוסלם', tone: 'warn' },
}

export const REQUEST_STATUS: Record<ApprovalRequest['status'], { label: string; tone: Tone }> = {
  pending: { label: 'ממתין לאישור', tone: 'warn' },
  approved: { label: 'אושר', tone: 'ok' },
  rejected: { label: 'נדחה', tone: 'danger' },
  escalated: { label: 'הוסלם (חריגת SLA)', tone: 'danger' },
  frozen: { label: 'מוקפא (סוכן מושעה)', tone: 'info' },
}

export const GUARDRAIL_TYPE: Record<Guardrail['type'], { label: string; help: string }> = {
  amount_threshold: { label: 'סף סכום', help: 'מעל הסכום הזה הפעולה נחשבת חריגה.' },
  risk_threshold: { label: 'סף סיכון AI', help: 'ציון סיכון (0–100) שמעליו חובה אדם. אם ה-AI לא זמין — תמיד אדם.' },
  sentiment_escalation: { label: 'הסלמת סנטימנט', help: 'לקוח בסערת רגשות (סנטימנט קיצוני) מועבר תמיד לאדם.' },
  action_block: { label: 'חסימת פעולה', help: 'הסוכן אינו רשאי לבצע את סוג הפעולה הזה בשום מצב.' },
}

export const SENTIMENT: Record<NonNullable<AgentAction['ai_sentiment']>, string> = {
  positive: 'חיובי', neutral: 'ניטרלי', negative: 'שלילי', very_negative: 'קיצוני',
}

export const RISK_LEVEL: Record<NonNullable<AgentAction['ai_risk_level']>, { label: string; tone: Tone }> = {
  low: { label: 'סיכון נמוך', tone: 'ok' },
  medium: { label: 'סיכון בינוני', tone: 'warn' },
  high: { label: 'סיכון גבוה', tone: 'danger' },
}

export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral'
