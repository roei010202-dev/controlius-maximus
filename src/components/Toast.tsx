import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'

type Kind = 'success' | 'error' | 'info'
interface Toast { id: number; kind: Kind; text: string }
const Ctx = createContext<(kind: Kind, text: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((kind: Kind, text: string) => {
    const id = Date.now() + Math.random()
    setItems((x) => [...x, { id, kind, text }])
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), kind === 'error' ? 9000 : 5000)
  }, [])
  const style: Record<Kind, string> = {
    success: 'bg-ok-soft text-ok border-ok/30',
    error: 'bg-danger-soft text-danger border-danger/30',
    info: 'bg-brand-soft text-brand-dark border-brand/30',
  }
  const Icon = { success: CheckCircle2, error: AlertTriangle, info: Info }
  return (
    <Ctx.Provider value={push}>
      {children}
      {/* polite live region so screen readers announce results */}
      <div aria-live="polite" role="status" className="fixed bottom-4 left-4 right-4 z-[60] mx-auto flex max-w-md flex-col gap-2 sm:right-auto">
        {items.map((t) => {
          const I = Icon[t.kind]
          return (
            <div key={t.id} className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-card ${style[t.kind]}`}>
              <I aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1">{t.text}</span>
              <button onClick={() => setItems((x) => x.filter((i) => i.id !== t.id))} aria-label="סגירת הודעה"><X className="h-4 w-4" /></button>
            </div>
          )
        })}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
