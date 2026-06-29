import { useStore } from '../store'
import type { FeedSource, SourceStatus as Status } from '../types'
import { timeAgo } from '../utils'

const DOT: Record<Status, string> = {
  online: 'bg-cmd-green',
  degraded: 'bg-cmd-amber',
  offline: 'bg-cmd-red',
  pending: 'bg-cmd-dim animate-flicker',
}

function MiniSpark({ data }: { data: number[] }) {
  if (data.length < 2) return <div className="h-3" />
  const max = Math.max(...data, 1)
  return (
    <div className="flex items-end gap-px h-3">
      {data.slice(-16).map((v, i) => (
        <div
          key={i}
          className="w-0.5 bg-cmd-accent/70 rounded-sm"
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}

export default function SourceStatus() {
  const sources = useStore((s) => s.sources)
  const list = Object.values(sources)
  const online = list.filter((s) => s.status === 'online').length
  const bit: Status = online === list.length ? 'online' : online === 0 ? 'offline' : 'degraded'

  return (
    <div className="panel shrink-0">
      <div className="panel-header">
        <span>System Health</span>
        <span
          className={
            bit === 'online'
              ? 'text-cmd-green'
              : bit === 'offline'
                ? 'text-cmd-red'
                : 'text-cmd-amber'
          }
        >
          {online}/{list.length} NOMINAL
        </span>
      </div>
      <div className="p-2 grid grid-cols-2 gap-1">
        {list.map((s) => (
          <SourceCell key={s.id} s={s} />
        ))}
      </div>
    </div>
  )
}

function SourceCell({ s }: { s: FeedSource }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-cmd-panel2/60 border border-cmd-border/50">
      <span className={`w-2 h-2 rounded-full shrink-0 ${DOT[s.status]}`} />
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[10px] text-cmd-text truncate">{s.label}</div>
        <div className="font-mono text-[8px] text-cmd-dim">
          {s.status === 'offline'
            ? `LINK DOWN · ${s.consecutiveFailures}✕`
            : s.lastSync
              ? `${timeAgo(s.lastSync)} · ${s.latencyMs ?? '–'}ms`
              : 'STANDBY'}
        </div>
      </div>
      <MiniSpark data={s.latencyHistory} />
    </div>
  )
}
