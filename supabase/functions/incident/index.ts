// Business process #2 — Kill switch → incident → AI summary → Google Calendar review.
// POST { action: "open", process_id, reason }   or   { action: "retry", incident_id }
import { summarize } from "../_shared/gemini.ts";
import { createReviewEvent } from "../_shared/calendar.ts";
import { corsHeaders, dbError, getContext, json, UUID_RE } from "../_shared/common.ts";

const SUMMARY_PROMPT = `אתה אנליסט בקרה של סוכני AI. סוכן הושעה (Kill switch).
כתוב בעברית סיכום תחקיר קצר לישיבת התחקיר: 3–5 נקודות.
1) מה הסוכן עשה לאחרונה (כמויות והחלטות)  2) דפוסים חריגים או מסוכנים
3) הקשר לסיבת ההשעיה  4) המלצה אחת קונקרטית לפני החזרה לפעילות.
היה ענייני, בלי הקדמות, ואל תמציא נתונים שאינם בטבלה.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const ctx = await getContext(req);
  if (ctx instanceof Response) return ctx;
  const { userClient, admin } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "גוף הבקשה אינו JSON תקין" }, 400); }

  let incidentId: string;
  if (body.action === "open") {
    const processId = String(body.process_id ?? "");
    const reason = String(body.reason ?? "").trim();
    if (!UUID_RE.test(processId)) return json({ error: "תהליך לא חוקי" }, 400);
    if (reason.length < 5 || reason.length > 500) return json({ error: "סיבה: 5–500 תווים" }, 400);
    // Runs AS THE USER: the DB checks role + division and fires automation #2.
    const { data, error } = await userClient.rpc("kill_switch", { p_process_id: processId, p_reason: reason });
    if (error) return json({ error: dbError(error) }, 400);
    incidentId = data as string;
  } else if (body.action === "retry") {
    incidentId = String(body.incident_id ?? "");
    if (!UUID_RE.test(incidentId)) return json({ error: "תקרית לא חוקית" }, 400);
    // visibility check through RLS
    const { data } = await userClient.from("incidents").select("id").eq("id", incidentId).maybeSingle();
    if (!data) return json({ error: "התקרית לא נמצאה או שאין לך גישה" }, 404);
  } else {
    return json({ error: "פעולה לא מוכרת" }, 400);
  }

  const { data: inc } = await admin.from("incidents")
    .select("id, reason, ai_status, ai_summary, calendar_status, process_id, processes(name)")
    .eq("id", incidentId).single();
  const processName = (inc?.processes as { name?: string } | null)?.name ?? "סוכן";

  // ---- AI summary of the agent's recent activity
  let aiStatus = inc?.ai_status ?? "pending";
  let aiSummary: string | null = inc?.ai_summary ?? null;
  if (aiStatus !== "ok") {
    const { data: actions } = await admin.from("agent_actions")
      .select("created_at, action_type, requested_amount, ai_risk_score, ai_sentiment, decision, status, guardrail_hits")
      .eq("process_id", inc!.process_id).order("created_at", { ascending: false }).limit(20);
    try {
      aiSummary = await summarize(SUMMARY_PROMPT, { process: processName, suspension_reason: inc!.reason, recent_actions: actions ?? [] });
      aiStatus = "ok";
    } catch (e) {
      console.error("AI summary failed:", (e as Error).message);
      aiStatus = "unavailable";
    }
    await admin.from("incidents").update({ ai_summary: aiSummary, ai_status: aiStatus }).eq("id", incidentId);
  }

  // ---- Google Calendar review meeting
  let calStatus = inc?.calendar_status ?? "pending";
  let calError: string | null = null;
  if (calStatus !== "created") {
    try {
      const ev = await createReviewEvent({
        processName, reason: inc!.reason, aiSummary,
        appUrl: Deno.env.get("APP_URL") ?? req.headers.get("origin") ?? "",
      });
      calStatus = "created";
      await admin.from("incidents").update({
        calendar_status: "created", calendar_event_link: ev.htmlLink, calendar_event_start: ev.start,
      }).eq("id", incidentId);
    } catch (e) {
      calError = (e as Error).message;
      console.error("Calendar failed:", calError);
      calStatus = "failed";
      await admin.from("incidents").update({ calendar_status: "failed" }).eq("id", incidentId);
    }
  }

  return json({ incident_id: incidentId, ai_status: aiStatus, calendar_status: calStatus,
    warning: calStatus === "failed" ? "הסוכן הושעה, אבל פגישת התחקיר לא נוצרה ביומן. אפשר לנסות שוב מתוך התקרית." : null });
});
