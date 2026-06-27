import { useStore } from '../store'
import type { SourceStatus as Status } from '../types'
import { timeAgo } from '../utils'

const DOT: Record<Status, string> = {
  online: 'bg-cmd-green',
  degraded: 'bg-cmd-amber',
  offline: 'bg-cmd-red',
  pending: 'bg-cmd-dim animate-flicker',
}

export default function SourceStatus() {
  const sources = useStore((s) => s.sources)
  const list = Object.values(sources)

  return (
    <div className="panel shrink-0">
      <div className="panel-header">
        <span>◢ Feed Integrity</span>
      </div>
      <div className="p-2 grid grid-cols-2 gap-1">
        {list.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded bg-cmd-panel2/60 border border-cmd-border/50"
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${DOT[s.status]}`} />
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[10px] text-cmd-text truncate">{s.label}</div>
              <div className="font-mono text-[8px] text-cmd-dim">
                {s.status === 'offline'
                  ? 'LINK DOWN'
                  : s.lastSync
                    ? `${timeAgo(s.lastSync)} · ${s.latencyMs ?? '–'}ms`
                    : 'STANDBY'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
