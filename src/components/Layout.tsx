import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Accessibility, Bell, ClipboardCheck, Gauge, LogOut, Menu, ScrollText, ShieldAlert, ShieldCheck, X } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { ROLE_LABEL } from '../lib/labels'
import type { Notification } from '../lib/types'
import { timeAgo } from '../lib/format'

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <svg aria-hidden viewBox="0 0 64 64" className="h-8 w-8"><rect width="64" height="64" rx="14" fill={light ? '#1b2a41' : '#0f1b2d'} /><circle cx="32" cy="32" r="17" fill="none" stroke="#f2a900" strokeWidth="5" strokeDasharray="80 27" transform="rotate(-50 32 32)" /><circle cx="32" cy="32" r="6" fill="#f2a900" /></svg>
      <span className="leading-none">
        <span className={`block text-lg font-extrabold tracking-wide ${light ? 'text-white' : 'text-ink'}`}>C.M</span>
        <span className={`block text-[10px] font-semibold tracking-[0.18em] ${light ? 'text-signal' : 'text-muted'}`} dir="ltr">CONTROLIUS MAXIMUS</span>
      </span>
    </span>
  )
}

function useNav() {
  const { profile } = useAuth()
  const items = [{ to: '/approvals', label: 'תור אישורים', icon: ClipboardCheck }]
  if (profile?.role !== 'approver') {
    items.unshift({ to: '/control', label: 'מגדל הבקרה', icon: Gauge })
    items.push({ to: '/log', label: 'יומן פעולות', icon: ScrollText }, { to: '/incidents', label: 'תקריות', icon: ShieldAlert })
  }
  if (profile?.role === 'governance') items.push({ to: '/governance', label: 'Governance', icon: ShieldCheck })
  return items
}

function NotificationsBell() {
  const { session } = useAuth()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(15)
    setItems((data as Notification[]) ?? [])
  }, [])
  useEffect(() => { if (session) { load(); const t = setInterval(load, 30000); return () => clearInterval(t) } }, [session, load])
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close)
  }, [])

  const unread = items.filter((n) => !n.is_read).length
  const markAll = async () => {
    const ids = items.filter((n) => !n.is_read).map((n) => n.id)
    if (ids.length) await supabase.from('notifications').update({ is_read: true }).in('id', ids)
    load()
  }
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => { setOpen(!open); if (!open) load() }} aria-expanded={open} aria-haspopup="true"
        aria-label={`התראות${unread ? `, ${unread} שלא נקראו` : ''}`}
        className="relative rounded-xl p-2 text-white hover:bg-ink-600">
        <Bell className="h-5 w-5" aria-hidden />
        {unread > 0 && <span aria-hidden className="num absolute -left-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-signal px-1 text-[11px] font-bold text-ink">{unread}</span>}
      </button>
      {open && (
        <div className="absolute left-0 top-12 z-40 w-[min(92vw,360px)] rounded-2xl border border-line bg-white p-2 text-ink shadow-xl">
          <div className="flex items-center justify-between px-2 py-1">
            <h2 className="text-sm font-bold">התראות</h2>
            {unread > 0 && <button onClick={markAll} className="text-xs font-semibold text-brand hover:underline">סימון הכל כנקרא</button>}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">אין התראות עדיין. כשבקשה תמתין לך או סוכן יושעה — זה יופיע כאן.</li>}
            {items.map((n) => (
              <li key={n.id}>
                <button onClick={async () => { await supabase.from('notifications').update({ is_read: true }).eq('id', n.id); setOpen(false); if (n.link) navigate(n.link); load() }}
                  className={`w-full rounded-xl px-3 py-2 text-right hover:bg-canvas ${n.is_read ? '' : 'bg-signal-soft/60'}`}>
                  <div className="text-sm font-semibold">{n.title}</div>
                  <div className="text-xs text-muted">{n.body} · {timeAgo(n.created_at)}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

const A11Y_KEY = 'cm-a11y'
export function A11yMenu({ dark = true }: { dark?: boolean }) {
  const [open, setOpen] = useState(false)
  const [s, setS] = useState<{ scale: number; contrast: boolean; links: boolean; nomotion: boolean }>(() => {
    try { return { scale: 1, contrast: false, links: false, nomotion: false, ...JSON.parse(localStorage.getItem(A11Y_KEY) ?? '{}') } }
    catch { return { scale: 1, contrast: false, links: false, nomotion: false } }
  })
  useEffect(() => {
    const r = document.documentElement
    r.style.setProperty('--font-scale', String(s.scale))
    r.classList.toggle('a11y-contrast', s.contrast)
    r.classList.toggle('a11y-links', s.links)
    r.classList.toggle('a11y-nomotion', s.nomotion)
    try { localStorage.setItem(A11Y_KEY, JSON.stringify(s)) } catch { /* storage unavailable */ }
  }, [s])
  const toggle = (k: 'contrast' | 'links' | 'nomotion') => setS({ ...s, [k]: !s[k] })
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label="תפריט נגישות"
        className={`rounded-xl p-2 ${dark ? 'text-white hover:bg-ink-600' : 'text-ink hover:bg-white'}`}>
        <Accessibility className="h-5 w-5" aria-hidden />
      </button>
      {open && (
        <div className="absolute left-0 top-12 z-40 w-64 rounded-2xl border border-line bg-white p-3 text-ink shadow-xl" role="group" aria-label="הגדרות נגישות">
          <div className="mb-2 text-sm font-bold">נגישות</div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-sm">גודל טקסט</span>
            <div className="flex gap-1">
              {[1, 1.15, 1.3].map((v, i) => (
                <button key={v} onClick={() => setS({ ...s, scale: v })} aria-pressed={s.scale === v}
                  className={`h-9 w-10 rounded-lg border text-sm font-bold ${s.scale === v ? 'border-brand bg-brand-soft' : 'border-line'}`}>
                  {['א', 'א+', 'א++'][i]}
                </button>
              ))}
            </div>
          </div>
          {([['contrast', 'ניגודיות גבוהה'], ['links', 'הדגשת קישורים'], ['nomotion', 'עצירת אנימציות']] as const).map(([k, l]) => (
            <label key={k} className="flex min-h-[40px] cursor-pointer items-center justify-between text-sm">
              {l}<input type="checkbox" checked={s[k]} onChange={() => toggle(k)} className="h-5 w-5 accent-brand" />
            </label>
          ))}
          <Link to="/accessibility" className="mt-2 block text-xs font-semibold text-brand hover:underline" onClick={() => setOpen(false)}>הצהרת נגישות</Link>
        </div>
      )}
    </div>
  )
}

export function Footer() {
  return (
    <footer className="mt-12 border-t border-line py-6 text-center text-xs text-muted">
      <nav aria-label="קישורים משפטיים" className="mb-2 flex justify-center gap-4">
        <Link to="/privacy" className="font-semibold text-brand hover:underline">מדיניות פרטיות</Link>
        <Link to="/accessibility" className="font-semibold text-brand hover:underline">הצהרת נגישות</Link>
      </nav>
      פרויקט גמר · קורס Vibe Coding לעולם העסקי · הקריה האקדמית אונו. כל הנתונים במערכת הם נתוני דמה.
    </footer>
  )
}

export default function Layout() {
  const { profile, signOut } = useAuth()
  const nav = useNav()
  const [menu, setMenu] = useState(false)
  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm font-semibold ${isActive ? 'bg-signal text-ink' : 'text-white/90 hover:bg-ink-600'}`
  return (
    <div className="min-h-screen">
      <a href="#main" className="skip-link">דילוג לתוכן הראשי</a>
      <header className="sticky top-0 z-30 bg-ink text-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
          <button className="rounded-xl p-2 hover:bg-ink-600 lg:hidden" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-controls="main-nav" aria-label="תפריט ניווט">
            {menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link to="/" aria-label="C.M – דף הבית"><Logo light /></Link>
          <nav id="main-nav" aria-label="ניווט ראשי" className={`${menu ? 'flex' : 'hidden'} absolute inset-x-0 top-full flex-col gap-1 bg-ink p-3 lg:static lg:flex lg:flex-row lg:bg-transparent lg:p-0 lg:ms-6`}>
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} className={linkCls} onClick={() => setMenu(false)}>
                <n.icon className="h-4 w-4" aria-hidden />{n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-1">
            <div className="hidden text-left sm:block">
              <div className="text-sm font-semibold">{profile?.full_name}</div>
              <div className="text-[11px] text-signal">{profile && ROLE_LABEL[profile.role]}</div>
            </div>
            <A11yMenu />
            <NotificationsBell />
            <button onClick={signOut} className="rounded-xl p-2 hover:bg-ink-600" aria-label="התנתקות"><LogOut className="h-5 w-5" aria-hidden /></button>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-6 focus:outline-none">
        <Outlet />
        <Footer />
      </main>
    </div>
  )
}
