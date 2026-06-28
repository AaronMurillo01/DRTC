import { AlertTriangle, X } from 'lucide-react'
import { CATEGORY_META, useStore } from '../store'
import { timeAgo } from '../utils'

export default function AlertsOverlay() {
  const alerts = useStore((s) => s.alerts)
  const dismiss = useStore((s) => s.dismissAlert)
  const select = useStore((s) => s.select)

  const recent = alerts.slice(0, 4)
  if (!recent.length) return null

  return (
    <div className="fixed bottom-10 right-3 z-40 flex flex-col gap-2 w-80 max-w-[90vw]">
      {recent.map((a) => {
        const meta = CATEGORY_META[a.category]
        return (
          <div
            key={a.id}
            className="panel bg-cmd-panel/95 backdrop-blur animate-[slidein_.25s_ease-out]"
            style={{ borderColor: '#f8717188', boxShadow: '0 0 24px rgba(248,113,113,0.25)' }}
          >
            <div className="flex items-start gap-2 p-2.5">
              <AlertTriangle size={15} className="text-cmd-red shrink-0 mt-0.5 animate-flicker" />
              <button onClick={() => select(a.eventId)} className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2">
                  <span
                    className="stat-chip"
                    style={{ color: meta.color, borderColor: meta.color + '55' }}
                  >
                    {meta.short}
                  </span>
                  <span className="font-mono text-[9px] text-cmd-red">
                    CRITICAL · SEV {a.severity}
                  </span>
                  <span className="font-mono text-[8px] text-cmd-dim ml-auto">{timeAgo(a.ts)}</span>
                </div>
                <div className="text-[11px] text-cmd-text font-medium mt-1 truncate">{a.title}</div>
                <div className="text-[10px] text-cmd-dim truncate">{a.summary}</div>
              </button>
              <button
                onClick={() => dismiss(a.id)}
                className="text-cmd-dim hover:text-cmd-text shrink-0"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )
      })}
      <style>{`@keyframes slidein{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
    </div>
  )
}
