import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anonKey)

// The anon key is public by design; every table is protected by RLS.
export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing-key')

/** Calls an Edge Function and returns its JSON, throwing a readable Hebrew error. */
export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    let message = 'השרת לא הגיב. נסו שוב בעוד רגע.'
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try {
        const j = await ctx.json()
        if (j?.error) message = j.error
      } catch { /* keep generic message */ }
    }
    throw new Error(message)
  }
  return data as T
}

/** Postgres RAISE messages from our RPCs are already in Hebrew. */
export function dbMessage(e: { message?: string } | null | undefined): string {
  if (!e?.message) return 'שגיאה לא צפויה'
  if (e.message.includes('row-level security')) return 'אין לך הרשאה לבצע את הפעולה הזו'
  if (e.message.includes('permission denied')) return 'אין לך הרשאה לבצע את הפעולה הזו'
  if (e.message.includes('violates check constraint')) return 'אחד הערכים אינו בטווח המותר'
  return e.message
}
