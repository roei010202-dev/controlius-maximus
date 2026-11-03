// Governance weekly report — AI turns 7 days of agent activity into an executive summary.
import { AiUnavailable, summarize } from "../_shared/gemini.ts";
import { corsHeaders, getContext, json } from "../_shared/common.ts";

const PROMPT = `אתה יועץ Governance לסוכני AI בארגון גדול. על בסיס הנתונים של 7 הימים האחרונים,
כתוב בעברית דוח מנהלים קצר (עד 180 מילים) במבנה:
**תמונת מצב** — שורה אחת.
**נקודות לתשומת לב** — 2–4 נקודות (שיעור הסלמות, סוכנים עם סיכון גבוה, חריגות SLA, תקריות).
**המלצה** — פעולה אחת קונקרטית (למשל שינוי רמת אוטונומיה או סף) עם נימוק.
השתמש רק במספרים שמופיעים בנתונים.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const ctx = await getContext(req);
  if (ctx instanceof Response) return ctx;
  const { userClient, admin } = ctx;

  const { data: role } = await userClient.rpc("app_role");
  if (role !== "governance") return json({ error: "הדוח זמין ל-Governance בלבד" }, 403);

  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const [{ data: actions }, { data: approvals }, { data: incidents }, { data: processes }] = await Promise.all([
    admin.from("agent_actions").select("process_id, decision, status, ai_risk_score, ai_status, requested_amount").gte("created_at", since),
    admin.from("approval_requests").select("status, created_at, decided_at, escalated_at").gte("created_at", since),
    admin.from("incidents").select("process_id, status, reason").gte("created_at", since),
    admin.from("processes").select("id, name, autonomy_level, status, divisions(name)"),
  ]);

  const perProcess = (processes ?? []).map((p) => {
    const a = (actions ?? []).filter((x) => x.process_id === p.id);
    const risks = a.map((x) => x.ai_risk_score).filter((x): x is number => x != null);
    return {
      agent: p.name, division: (p.divisions as { name?: string } | null)?.name, autonomy: p.autonomy_level, status: p.status,
      total: a.length,
      auto_executed: a.filter((x) => x.decision === "auto_executed").length,
      needs_human: a.filter((x) => x.decision === "needs_human").length,
      blocked: a.filter((x) => x.decision === "blocked").length,
      rejected_by_human: a.filter((x) => x.status === "rejected").length,
      avg_risk: risks.length ? Math.round(risks.reduce((s, r) => s + r, 0) / risks.length) : null,
      ai_unavailable: a.filter((x) => x.ai_status === "unavailable").length,
    };
  });
  const stats = {
    period_days: 7,
    agents: perProcess,
    approvals: {
      total: approvals?.length ?? 0,
      escalated_sla: approvals?.filter((x) => x.escalated_at).length ?? 0,
      still_open: approvals?.filter((x) => ["pending", "escalated", "frozen"].includes(x.status)).length ?? 0,
    },
    incidents: incidents ?? [],
  };

  try {
    const report = await summarize(PROMPT, stats);
    return json({ report, stats, generated_at: new Date().toISOString() });
  } catch (e) {
    console.error((e as Error).message);
    return json({ error: e instanceof AiUnavailable ? "שירות ה-AI לא זמין כרגע. הנתונים הגולמיים מוצגים למטה." : "שגיאה", stats }, 503);
  }
});
