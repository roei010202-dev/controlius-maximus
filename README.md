# C.M · CONTROLIUS MAXIMUS

מגדל בקרה לסוכני AI בארגון. המערכת מאפשרת להגדיר לכל סוכן רמת אוטונומיה ו-Guardrails, מנהלת תור אישורים אנושי, שומרת יומן פעולות, ומפעילה Kill switch עם תחקיר ב-Google Calendar.
פרויקט גמר, קורס Vibe Coding לעולם העסקי, הקריה האקדמית אונו. **נתוני דמה בלבד.**

## ארכיטקטורה
| שכבה | טכנולוגיה | אחריות |
|---|---|---|
| ממשק | React + Vite + TypeScript + Tailwind (RTL) | שני ממשקים: תור אישורים (מותאם למובייל) ומגדל בקרה / Governance |
| בסיס נתונים | Supabase Postgres | 9 ישויות, RLS לכל טבלה, מנוע Guardrails ב-SQL, טריגרים ו-pg_cron |
| שרת | Supabase Edge Functions (Deno) | `agent-run` (סיווג סיכון ב-AI), `incident` (Kill switch, סיכום AI, Calendar), `ai-report` |
| AI | Google Gemini API | סיווג סיכון וסנטימנט, סיכום תחקיר, דוח שבועי. המפתח שמור ב-Secrets בלבד |
| אינטגרציה | Google Calendar API (Service Account) | פגישת תחקיר אוטומטית לכל תקרית |
| אירוח | Vercel | |

## אוטומציות
1. **הסלמת SLA**: משימת pg_cron רצה כל 5 דקות. בקשה שעברה את ה-SLA מוסלמת למנהל/ת האגף, נשלחת התראה ונרשמת שורה ב-Audit.
2. **Kill switch**: כשסטטוס של סוכן משתנה ל"מושעה", טריגר מקפיא את הבקשות הפתוחות, פותח תקרית, שולח התראות ורושם ב-Audit.

## הקמה
1. Supabase: SQL Editor ← הרצת `supabase/migrations/0001_schema.sql` ואחריו `0002_seed_demo.sql`.
2. Authentication ← Users ← יצירת 3 משתמשי דמו (Auto-confirm), כולם עם הסיסמה `CmDemo!2026`:
   `approver@example.com`, `manager@example.com`, `governance@example.com`. התפקידים משויכים אוטומטית.
3. Edge Functions: `supabase functions deploy agent-run incident ai-report`
4. Secrets: `GEMINI_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_CALENDAR_ID`, `APP_URL` (ואופציונלית `GEMINI_MODEL`).
5. Vercel: ייבוא הריפו והגדרת המשתנים מ-`.env.example`.

## בדיקות
`supabase/test/rls_tests.sql`: 31 בדיקות הרשאה ולוגיקה (הרשאות לפי תפקיד, Fail-safe כשה-AI לא זמין, מניעת החלטה כפולה, Kill switch והחזרה לפעילות, SLA). הבדיקות רצות על Postgres מקומי עם `supabase_mock.sql`.
