import { useState } from 'react'
import { OctagonX } from 'lucide-react'
import { callFunction } from '../lib/supabase'
import { Button, Field, Modal, Textarea } from './ui'
import { useToast } from './Toast'

/** Kill switch: suspends the agent (business process #2). */
export default function KillSwitch({ processId, processName, onDone, compact }:
  { processId: string; processName: string; onDone: () => void; compact?: boolean }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    const r = reason.trim()
    if (r.length < 5) { setErr('חובה לכתוב סיבה (לפחות 5 תווים)'); return }
    setBusy(true)
    try {
      const res = await callFunction<{ calendar_status: string; ai_status: string; warning: string | null }>('incident', { action: 'open', process_id: processId, reason: r })
      toast('success', `הסוכן "${processName}" הושעה. בקשות ממתינות הוקפאו ונפתחה תקרית.`)
      if (res.warning) toast('error', res.warning)
      else if (res.calendar_status === 'created') toast('info', 'נקבעה פגישת תחקיר ביומן Google')
      setOpen(false); setReason(''); onDone()
    } catch (e) {
      toast('error', (e as Error).message)
    } finally { setBusy(false) }
  }

  return (
    <>
      <Button variant="danger" onClick={() => { setOpen(true); setErr(null) }} className={compact ? 'min-h-[36px] px-3 text-xs' : ''}
        aria-label={`Kill switch — השעיית הסוכן ${processName}`}>
        <OctagonX aria-hidden className="h-4 w-4" />Kill switch
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`השעיית הסוכן: ${processName}`}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>ביטול</Button><Button variant="danger" loading={busy} onClick={run}>השעיה מיידית</Button></>}>
        <ul className="mb-4 list-disc space-y-1 ps-5 text-sm">
          <li>הסוכן יפסיק לבצע פעולות מיד.</li>
          <li>כל הבקשות שממתינות לאישור יוקפאו.</li>
          <li>תיפתח תקרית עם סיכום AI, ותיקבע פגישת תחקיר ב-Google Calendar.</li>
          <li>רק Governance יוכל להחזיר את הסוכן לפעילות.</li>
        </ul>
        <Field label="סיבת ההשעיה" required error={err} help="תופיע בתקרית, בסיכום ה-AI ובזימון ליומן.">
          {({ id, describedBy, invalid }) => (
            <Textarea id={id} rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid}
              placeholder="לדוגמה: הסוכן אישר פיצויים חריגים ברצף" />
          )}
        </Field>
      </Modal>
    </>
  )
}
