import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './auth/AuthProvider'
import Layout from './components/Layout'
import { Spinner } from './components/ui'
import type { Role } from './lib/types'
import { isConfigured } from './lib/supabase'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Approvals from './pages/Approvals'
import Control from './pages/Control'
import AgentDetail from './pages/AgentDetail'
import ActionLog from './pages/ActionLog'
import Incidents from './pages/Incidents'
import Governance from './pages/Governance'
import { Accessibility, Privacy } from './pages/Legal'
import NotFound from './pages/NotFound'

function Protected({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { session, profile, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <Spinner />
  if (!session) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  if (!profile) return <Spinner label="מכין את החשבון…" />
  if (!profile.is_active) return <NotFound title="החשבון הושבת" text="פנה/י ל-Governance בארגון כדי להפעיל אותו מחדש." />
  if (!profile.onboarded && loc.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />
  // UI guard only — the database enforces the same rules with RLS.
  if (roles && !roles.includes(profile.role)) return <NotFound title="אין לך הרשאה למסך הזה" text="המסך מיועד לתפקיד אחר. אם זו טעות, פנה/י ל-Governance." />
  return <>{children}</>
}

function Home() {
  const { profile } = useAuth()
  return <Navigate to={profile?.role === 'approver' ? '/approvals' : '/control'} replace />
}

export default function App() {
  if (!isConfigured) {
    return <NotFound title="המערכת עדיין לא מוגדרת" text="חסרים משתני הסביבה VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY." />
  }
  const managers: Role[] = ['division_manager', 'governance']
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/accessibility" element={<Accessibility />} />
      <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<Home />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="control" element={<Protected roles={managers}><Control /></Protected>} />
        <Route path="agents/:id" element={<Protected roles={managers}><AgentDetail /></Protected>} />
        <Route path="log" element={<Protected roles={managers}><ActionLog /></Protected>} />
        <Route path="incidents" element={<Protected roles={managers}><Incidents /></Protected>} />
        <Route path="governance" element={<Protected roles={['governance']}><Governance /></Protected>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
