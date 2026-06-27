import { useMemo } from 'react'
import { useStore } from '../store'
import { CATEGORY_META } from '../store'
import { timeAgo } from '../utils'

export default function StatusBar() {
  const events = useStore((s) => s.events)
  const lastTick = useStore((s) => s.lastTick)
  const paused = useStore((s) => s.paused)

  const marquee = useMemo(() => {
    const hot = [...events].sort((a, b) => b.severity - a.severity).slice(0, 14)
    return hot
  }, [events])

  return (
    <footer className="shrink-0 h-7 border-t border-cmd-border bg-cmd-panel flex items-center text-[10px] font-mono overflow-hidden">
      <div className="flex items-center gap-2 px-3 border-r border-cmd-border shrink-0 text-cmd-dim">
        <span className={`w-1.5 h-1.5 rounded-full ${paused ? 'bg-cmd-amber' : 'bg-cmd-green animate-flicker'}`} />
        {paused ? 'FEEDS HELD' : 'STREAMING'}
      </div>
      <div className="flex-1 overflow-hidden relative">
        <div className="flex items-center gap-6 whitespace-nowrap px-4 animate-[marquee_60s_linear_infinite] hover:[animation-play-state:paused]">
          {marquee.concat(marquee).map((e, i) => {
            const meta = CATEGORY_META[e.category]
            return (
              <span key={e.id + i} className="flex items-center gap-1.5 text-cmd-dim">
                <span style={{ color: meta.color }}>●</span>
                <span style={{ color: meta.color }}>{meta.short}</span>
                <span className="text-cmd-text">{e.title}</span>
                <span className="text-cmd-dim">[{e.severity}]</span>
              </span>
            )
          })}
        </div>
      </div>
      <div className="px-3 border-l border-cmd-border shrink-0 text-cmd-dim">
        SYNC {lastTick ? timeAgo(lastTick) : '–'} AGO
      </div>
      <style>{`@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
    </footer>
  )
}
