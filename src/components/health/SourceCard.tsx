import { StatusDot } from '../ui/StatusDot'
import type { FeedSource } from '../../types'
import { timeAgo } from '../../utils'

function LatencySpark({ data }: { data: number[] }) {
  if (data.length < 2) return <div className="h-3 w-10" />
  const max = Math.max(...data, 1)
  return (
    <div className="flex items-end gap-px h-3" aria-hidden>
      {data.slice(-14).map((v, i) => (
        <div
          key={i}
          className="w-0.5 rounded-sm bg-cmd-accent/60"
          style={{ height: `${Math.max(10, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}

function statusLine(s: FeedSource): { text: string; tone: string } {
  if (s.status === 'offline')
    return { text: `link down · ${s.consecutiveFailures}×`, tone: 'text-cmd-red/80' }
  if (!s.lastSync) return { text: 'standby', tone: 'text-cmd-dim' }
  const latency = s.latencyMs != null ? `${s.latencyMs}ms` : '–'
  return { text: `${timeAgo(s.lastSync)} · ${latency}`, tone: 'text-cmd-dim' }
}

/** One feed's health as a self-contained card. */
export function SourceCard({ s }: { s: FeedSource }) {
  const line = statusLine(s)
  return (
    <div className="flex flex-col gap-1.5 rounded-sm border border-cmd-border/60 bg-cmd-panel2/30 px-2.5 py-2 transition-colors hover:border-cmd-border">
      <div className="flex items-center gap-2">
        <StatusDot status={s.status} ring />
        <span className="flex-1 truncate text-[11px] font-medium leading-none text-cmd-text">
          {s.label}
        </span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className={`font-mono text-[9px] tabular-nums ${line.tone}`}>{line.text}</span>
        <LatencySpark data={s.latencyHistory} />
      </div>
    </div>
  )
}
