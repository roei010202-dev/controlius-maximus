-- =====================================================================
-- C.M — demo data (fictional only; no real people, customers or secrets)
-- Run after 0001_schema.sql.
-- =====================================================================

insert into public.divisions (id, name, created_at) values
  ('d0000000-0000-0000-0000-000000000001', 'אגף שירות לקוחות', now() - interval '60 days'),
  ('d0000000-0000-0000-0000-000000000002', 'אגף כספים', now() - interval '59 days');

insert into public.teams (id, division_id, name, created_at) values
  ('70000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'צוות שירות א׳', now() - interval '60 days'),
  ('70000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'צוות שירות ב׳', now() - interval '59 days'),
  ('70000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', 'צוות גבייה', now() - interval '58 days');

insert into public.processes (id, division_id, team_id, name, description, autonomy_level, status, sla_minutes, created_at) values
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', null,
   'מענה ראשוני לתלונת לקוח',
   'הסוכן קורא תלונה, מנסח מענה ומציע פיצוי. פיצוי עד 50 ₪ מבוצע לבד; מעל זה, או מול לקוח בסערת רגשות, עובר לאישור ראש צוות.',
   'execute_with_approval', 'active', 30, now() - interval '40 days'),
  ('a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', null,
   'החזר כספי על חיוב כפול',
   'הסוכן מזהה חיוב כפול ומציע החזר. כל החזר מחייב אישור אנושי.',
   'propose', 'active', 120, now() - interval '35 days'),
  ('a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002',
   'עדכון פרטי התקשרות',
   'הסוכן מעדכן פרטי התקשרות לבד ומסלים רק מקרים חריגים. מחיקת חשבון חסומה לחלוטין.',
   'supervised_autonomous', 'active', 60, now() - interval '20 days'),
  ('a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', null,
   'ניסוח תשובות לשאלות כלליות',
   'בשלב פיילוט: הסוכן רק ממליץ על נוסח, והנציג שולח בעצמו.',
   'advisory', 'draft', 240, now() - interval '5 days');

insert into public.guardrails (process_id, type, threshold_amount, max_risk_score, blocked_action) values
  ('a0000000-0000-0000-0000-000000000001', 'amount_threshold', 50, null, null),
  ('a0000000-0000-0000-0000-000000000001', 'sentiment_escalation', null, null, null),
  ('a0000000-0000-0000-0000-000000000001', 'risk_threshold', null, 70, null),
  ('a0000000-0000-0000-0000-000000000002', 'amount_threshold', 0, null, null),
  ('a0000000-0000-0000-0000-000000000002', 'risk_threshold', null, 60, null),
  ('a0000000-0000-0000-0000-000000000003', 'action_block', null, null, 'account_delete'),
  ('a0000000-0000-0000-0000-000000000003', 'amount_threshold', 0, null, null),
  ('a0000000-0000-0000-0000-000000000003', 'risk_threshold', null, 80, null);

-- Historic activity so dashboards are not empty. AI fields here are
-- pre-filled demo values; new activity is assessed live by Gemini.
with src(n, proc, team, atype, cref, msg, amt, risk, lvl, sent, reason, decision, status, ago) as (values
  (1, 'a0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'compensation', 'CUS-1043',
   'ההזמנה הגיעה באיחור של יומיים, אשמח לפיצוי קטן.', 30, 18, 'low', 'negative',
   'בקשה סבירה, סכום נמוך, טון רגוע.', 'auto_executed', 'executed', '9 days'),
  (2, 'a0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'compensation', 'CUS-1077',
   'שלוש פעמים ניסיתי להשיג אתכם! זה פשוט חוצפה, אני עוזב ומפרסם ברשתות.', 200, 82, 'high', 'very_negative',
   'לקוח בסיכון נטישה עם איום פרסומי; סכום מעל הסף.', 'needs_human', 'executed', '8 days'),
  (3, 'a0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'reply', 'CUS-1102',
   'מתי חוזרים לעבוד הסניפים בשישי?', 0, 5, 'low', 'neutral',
   'שאלת מידע כללית ללא סיכון.', 'auto_executed', 'executed', '7 days'),
  (4, 'a0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', 'compensation', 'CUS-1150',
   'המוצר הגיע פגום, מבקש החזר של 120 ש״ח.', 120, 45, 'medium', 'negative',
   'טענה סבירה, סכום מעל הסף של התהליך.', 'needs_human', 'rejected', '6 days'),
  (5, 'a0000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000003', 'refund', 'CUS-2201',
   'חויבתי פעמיים על אותה עסקה מ-12 בחודש.', 349, 30, 'low', 'negative',
   'חיוב כפול מאומת בתבנית שכיחה.', 'needs_human', 'executed', '5 days'),
  (6, 'a0000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000002', 'account_update', 'CUS-1188',
   'תעדכנו בבקשה את מספר הטלפון שלי למספר החדש.', 0, 12, 'low', 'neutral',
   'עדכון שגרתי.', 'auto_executed', 'executed', '4 days'),
  (7, 'a0000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000002', 'account_delete', 'CUS-1191',
   'תמחקו לי את החשבון עכשיו.', 0, 40, 'medium', 'negative',
   'בקשת מחיקה — פעולה בלתי הפיכה.', 'blocked', 'blocked', '3 days'),
  (8, 'a0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'compensation', 'CUS-1240',
   'הטכנאי לא הגיע לפגישה שנקבעה, הפסדתי יום עבודה. מבקש פיצוי.', 150, 55, 'medium', 'negative',
   'נזק סביר ללקוח; סכום מעל הסף.', 'needs_human', 'pending', '40 minutes'),
  (9, 'a0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'compensation', 'CUS-1251',
   'אתם הכי גרועים שיש!!! אני תובע אתכם!!!', 400, 88, 'high', 'very_negative',
   'איום משפטי וסנטימנט קיצוני — דורש אדם.', 'needs_human', 'pending', '10 minutes'),
  (10, 'a0000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000003', 'refund', 'CUS-2230',
   'נראה לי שחויבתי פעמיים החודש, תבדקו בבקשה.', 89, 25, 'low', 'neutral',
   'סכום נמוך, טון רגוע.', 'needs_human', 'pending', '1 hour')
), ins as (
  insert into public.agent_actions (id, process_id, division_id, team_id, action_type, customer_ref, customer_message,
    requested_amount, ai_status, ai_risk_score, ai_risk_level, ai_sentiment, ai_reasoning, guardrail_hits,
    decision, status, created_at)
  select ('b0000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, proc::uuid,
    (select division_id from public.processes where id = proc::uuid), team::uuid, atype, cref, msg,
    amt, 'ok', risk, lvl, sent, reason,
    case when decision = 'blocked' then '[{"type":"action_block","detail":"פעולה חסומה לסוכן"}]'::jsonb
         when decision = 'needs_human' then '[{"type":"amount_threshold","detail":"סכום מעל הסף"}]'::jsonb
         else '[]'::jsonb end,
    decision, status, now() - ago::interval
  from src returning id, division_id, team_id, decision, status, created_at
)
insert into public.approval_requests (action_id, division_id, team_id, status, due_at, decided_at, decision_note, created_at)
select id, division_id, team_id,
  case status when 'executed' then 'approved' when 'rejected' then 'rejected' else 'pending' end,
  created_at + interval '30 minutes',
  case when status in ('executed', 'rejected') then created_at + interval '12 minutes' end,
  case when status = 'rejected' then 'אין תיעוד לפגם; הוצע החלפה במקום החזר' end,
  created_at
from ins where decision = 'needs_human';
