import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'

export default function NotFound({ title = 'העמוד לא נמצא', text = 'ייתכן שהקישור שגוי או שהעמוד הוסר.' }: { title?: string; text?: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-20 text-center">
      <div aria-hidden className="rounded-full bg-signal-soft p-4"><Compass className="h-8 w-8" /></div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted">{text}</p>
      <Link to="/" className="mt-2 font-semibold text-brand hover:underline">חזרה למסך הראשי</Link>
    </div>
  )
}
