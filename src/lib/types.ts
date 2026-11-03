export type Role = 'approver' | 'division_manager' | 'governance'
export type Autonomy = 'advisory' | 'propose' | 'execute_with_approval' | 'supervised_autonomous'
export type ProcessStatus = 'draft' | 'active' | 'suspended' | 'archived'
export type ActionType = 'compensation' | 'refund' | 'reply' | 'account_update' | 'account_delete'

export interface Profile {
  id: string; email: string | null; full_name: string | null; role: Role
  division_id: string | null; team_id: string | null; onboarded: boolean; is_active: boolean
}
export interface Division { id: string; name: string }
export interface Team { id: string; division_id: string; name: string }

export interface Process {
  id: string; division_id: string; team_id: string | null; owner_id: string | null
  name: string; description: string; autonomy_level: Autonomy; status: ProcessStatus
  sla_minutes: number; created_at: string; updated_at: string
}

export interface Guardrail {
  id: string; process_id: string
  type: 'amount_threshold' | 'risk_threshold' | 'sentiment_escalation' | 'action_block'
  threshold_amount: number | null; max_risk_score: number | null; blocked_action: ActionType | null
  is_active: boolean
}

export interface GuardrailHit { type: Guardrail['type']; detail: string }

export interface AgentAction {
  id: string; process_id: string; division_id: string; team_id: string
  action_type: ActionType; customer_ref: string; customer_message: string; requested_amount: number
  ai_status: 'ok' | 'unavailable'; ai_risk_score: number | null; ai_risk_level: 'low' | 'medium' | 'high' | null
  ai_sentiment: 'positive' | 'neutral' | 'negative' | 'very_negative' | null; ai_reasoning: string | null
  guardrail_hits: GuardrailHit[]; decision: 'auto_executed' | 'needs_human' | 'blocked'
  status: 'pending' | 'executed' | 'rejected' | 'blocked' | 'frozen' | 'escalated'
  created_at: string
}

export interface ApprovalRequest {
  id: string; action_id: string; division_id: string; team_id: string; kind: 'approval' | 'recommendation'
  status: 'pending' | 'approved' | 'rejected' | 'escalated' | 'frozen'
  due_at: string; escalated_at: string | null; decided_by: string | null
  decision_note: string | null; decided_at: string | null; created_at: string
}

export interface Incident {
  id: string; process_id: string; division_id: string; opened_by: string | null; reason: string
  status: 'open' | 'resolved'; ai_summary: string | null; ai_status: 'pending' | 'ok' | 'unavailable'
  calendar_status: 'pending' | 'created' | 'failed'; calendar_event_link: string | null
  calendar_event_start: string | null; resolution_note: string | null; created_at: string; resolved_at: string | null
}

export interface Notification { id: string; title: string; body: string; link: string | null; is_read: boolean; created_at: string }
