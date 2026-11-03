-- =====================================================================
-- CONTROLIUS MAXIMUS (C.M) — database schema, permissions and logic
-- Run once in Supabase: SQL Editor → paste → Run.
-- =====================================================================

-- ---------- Core entities -------------------------------------------------

create table public.divisions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 60),
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  division_id uuid not null references public.divisions(id) on delete restrict,
  name text not null check (char_length(name) between 2 and 60),
  created_at timestamptz not null default now(),
  unique (division_id, name)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text check (full_name is null or char_length(full_name) <= 80),
  role text not null default 'approver'
    check (role in ('approver', 'division_manager', 'governance')),
  division_id uuid references public.divisions(id),
  team_id uuid references public.teams(id),
  onboarded boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  -- an approver must belong to a team; a manager to a division
  constraint profile_scope check (
    (role = 'approver' and team_id is not null and division_id is not null)
    or (role = 'division_manager' and division_id is not null)
    or role = 'governance'
  )
);

-- A "process" is one business process delegated to one AI agent.
create table public.processes (
  id uuid primary key default gen_random_uuid(),
  division_id uuid not null references public.divisions(id),
  team_id uuid references public.teams(id),            -- null = all teams in the division
  owner_id uuid references public.profiles(id) on delete set null,
  name text not null check (char_length(name) between 3 and 80),
  description text not null default '' check (char_length(description) <= 500),
  autonomy_level text not null default 'propose'
    check (autonomy_level in ('advisory', 'propose', 'execute_with_approval', 'supervised_autonomous')),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'suspended', 'archived')),
  sla_minutes integer not null default 60 check (sla_minutes between 5 and 10080),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.guardrails (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes(id) on delete cascade,
  type text not null check (type in ('amount_threshold', 'risk_threshold', 'sentiment_escalation', 'action_block')),
  threshold_amount numeric(12,2) check (threshold_amount is null or threshold_amount between 0 and 100000),
  max_risk_score integer check (max_risk_score is null or max_risk_score between 0 and 100),
  blocked_action text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint guardrail_shape check (
    (type = 'amount_threshold' and threshold_amount is not null)
    or (type = 'risk_threshold' and max_risk_score is not null)
    or (type = 'sentiment_escalation')
    or (type = 'action_block' and blocked_action is not null)
  )
);

-- Every request an agent makes is logged here (the Action Log).
create table public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes(id),
  division_id uuid not null references public.divisions(id),
  team_id uuid not null references public.teams(id),
  action_type text not null
    check (action_type in ('compensation', 'refund', 'reply', 'account_update', 'account_delete')),
  customer_ref text not null check (char_length(customer_ref) between 2 and 40),
  customer_message text not null check (char_length(customer_message) between 5 and 2000),
  requested_amount numeric(12,2) not null default 0 check (requested_amount between 0 and 1000000),
  ai_status text not null default 'ok' check (ai_status in ('ok', 'unavailable')),
  ai_risk_score integer check (ai_risk_score is null or ai_risk_score between 0 and 100),
  ai_risk_level text check (ai_risk_level is null or ai_risk_level in ('low', 'medium', 'high')),
  ai_sentiment text check (ai_sentiment is null or ai_sentiment in ('positive', 'neutral', 'negative', 'very_negative')),
  ai_reasoning text,
  guardrail_hits jsonb not null default '[]'::jsonb,
  decision text not null check (decision in ('auto_executed', 'needs_human', 'blocked')),
  status text not null default 'pending'
    check (status in ('pending', 'executed', 'rejected', 'blocked', 'frozen', 'escalated')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null unique references public.agent_actions(id) on delete cascade,
  division_id uuid not null references public.divisions(id),
  team_id uuid not null references public.teams(id),
  kind text not null default 'approval' check (kind in ('approval', 'recommendation')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'escalated', 'frozen')),
  due_at timestamptz not null,
  escalated_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null,
  decision_note text check (decision_note is null or char_length(decision_note) <= 500),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes(id),
  division_id uuid not null references public.divisions(id),
  opened_by uuid references public.profiles(id) on delete set null,
  reason text not null check (char_length(reason) between 5 and 500),
  status text not null default 'open' check (status in ('open', 'resolved')),
  ai_summary text,
  ai_status text not null default 'pending' check (ai_status in ('pending', 'ok', 'unavailable')),
  calendar_status text not null default 'pending' check (calendar_status in ('pending', 'created', 'failed')),
  calendar_event_link text,
  calendar_event_start timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null default '',
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  division_id uuid references public.divisions(id),
  entity text not null,
  entity_id uuid,
  event text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index on public.teams (division_id);
create index on public.processes (division_id, status);
create index on public.guardrails (process_id);
create index on public.agent_actions (process_id, created_at desc);
create index on public.agent_actions (team_id, created_at desc);
create index on public.approval_requests (team_id, status);
create index on public.approval_requests (status, due_at);
create index on public.incidents (process_id, status);
create index on public.notifications (user_id, is_read, created_at desc);
create index on public.audit_log (created_at desc);

-- ---------- Identity helpers (who is calling?) ---------------------------

create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.app_division() returns uuid
language sql stable security definer set search_path = public as $$
  select division_id from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.app_team() returns uuid
language sql stable security definer set search_path = public as $$
  select team_id from public.profiles where id = auth.uid() and is_active
$$;

-- Can the caller see / manage things belonging to this division?
create or replace function public.can_manage_division(p_division uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() = 'governance'
    or (public.app_role() = 'division_manager' and public.app_division() = p_division), false)
$$;

-- ---------- Internal helpers ----------------------------------------------

create or replace function public._audit(p_actor uuid, p_division uuid, p_entity text,
  p_entity_id uuid, p_event text, p_details jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = public as $$
  insert into public.audit_log (actor_id, division_id, entity, entity_id, event, details)
  values (p_actor, p_division, p_entity, p_entity_id, p_event, coalesce(p_details, '{}'::jsonb));
$$;

create or replace function public._notify_role(p_role text, p_division uuid, p_team uuid,
  p_title text, p_body text, p_link text) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, title, body, link)
  select id, p_title, p_body, p_link from public.profiles
  where is_active and role = p_role
    and (p_division is null or division_id = p_division)
    and (p_team is null or team_id = p_team);
$$;

-- ---------- Triggers ---------------------------------------------------------

-- New sign-up → profile. Demo e-mails get their demo role; everyone else
-- starts as an approver in the first team, until Governance changes it.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_div uuid; v_team uuid; v_role text := 'approver'; v_name text;
begin
  select t.division_id, t.id into v_div, v_team
  from public.teams t join public.divisions d on d.id = t.division_id
  order by d.created_at, t.created_at limit 1;

  v_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  if new.email = 'governance@example.com' then
    v_role := 'governance'; v_div := null; v_team := null; v_name := 'Governance Admin';
  elsif new.email = 'manager@example.com' then
    v_role := 'division_manager'; v_team := null; v_name := 'Division Manager';
  elsif new.email = 'approver@example.com' then
    v_name := 'Team Approver';
  end if;

  insert into public.profiles (id, email, full_name, role, division_id, team_id)
  values (new.id, new.email, v_name, v_role, v_div, v_team);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

create trigger processes_touch before update on public.processes
  for each row execute function public.touch_updated_at();

-- Business rules on processes that hold no matter which screen changed them.
create or replace function public.process_rules() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;            -- system / seed
  if tg_op = 'UPDATE' and new.division_id <> old.division_id then
    raise exception 'לא ניתן להעביר תהליך בין אגפים';
  end if;
  -- Only Governance may grant the highest autonomy level.
  if new.autonomy_level = 'supervised_autonomous'
     and (tg_op = 'INSERT' or old.autonomy_level <> 'supervised_autonomous')
     and public.app_role() <> 'governance' then
    raise exception 'רמת "אוטונומי מבוקר" ניתנת רק על ידי Governance';
  end if;
  -- A suspended agent comes back only through reinstate_process().
  if tg_op = 'UPDATE' and old.status = 'suspended' and new.status <> 'suspended'
     and coalesce(current_setting('cm.reinstating', true), '') <> '1' then
    raise exception 'סוכן מושעה מוחזר לפעילות רק דרך תחקיר ואישור Governance';
  end if;
  -- An agent cannot go live without brakes (advisory agents never act alone).
  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active')
     and new.autonomy_level <> 'advisory'
     and not exists (select 1 from public.guardrails where process_id = new.id and is_active) then
    raise exception 'אי אפשר להפעיל סוכן בלי Guardrail פעיל אחד לפחות';
  end if;
  -- Archiving must not orphan requests that are still waiting for a human.
  if tg_op = 'UPDATE' and new.status = 'archived' and old.status <> 'archived' and exists (
    select 1 from public.approval_requests r join public.agent_actions a on a.id = r.action_id
    where a.process_id = new.id and r.status in ('pending', 'escalated', 'frozen')) then
    raise exception 'יש לסוכן בקשות פתוחות — יש לטפל בהן לפני העברה לארכיון';
  end if;
  if new.team_id is not null and not exists (
    select 1 from public.teams where id = new.team_id and division_id = new.division_id) then
    raise exception 'הצוות שנבחר אינו שייך לאגף';
  end if;
  return new;
end $$;

create trigger processes_rules before insert or update on public.processes
  for each row execute function public.process_rules();

-- AUTOMATION #2 (Trigger: agent status → suspended; Action: freeze, open incident, notify)
create or replace function public.on_process_suspended() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_frozen int;
begin
  if new.status = 'suspended' and old.status <> 'suspended' then
    update public.approval_requests r set status = 'frozen'
      from public.agent_actions a
      where a.id = r.action_id and a.process_id = new.id and r.status in ('pending', 'escalated');
    get diagnostics v_frozen = row_count;
    update public.agent_actions set status = 'frozen'
      where process_id = new.id and status in ('pending', 'escalated');

    if not exists (select 1 from public.incidents where process_id = new.id and status = 'open') then
      insert into public.incidents (process_id, division_id, opened_by, reason)
      values (new.id, new.division_id, auth.uid(), 'הסוכן הושעה ללא נימוק מפורט');
    end if;

    perform public._notify_role('governance', null, null,
      'Kill switch הופעל: ' || new.name,
      v_frozen || ' בקשות הוקפאו. נדרש תחקיר והחלטה על החזרה לפעילות.', '/incidents');
    perform public._notify_role('division_manager', new.division_id, null,
      'סוכן הושעה: ' || new.name, v_frozen || ' בקשות הוקפאו.', '/incidents');
    perform public._audit(auth.uid(), new.division_id, 'process', new.id, 'suspended',
      jsonb_build_object('frozen_requests', v_frozen));
  end if;
  return new;
end $$;

create trigger processes_suspended after update of status on public.processes
  for each row execute function public.on_process_suspended();

-- ---------- Guardrail engine ------------------------------------------------

-- Pure decision function: given a request and the AI assessment,
-- returns which guardrails were hit and what to do.
create or replace function public.evaluate_guardrails(p_process_id uuid, p_action_type text,
  p_amount numeric, p_ai_status text, p_risk integer, p_sentiment text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  g record; v_level text; v_hits jsonb := '[]'::jsonb; v_blocked boolean := false;
  v_soft boolean := false; v_hard boolean := false; v_decision text; v_notify boolean := false;
begin
  select autonomy_level into v_level from public.processes where id = p_process_id;

  for g in select * from public.guardrails where process_id = p_process_id and is_active loop
    if g.type = 'action_block' and g.blocked_action = p_action_type then
      v_blocked := true;
      v_hits := v_hits || jsonb_build_object('type', g.type, 'detail', 'פעולה חסומה לסוכן');
    elsif g.type = 'amount_threshold' and p_amount > g.threshold_amount then
      v_soft := true;
      v_hits := v_hits || jsonb_build_object('type', g.type,
        'detail', 'סכום ' || trim(to_char(p_amount, 'FM999,999,990')) || ' ₪ מעל הסף ' || trim(to_char(g.threshold_amount, 'FM999,999,990')) || ' ₪');
    elsif g.type = 'risk_threshold' then
      if p_ai_status <> 'ok' then
        v_hard := true;   -- fail-safe: no AI assessment → a human decides
        v_hits := v_hits || jsonb_build_object('type', g.type, 'detail', 'הערכת AI לא זמינה — מועבר לאדם');
      elsif p_risk > g.max_risk_score then
        v_hard := true;
        v_hits := v_hits || jsonb_build_object('type', g.type,
          'detail', 'ציון סיכון ' || p_risk || ' מעל ' || g.max_risk_score);
      end if;
    elsif g.type = 'sentiment_escalation' then
      if p_ai_status <> 'ok' then
        v_hard := true;
        v_hits := v_hits || jsonb_build_object('type', g.type, 'detail', 'ניתוח סנטימנט לא זמין — מועבר לאדם');
      elsif p_sentiment = 'very_negative' then
        v_hard := true;
        v_hits := v_hits || jsonb_build_object('type', g.type, 'detail', 'סנטימנט לקוח קיצוני');
      end if;
    end if;
  end loop;

  if v_blocked then
    v_decision := 'blocked';
  elsif v_level in ('advisory', 'propose') then
    v_decision := 'needs_human';
  elsif v_level = 'execute_with_approval' then
    v_decision := case when v_soft or v_hard then 'needs_human' else 'auto_executed' end;
  else -- supervised_autonomous: acts alone on amounts (and reports), escalates judgement calls
    v_decision := case when v_hard then 'needs_human' else 'auto_executed' end;
    v_notify := v_soft and not v_hard;
  end if;

  return jsonb_build_object('decision', v_decision, 'hits', v_hits, 'notify_manager', v_notify,
    'kind', case when v_level = 'advisory' then 'recommendation' else 'approval' end);
end $$;

-- BUSINESS PROCESS #1 entry point. Called by the agent-run Edge Function
-- (service role) after the AI assessment.
create or replace function public.submit_agent_action(p_actor uuid, p_process_id uuid,
  p_action_type text, p_customer_ref text, p_message text, p_amount numeric, p_ai jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p public.processes; v_role text; v_div uuid; v_team uuid; v_eval jsonb; v_action uuid;
  v_status text; v_ai_status text := coalesce(p_ai->>'status', 'unavailable');
begin
  select role, division_id into v_role, v_div from public.profiles where id = p_actor and is_active;
  select * into p from public.processes where id = p_process_id;
  if p.id is null then raise exception 'התהליך לא נמצא'; end if;
  if not (v_role = 'governance' or (v_role = 'division_manager' and v_div = p.division_id)) then
    raise exception 'אין הרשאה להפעיל את הסוכן הזה';
  end if;
  if p.status <> 'active' then raise exception 'הסוכן אינו פעיל (סטטוס: %)', p.status; end if;

  v_team := coalesce(p.team_id, (select id from public.teams where division_id = p.division_id
                                  order by created_at limit 1));
  v_eval := public.evaluate_guardrails(p.id, p_action_type, coalesce(p_amount, 0), v_ai_status,
    nullif(p_ai->>'risk_score', '')::int, p_ai->>'sentiment');

  v_status := case v_eval->>'decision' when 'auto_executed' then 'executed'
                                       when 'blocked' then 'blocked' else 'pending' end;

  insert into public.agent_actions (process_id, division_id, team_id, action_type, customer_ref,
    customer_message, requested_amount, ai_status, ai_risk_score, ai_risk_level, ai_sentiment,
    ai_reasoning, guardrail_hits, decision, status, created_by)
  values (p.id, p.division_id, v_team, p_action_type, trim(p_customer_ref), trim(p_message),
    coalesce(p_amount, 0), v_ai_status,
    case when v_ai_status = 'ok' then nullif(p_ai->>'risk_score', '')::int end,
    case when v_ai_status = 'ok' then p_ai->>'risk_level' end,
    case when v_ai_status = 'ok' then p_ai->>'sentiment' end,
    case when v_ai_status = 'ok' then left(p_ai->>'reasoning', 600) end,
    v_eval->'hits', v_eval->>'decision', v_status, p_actor)
  returning id into v_action;

  if v_eval->>'decision' = 'needs_human' then
    insert into public.approval_requests (action_id, division_id, team_id, kind, due_at)
    values (v_action, p.division_id, v_team, v_eval->>'kind', now() + make_interval(mins => p.sla_minutes));
    perform public._notify_role('approver', null, v_team, 'בקשה חדשה ממתינה לאישורך',
      p.name || ' · ' || trim(p_customer_ref), '/approvals');
  elsif (v_eval->>'notify_manager')::boolean then
    perform public._notify_role('division_manager', p.division_id, null,
      'ביצוע אוטונומי מעל סף (לידיעה)', p.name || ' · ' || trim(to_char(coalesce(p_amount, 0), 'FM999,999,990')) || ' ₪', '/log');
  end if;

  perform public._audit(p_actor, p.division_id, 'agent_action', v_action, 'submitted',
    jsonb_build_object('decision', v_eval->>'decision', 'ai_status', v_ai_status));
  return jsonb_build_object('action_id', v_action, 'decision', v_eval->>'decision',
    'status', v_status, 'hits', v_eval->'hits');
end $$;

-- Human decision on an approval request.
create or replace function public.decide_approval(p_request_id uuid, p_decision text, p_note text)
returns void
language plpgsql security definer set search_path = public as $$
declare r public.approval_requests; v_role text := public.app_role(); v_proc public.processes;
begin
  select * into r from public.approval_requests where id = p_request_id for update;
  if r.id is null then raise exception 'הבקשה לא נמצאה'; end if;
  if not (v_role = 'governance'
          or (v_role = 'division_manager' and public.app_division() = r.division_id)
          or (v_role = 'approver' and public.app_team() = r.team_id)) then
    raise exception 'אין לך הרשאה להחליט בבקשה הזו';
  end if;
  if r.status not in ('pending', 'escalated') then
    raise exception 'הבקשה כבר טופלה או הוקפאה (סטטוס: %)', r.status;
  end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'החלטה לא חוקית'; end if;
  if p_decision = 'rejected' and char_length(coalesce(trim(p_note), '')) < 3 then
    raise exception 'בדחייה חובה לכתוב נימוק (לפחות 3 תווים)';
  end if;
  if char_length(coalesce(p_note, '')) > 500 then raise exception 'הנימוק ארוך מדי (עד 500 תווים)'; end if;

  update public.approval_requests set status = p_decision, decided_by = auth.uid(),
    decision_note = nullif(trim(p_note), ''), decided_at = now() where id = r.id;
  update public.agent_actions set status = case when p_decision = 'approved' then 'executed' else 'rejected' end
    where id = r.action_id;

  select p.* into v_proc from public.processes p join public.agent_actions a on a.process_id = p.id
    where a.id = r.action_id;
  if v_proc.owner_id is not null then
    insert into public.notifications (user_id, title, body, link) values (v_proc.owner_id,
      case when p_decision = 'approved' then 'בקשה אושרה' else 'בקשה נדחתה' end,
      v_proc.name, '/log');
  end if;
  perform public._audit(auth.uid(), r.division_id, 'approval_request', r.id, p_decision,
    jsonb_build_object('note', p_note));
end $$;

-- BUSINESS PROCESS #2 entry point: Kill switch.
create or replace function public.kill_switch(p_process_id uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare p public.processes; v_incident uuid;
begin
  select * into p from public.processes where id = p_process_id for update;
  if p.id is null then raise exception 'התהליך לא נמצא'; end if;
  if not public.can_manage_division(p.division_id) then
    raise exception 'רק מנהל/ת האגף או Governance יכולים להפעיל Kill switch';
  end if;
  if p.status <> 'active' then raise exception 'אפשר להשעות רק סוכן פעיל (סטטוס נוכחי: %)', p.status; end if;
  if char_length(coalesce(trim(p_reason), '')) < 5 then raise exception 'חובה לכתוב סיבה (לפחות 5 תווים)'; end if;

  insert into public.incidents (process_id, division_id, opened_by, reason)
  values (p.id, p.division_id, auth.uid(), left(trim(p_reason), 500)) returning id into v_incident;
  update public.processes set status = 'suspended' where id = p.id;   -- fires automation #2
  return v_incident;
end $$;

create or replace function public.reinstate_process(p_incident_id uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare i public.incidents; p public.processes;
begin
  if public.app_role() is distinct from 'governance' then
    raise exception 'רק Governance יכול להחזיר סוכן לפעילות';
  end if;
  select * into i from public.incidents where id = p_incident_id for update;
  if i.id is null or i.status <> 'open' then raise exception 'התקרית לא נמצאה או שכבר נסגרה'; end if;
  if char_length(coalesce(trim(p_note), '')) < 5 then raise exception 'חובה לתעד את מסקנות התחקיר (לפחות 5 תווים)'; end if;
  select * into p from public.processes where id = i.process_id;

  update public.incidents set status = 'resolved', resolved_by = auth.uid(),
    resolution_note = left(trim(p_note), 500), resolved_at = now() where id = i.id;
  perform set_config('cm.reinstating', '1', true);
  update public.processes set status = 'active' where id = p.id;
  update public.approval_requests r set status = 'pending',
      due_at = now() + make_interval(mins => p.sla_minutes)
    from public.agent_actions a where a.id = r.action_id and a.process_id = p.id and r.status = 'frozen';
  update public.agent_actions set status = 'pending' where process_id = p.id and status = 'frozen';

  perform public._notify_role('division_manager', p.division_id, null,
    'הסוכן חזר לפעילות: ' || p.name, left(trim(p_note), 200), '/incidents');
  perform public._audit(auth.uid(), p.division_id, 'process', p.id, 'reinstated',
    jsonb_build_object('incident', i.id));
end $$;

-- AUTOMATION #1 (Trigger: schedule every 5 min; Action: escalate overdue requests)
create or replace function public.escalate_overdue() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select ar.*, p.name as process_name from public.approval_requests ar
           join public.agent_actions a on a.id = ar.action_id
           join public.processes p on p.id = a.process_id
           where ar.status = 'pending' and ar.due_at < now() for update of ar skip locked loop
    update public.approval_requests set status = 'escalated', escalated_at = now() where id = r.id;
    update public.agent_actions set status = 'escalated' where id = r.action_id;
    perform public._notify_role('division_manager', r.division_id, null,
      'חריגת SLA — בקשה הוסלמה אליך', r.process_name, '/approvals');
    perform public._audit(null, r.division_id, 'approval_request', r.id, 'sla_escalated', '{}'::jsonb);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Lets Governance run the SLA check on demand (useful in a live demo).
create or replace function public.run_sla_check() returns integer
language plpgsql security definer set search_path = public as $$
begin
  if public.app_role() is distinct from 'governance' then raise exception 'פעולה ל-Governance בלבד'; end if;
  return public.escalate_overdue();
end $$;

create or replace function public.admin_set_user(p_user uuid, p_role text, p_division uuid,
  p_team uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.app_role() is distinct from 'governance' then raise exception 'פעולה ל-Governance בלבד'; end if;
  if p_user = auth.uid() and (p_role <> 'governance' or not p_active) then
    raise exception 'אי אפשר להוריד לעצמך הרשאות Governance (מניעת נעילה)';
  end if;
  if p_role not in ('approver', 'division_manager', 'governance') then raise exception 'תפקיד לא חוקי'; end if;
  if p_role = 'approver' and p_team is null then raise exception 'מאשר/ת חייב/ת להיות משויך/ת לצוות'; end if;
  if p_role = 'division_manager' and p_division is null then raise exception 'מנהל/ת אגף חייב/ת להיות משויך/ת לאגף'; end if;
  if p_team is not null and not exists (select 1 from public.teams where id = p_team and division_id = p_division) then
    raise exception 'הצוות אינו שייך לאגף שנבחר';
  end if;
  update public.profiles set role = p_role,
    division_id = case when p_role = 'governance' then null else p_division end,
    team_id = case when p_role = 'approver' then p_team else null end,
    is_active = p_active
  where id = p_user;
  perform public._audit(auth.uid(), p_division, 'profile', p_user, 'role_changed',
    jsonb_build_object('role', p_role, 'active', p_active));
end $$;

-- ---------- Row Level Security ------------------------------------------------

alter table public.divisions enable row level security;
alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.processes enable row level security;
alter table public.guardrails enable row level security;
alter table public.agent_actions enable row level security;
alter table public.approval_requests enable row level security;
alter table public.incidents enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

-- Org structure: readable by every signed-in user, changed by Governance.
create policy divisions_read on public.divisions for select to authenticated using (true);
create policy divisions_write on public.divisions for all to authenticated
  using (public.app_role() = 'governance') with check (public.app_role() = 'governance');
create policy teams_read on public.teams for select to authenticated using (true);
create policy teams_write on public.teams for all to authenticated
  using (public.app_role() = 'governance') with check (public.app_role() = 'governance');

-- Profiles: yourself; managers see their division; Governance sees all.
create policy profiles_read on public.profiles for select to authenticated using (
  id = auth.uid() or public.app_role() = 'governance'
  or (public.app_role() = 'division_manager' and division_id = public.app_division()));
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Processes (agents)
create policy processes_read on public.processes for select to authenticated using (
  public.can_manage_division(division_id)
  or (public.app_role() = 'approver' and division_id = public.app_division()
      and (team_id is null or team_id = public.app_team())));
create policy processes_insert on public.processes for insert to authenticated
  with check (public.can_manage_division(division_id));
create policy processes_update on public.processes for update to authenticated
  using (public.can_manage_division(division_id)) with check (public.can_manage_division(division_id));

-- Guardrails follow their process.
create policy guardrails_read on public.guardrails for select to authenticated using (
  exists (select 1 from public.processes p where p.id = process_id));
create policy guardrails_write on public.guardrails for all to authenticated
  using (exists (select 1 from public.processes p where p.id = process_id and public.can_manage_division(p.division_id)))
  with check (exists (select 1 from public.processes p where p.id = process_id and public.can_manage_division(p.division_id)));

-- Actions & approvals: read-only from the client; all writes go through RPCs.
create policy actions_read on public.agent_actions for select to authenticated using (
  public.can_manage_division(division_id)
  or (public.app_role() = 'approver' and team_id = public.app_team()));
create policy approvals_read on public.approval_requests for select to authenticated using (
  public.can_manage_division(division_id)
  or (public.app_role() = 'approver' and team_id = public.app_team()));

create policy incidents_read on public.incidents for select to authenticated using (
  public.can_manage_division(division_id));

create policy notifications_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy audit_read on public.audit_log for select to authenticated using (
  public.app_role() = 'governance'
  or (public.app_role() = 'division_manager' and division_id = public.app_division()));

-- ---------- Grants -------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update, delete on public.divisions, public.teams, public.guardrails to authenticated;
grant insert, update on public.processes to authenticated;
grant update (full_name, onboarded) on public.profiles to authenticated;   -- never role/division
grant update (is_read) on public.notifications to authenticated;
grant all on all tables in schema public to service_role;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.app_role(), public.app_division(), public.app_team(),
  public.can_manage_division(uuid) to authenticated;
grant execute on function public.decide_approval(uuid, text, text),
  public.kill_switch(uuid, text), public.reinstate_process(uuid, text),
  public.run_sla_check(), public.admin_set_user(uuid, text, uuid, uuid, boolean) to authenticated;
grant execute on all functions in schema public to service_role;

-- ---------- Schedule (Automation #1) -------------------------------------------
-- pg_cron is available on Supabase. Skipped silently where it is not installed.
do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('cm-sla-escalation', '*/5 * * * *', 'select public.escalate_overdue()');
exception when others then
  raise notice 'pg_cron not available here — schedule skipped (%).', sqlerrm;
end $$;
