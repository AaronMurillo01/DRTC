import { useMemo } from 'react'
import { ExternalLink } from 'lucide-react'
import { CATEGORY_META, useStore, visibleEvents } from '../store'
import { timeAgo } from '../utils'

export default function IntelFeed() {
  const events = useStore(visibleEvents)
  const select = useStore((s) => s.select)
  const selectedId = useStore((s) => s.selectedId)

  const feed = useMemo(() => events.slice(0, 80), [events])

  return (
    <div className="panel flex-1">
      <div className="panel-header">
        <span>◢ Intel Stream</span>
        <span className="text-cmd-accent">{events.length} TRACKS</span>
      </div>
      <div className="overflow-y-auto flex-1 min-h-0">
        {feed.length === 0 && (
          <div className="p-4 text-center text-cmd-dim font-mono text-[11px] animate-flicker">
            ░ ACQUIRING FEEDS ░
          </div>
        )}
        {feed.map((e) => {
          const meta = CATEGORY_META[e.category]
          const sel = e.id === selectedId
          return (
            <button
              key={e.id}
              onClick={() => select(e.id)}
              className={`w-full text-left px-3 py-2 border-b border-cmd-border/60 hover:bg-cmd-panel2 transition-colors ${
                sel ? 'bg-cmd-panel2' : ''
              }`}
              style={sel ? { boxShadow: `inset 3px 0 0 ${meta.color}` } : undefined}
            >
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span
                  className="stat-chip shrink-0"
                  style={{ color: meta.color, borderColor: meta.color + '55' }}
                >
                  {meta.short}
                </span>
                <SevBar sev={e.severity} color={meta.color} />
                <span className="font-mono text-[9px] text-cmd-dim shrink-0 ml-auto">
                  {timeAgo(e.timestamp)}
                </span>
              </div>
              <div className="text-[12px] text-cmd-text font-medium leading-snug truncate">
                {e.title}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-cmd-dim truncate">
                <span className="truncate">{e.summary}</span>
                {e.url && <ExternalLink size={9} className="shrink-0 opacity-60" />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SevBar({ sev, color }: { sev: number; color: string }) {
  return (
    <div className="flex-1 h-1 rounded-full bg-cmd-border overflow-hidden max-w-[80px]">
      <div className="h-full rounded-full" style={{ width: `${sev}%`, background: color }} />
    </div>
  )
}
