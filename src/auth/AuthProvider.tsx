import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Division, Profile, Team } from '../lib/types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  divisions: Division[]
  teams: Team[]
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [divisions, setDivisions] = useState<Division[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (s: Session | null) => {
    if (!s) { setProfile(null); setLoading(false); return }
    const [p, d, t] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle(),
      supabase.from('divisions').select('id, name').order('created_at'),
      supabase.from('teams').select('id, division_id, name').order('created_at'),
    ])
    setProfile((p.data as Profile) ?? null)
    setDivisions((d.data as Division[]) ?? [])
    setTeams((t.data as Team[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); load(data.session) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      // defer DB work out of the auth callback (supabase-js recommendation)
      setTimeout(() => load(s), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [load])

  const value: AuthState = {
    session, profile, divisions, teams, loading,
    refreshProfile: () => load(session),
    signOut: async () => { await supabase.auth.signOut(); setProfile(null) },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth outside AuthProvider')
  return v
}

export const canManage = (p: Profile | null) => p?.role === 'division_manager' || p?.role === 'governance'
