-- Local permission & logic tests. Run on the cmtest database after migrations.
\set ON_ERROR_STOP 0
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'governance@example.com', '{"full_name":"נועה (Governance)"}'),
  ('22222222-2222-2222-2222-222222222222', 'manager@example.com',   '{"full_name":"דנה (מנהלת אגף)"}'),
  ('33333333-3333-3333-3333-333333333333', 'approver@example.com', '{"full_name":"יוסי (ראש צוות)"}');
update public.processes set owner_id = '22222222-2222-2222-2222-222222222222'
  where division_id = 'd0000000-0000-0000-0000-000000000001';

\echo '--- profiles created by trigger'
select email, role, division_id is not null as has_div, team_id is not null as has_team from public.profiles order by email;

-- ===== APPROVER (team A) =====
set role authenticated; select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
\echo '--- T1 approver sees only team A actions (expect 5 rows, all team A)'
select count(*) as visible, count(*) filter (where team_id <> '70000000-0000-0000-0000-000000000001') as other_team from public.agent_actions;
\echo '--- T2 approver sees no incidents and no finance processes'
select (select count(*) from public.incidents) as incidents, (select count(*) from public.processes where division_id = 'd0000000-0000-0000-0000-000000000002') as finance_procs;
\echo '--- T3 approver tries to make himself governance (expect permission denied)'
update public.profiles set role = 'governance' where id = auth.uid();
\echo '--- T4 approver inserts a fake executed action directly (expect permission denied)'
insert into public.agent_actions (process_id, division_id, team_id, action_type, customer_ref, customer_message, decision)
values ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','reply','X1','hello world','auto_executed');
\echo '--- T5 approver decides a FINANCE request (expect error: no permission)'
select public.decide_approval((select id from public.approval_requests where action_id='b0000000-0000-0000-0000-000000000010'), 'approved', null);
\echo '--- T6 reject without note (expect error)'
select public.decide_approval((select id from public.approval_requests where action_id='b0000000-0000-0000-0000-000000000008'), 'rejected', '');
\echo '--- T7 approve own team request (expect ok)'
select public.decide_approval((select id from public.approval_requests where action_id='b0000000-0000-0000-0000-000000000008'), 'approved', 'מאושר');
\echo '--- T8 approve the same request again (expect error: already handled)'
select public.decide_approval((select id from public.approval_requests where action_id='b0000000-0000-0000-0000-000000000008'), 'approved', 'שוב');
\echo '--- T9 approver tries kill switch (expect error)'
select public.kill_switch('a0000000-0000-0000-0000-000000000001', 'ניסיון של מאשר');
reset role;

-- ===== AGENT RUNS (Edge Function uses service role) =====
set role service_role;
\echo '--- T10 30 NIS, calm → auto_executed'
select public.submit_agent_action('22222222-2222-2222-2222-222222222222','a0000000-0000-0000-0000-000000000001','compensation','CUS-9001','איחור קטן במשלוח',30,'{"status":"ok","risk_score":15,"risk_level":"low","sentiment":"negative","reasoning":"x"}')->>'decision';
\echo '--- T11 200 NIS → needs_human'
select public.submit_agent_action('22222222-2222-2222-2222-222222222222','a0000000-0000-0000-0000-000000000001','compensation','CUS-9002','מוצר פגום לגמרי',200,'{"status":"ok","risk_score":40,"risk_level":"medium","sentiment":"negative","reasoning":"x"}')->>'decision';
\echo '--- T12 20 NIS but AI unavailable → needs_human (fail-safe)'
select public.submit_agent_action('22222222-2222-2222-2222-222222222222','a0000000-0000-0000-0000-000000000001','compensation','CUS-9003','בקשה קטנה',20,'{"status":"unavailable"}')->>'decision';
\echo '--- T13 supervised autonomous: account_delete → blocked'
select public.submit_agent_action('11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000003','account_delete','CUS-9004','תמחקו לי את החשבון',0,'{"status":"ok","risk_score":30,"risk_level":"low","sentiment":"neutral","reasoning":"x"}')->>'decision';
\echo '--- T14 supervised autonomous: amount over threshold, low risk → auto + manager notified'
select public.submit_agent_action('11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000003','account_update','CUS-9005','עדכון כתובת חיוב',10,'{"status":"ok","risk_score":10,"risk_level":"low","sentiment":"neutral","reasoning":"x"}')->>'decision';
\echo '--- T15 manager runs a FINANCE agent (expect error)'
select public.submit_agent_action('22222222-2222-2222-2222-222222222222','a0000000-0000-0000-0000-000000000002','refund','CUS-9006','חיוב כפול',50,'{"status":"ok","risk_score":10}');
\echo '--- T16 draft agent (expect error: not active)'
select public.submit_agent_action('22222222-2222-2222-2222-222222222222','a0000000-0000-0000-0000-000000000004','reply','CUS-9007','שאלה כללית',0,'{"status":"ok","risk_score":5}');
reset role;

-- ===== MANAGER =====
set role authenticated; select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
\echo '--- T17 manager sets supervised_autonomous (expect error: governance only)'
update public.processes set autonomy_level = 'supervised_autonomous' where id = 'a0000000-0000-0000-0000-000000000001';
\echo '--- T18 manager creates a process in FINANCE (expect RLS error)'
insert into public.processes (division_id, name) values ('d0000000-0000-0000-0000-000000000002', 'ניסיון חדירה');
\echo '--- T19 kill switch with empty reason (expect error)'
select public.kill_switch('a0000000-0000-0000-0000-000000000001', '');
\echo '--- T20 kill switch (expect incident id)'
select public.kill_switch('a0000000-0000-0000-0000-000000000001', 'הסוכן אישר פיצויים חריגים ברצף') is not null as incident_opened;
\echo '--- T21 after kill switch: frozen requests / process status'
select (select status from public.processes where id='a0000000-0000-0000-0000-000000000001') as proc,
       (select count(*) from public.approval_requests where status='frozen') as frozen;
\echo '--- T22 manager reactivates directly (expect error)'
update public.processes set status = 'active' where id = 'a0000000-0000-0000-0000-000000000001';
\echo '--- T23 manager reinstates via RPC (expect error: governance only)'
select public.reinstate_process((select id from public.incidents limit 1), 'בדקנו הכל');
\echo '--- T24 approve a frozen request (expect error)'
select public.decide_approval((select id from public.approval_requests where status='frozen' limit 1), 'approved', 'x');
reset role;
set role service_role;
\echo '--- T25 run the agent while suspended (expect error)'
select public.submit_agent_action('22222222-2222-2222-2222-222222222222','a0000000-0000-0000-0000-000000000001','reply','CUS-9008','שאלה',0,'{"status":"ok","risk_score":5}');
reset role;

-- ===== GOVERNANCE =====
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
\echo '--- T26 governance reinstates (expect ok) and requests return to pending'
select public.reinstate_process((select id from public.incidents where status='open' limit 1), 'נמצא באג בכלל הסף, תוקן');
select (select status from public.processes where id='a0000000-0000-0000-0000-000000000001') as proc,
       (select count(*) from public.approval_requests where status='frozen') as still_frozen;
\echo '--- T27 governance demotes itself (expect error)'
select public.admin_set_user(auth.uid(), 'approver', 'd0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', true);
\echo '--- T28 governance moves approver to a team of another division (expect error)'
select public.admin_set_user('33333333-3333-3333-3333-333333333333', 'approver', 'd0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000003', true);
\echo '--- T29 SLA: force one request overdue and run check (expect >=1)'
reset role;
update public.approval_requests set due_at = now() - interval '1 minute' where status = 'pending' and action_id = 'b0000000-0000-0000-0000-000000000010';
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select public.run_sla_check() as escalated;
reset role;
\echo '--- notifications per user'
select p.email, count(n.*) from public.profiles p left join public.notifications n on n.user_id = p.id group by 1 order by 1;
\echo '--- audit events'
select event, count(*) from public.audit_log group by 1 order by 1;
-- ===== new business rules =====
set role authenticated; select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
\echo '--- T30 activate agent without guardrails (expect error)'
insert into public.processes (id, division_id, name, autonomy_level) values ('a0000000-0000-0000-0000-0000000000aa','d0000000-0000-0000-0000-000000000001','סוכן בלי בלמים','propose');
update public.processes set status='active' where id='a0000000-0000-0000-0000-0000000000aa';
\echo '--- T31 archive agent with open requests (expect error)'
update public.processes set status='archived' where id='a0000000-0000-0000-0000-000000000001';
reset role;
