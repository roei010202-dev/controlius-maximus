const dt = new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jerusalem' })
const money = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 })

export const fmtDate = (iso: string | null | undefined) => (iso ? dt.format(new Date(iso)) : '—')
export const fmtMoney = (n: number | null | undefined) => money.format(Number(n ?? 0))

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 60000
  if (diff < 1) return 'עכשיו'
  if (diff < 60) return `לפני ${Math.round(diff)} דק׳`
  if (diff < 1440) return `לפני ${Math.round(diff / 60)} שע׳`
  return `לפני ${Math.round(diff / 1440)} ימים`
}

/** Minutes until (positive) or since (negative) a deadline. */
export const minutesUntil = (iso: string) => Math.round((new Date(iso).getTime() - Date.now()) / 60000)

export function slaText(iso: string): string {
  const m = minutesUntil(iso)
  if (m < 0) return `חריגה של ${Math.abs(m) < 60 ? Math.abs(m) + ' דק׳' : Math.round(Math.abs(m) / 60) + ' שע׳'}`
  return m < 60 ? `נותרו ${m} דק׳` : `נותרו ${Math.round(m / 60)} שע׳`
}
