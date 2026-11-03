// Google Calendar integration through a Service Account.
// Secrets: GOOGLE_SERVICE_ACCOUNT_JSON (the downloaded key file, as text)
//          GOOGLE_CALENDAR_ID (the "C.M תחקירים" calendar, shared with the service account)

function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function accessToken(): Promise<string> {
  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not configured");
  const sa = JSON.parse(raw) as { client_email: string; private_key: string };
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/calendar.events",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${b64url(sig)}`,
    }),
  });
  if (!res.ok) throw new Error(`Google token HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).access_token;
}

/** Next working day (Sun–Thu) at 10:00 Israel time, as a local date-time string. */
function nextReviewSlot(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" });
  const d = new Date(`${fmt.format(new Date())}T12:00:00Z`);
  do { d.setUTCDate(d.getUTCDate() + 1); } while (d.getUTCDay() === 5 || d.getUTCDay() === 6);
  return `${d.toISOString().slice(0, 10)}T10:00:00`;
}

export async function createReviewEvent(input: {
  processName: string; reason: string; aiSummary: string | null; appUrl: string;
}): Promise<{ htmlLink: string; start: string }> {
  const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID");
  if (!calendarId) throw new Error("GOOGLE_CALENDAR_ID is not configured");
  const token = await accessToken();
  const start = nextReviewSlot();
  const end = start.replace("T10:00:00", "T10:45:00");
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: `תחקיר סוכן AI: ${input.processName}`,
        description: [
          `סיבת ההשעיה: ${input.reason}`,
          input.aiSummary ? `\nסיכום AI:\n${input.aiSummary}` : "",
          `\nמסך התקרית ב-C.M: ${input.appUrl}/incidents`,
        ].join("\n"),
        start: { dateTime: start, timeZone: "Asia/Jerusalem" },
        end: { dateTime: end, timeZone: "Asia/Jerusalem" },
        colorId: "11",
      }),
    },
  );
  if (!res.ok) throw new Error(`Calendar HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const ev = await res.json();
  return { htmlLink: ev.htmlLink, start: ev.start?.dateTime ?? start };
}
