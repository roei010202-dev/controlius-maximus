// Business process #1 — an AI agent requests an action.
// 1) verify caller  2) AI risk assessment (Gemini)  3) guardrail engine in the DB decides
import { AiUnavailable, assessRisk } from "../_shared/gemini.ts";
import { corsHeaders, dbError, getContext, json, UUID_RE } from "../_shared/common.ts";

const ACTION_TYPES = ["compensation", "refund", "reply", "account_update", "account_delete"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ctx = await getContext(req);
  if (ctx instanceof Response) return ctx;
  const { user, userClient, admin } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "גוף הבקשה אינו JSON תקין" }, 400); }

  // ---- validation (the DB validates again; this gives clear messages early)
  const processId = String(body.process_id ?? "");
  const actionType = String(body.action_type ?? "");
  const customerRef = String(body.customer_ref ?? "").trim();
  const message = String(body.customer_message ?? "").trim();
  const amount = Number(body.requested_amount ?? 0);
  const errors: string[] = [];
  if (!UUID_RE.test(processId)) errors.push("יש לבחור תהליך");
  if (!ACTION_TYPES.includes(actionType)) errors.push("סוג פעולה לא חוקי");
  if (customerRef.length < 2 || customerRef.length > 40) errors.push("מזהה לקוח: 2–40 תווים");
  if (message.length < 5 || message.length > 2000) errors.push("תוכן הפנייה: 5–2000 תווים");
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) errors.push("סכום חייב להיות בין 0 ל-1,000,000");
  if (errors.length) return json({ error: errors.join(" · ") }, 400);

  // ---- the caller must be able to SEE the process (RLS enforces division scope)
  const { data: proc } = await userClient.from("processes")
    .select("id, name, description, status").eq("id", processId).maybeSingle();
  if (!proc) return json({ error: "התהליך לא נמצא או שאין לך גישה אליו" }, 404);
  if (proc.status !== "active") return json({ error: "הסוכן אינו פעיל — לא ניתן להריץ אותו" }, 409);

  // ---- AI assessment, with a fail-safe when the external service is down
  let ai: Record<string, unknown> = { status: "unavailable" };
  let aiError: string | null = null;
  if (body.simulate_ai_outage === true) {
    aiError = "הדמיית תקלה בשירות ה-AI (בדיקת QA)";
  } else {
    try {
      ai = { status: "ok", ...(await assessRisk({
        processName: proc.name, processDescription: proc.description,
        actionType, amount, message,
      })) };
    } catch (e) {
      aiError = e instanceof AiUnavailable ? "שירות ה-AI לא הגיב — ההחלטה התקבלה לפי כללים בלבד" : "שגיאת AI";
      console.error("AI error:", (e as Error).message);
    }
  }

  const { data, error } = await admin.rpc("submit_agent_action", {
    p_actor: user.id, p_process_id: processId, p_action_type: actionType,
    p_customer_ref: customerRef, p_message: message, p_amount: amount, p_ai: ai,
  });
  if (error) return json({ error: dbError(error) }, 400);
  return json({ ...data, ai, ai_warning: aiError });
});
