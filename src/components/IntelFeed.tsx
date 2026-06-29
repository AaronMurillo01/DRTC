import { useMemo } from 'react'
import { ExternalLink, Search } from 'lucide-react'
import { CATEGORY_META, STATIC_CATEGORIES, useFeedEvents, useStore } from '../store'
import { severityColor, timeAgo } from '../utils'

export default function IntelFeed() {
  const events = useFeedEvents()
  const select = useStore((s) => s.select)
  const selectedId = useStore((s) => s.selectedId)
  const query = useStore((s) => s.query)
  const setQuery = useStore((s) => s.setQuery)
  const minSeverity = useStore((s) => s.minSeverity)
  const setMinSeverity = useStore((s) => s.setMinSeverity)
  const sources = useStore((s) => s.sources)

  // Distinguish acquiring vs. offline vs. nothing-matches-filters.
  const phase = useMemo(() => {
    // Only the live (non-reference) feeds determine acquiring/offline state.
    const live = Object.values(sources).filter((s) => !STATIC_CATEGORIES.has(s.category))
    const anyPending = live.some((s) => s.status === 'pending')
    const allDown = live.length > 0 && live.every((s) => s.status === 'offline')
    if (events.length === 0 && anyPending) return 'acquiring'
    if (events.length === 0 && allDown) return 'offline'
    return 'ready'
  }, [sources, events.length])

  const feed = useMemo(() => {
    const q = query.toLowerCase().trim()
    const filtered = q
      ? events.filter((e) =>
          `${e.title} ${e.summary} ${e.region ?? ''} ${e.source}`.toLowerCase().includes(q),
        )
      : events
    return filtered.slice(0, 80)
  }, [events, query])

  return (
    <div className="panel flex-1 min-h-[420px] xl:min-h-0">
      <div className="panel-header">
        <span>Intel Stream</span>
        <span className="text-cmd-accent">{feed.length} TRACKS</span>
      </div>
      <div className="px-2 py-1.5 border-b border-cmd-border space-y-1.5 shrink-0">
        <div className="flex items-center gap-1.5 bg-cmd-panel2/60 rounded px-2 py-1 border border-cmd-border/50">
          <Search size={11} className="text-cmd-dim shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter tracks…"
            className="flex-1 bg-transparent outline-none font-mono text-[11px] text-cmd-text placeholder:text-cmd-dim min-w-0"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-cmd-dim hover:text-cmd-text font-mono text-[10px]"
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-cmd-dim tracking-wider shrink-0">MIN SEV</span>
          <input
            type="range"
            min={0}
            max={90}
            step={5}
            value={minSeverity}
            onChange={(e) => setMinSeverity(Number(e.target.value))}
            className="flex-1 accent-cmd-accent h-1"
          />
          <span className="font-mono text-[10px] text-cmd-text w-6 text-right shrink-0">
            {minSeverity}
          </span>
        </div>
      </div>
      <div className="overflow-y-auto flex-1 min-h-0">
        {feed.length === 0 && (
          <div className="p-6 text-center font-mono text-[11px]">
            {phase === 'acquiring' && (
              <div className="space-y-2 animate-pulse">
                <div className="text-cmd-dim">Acquiring feeds…</div>
                <div className="mx-auto h-1 w-24 rounded-sm bg-cmd-accent/30 overflow-hidden">
                  <div className="h-full w-1/2 bg-cmd-accent/80 animate-sweep" />
                </div>
              </div>
            )}
            {phase === 'offline' && (
              <div className="text-cmd-red">All feeds offline. Check your connection.</div>
            )}
            {phase === 'ready' && (
              <div className="text-cmd-dim">No tracks match the current filters.</div>
            )}
          </div>
        )}
        {feed.map((e) => {
          const meta = CATEGORY_META[e.category]
          const sel = e.id === selectedId
          const sevColor = severityColor(e.severity)
          return (
            <button
              key={e.id}
              onClick={() => select(e.id)}
              className={`w-full text-left px-3 py-2 border-b border-cmd-border/60 hover:bg-cmd-panel2 transition-colors ${
                sel ? 'bg-cmd-panel2' : ''
              }`}
              style={sel ? { boxShadow: `inset 2px 0 0 ${sevColor}` } : undefined}
            >
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="stat-chip shrink-0 text-cmd-dim border-cmd-border">
                  {meta.short}
                </span>
                <SevBar sev={e.severity} color={sevColor} />
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
    <div className="flex-1 h-1 rounded-sm bg-cmd-border overflow-hidden max-w-[80px]">
      <div className="h-full rounded-sm" style={{ width: `${sev}%`, background: color }} />
    </div>
  )
}
