import { useEffect, useState } from 'react'
import { Activity, Command, Pause, Play, Radio } from 'lucide-react'
import { useStore } from '../store'
import { utcClock, utcDate } from '../utils'

const LEVEL_COLOR: Record<number, string> = {
  1: '#34d399',
  2: '#a3e635',
  3: '#fbbf24',
  4: '#fb923c',
  5: '#f87171',
}

export default function Header() {
  const [now, setNow] = useState(() => new Date())
  const threat = useStore((s) => s.threat)
  const paused = useStore((s) => s.paused)
  const togglePause = useStore((s) => s.togglePause)
  const setCommandOpen = useStore((s) => s.setCommandOpen)
  const sources = useStore((s) => s.sources)

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const online = Object.values(sources).filter((s) => s.status === 'online').length
  const total = Object.values(sources).length
  const color = LEVEL_COLOR[threat.level]

  return (
    <header className="shrink-0 h-14 border-b border-cmd-border bg-cmd-panel flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-8 h-8 rounded border border-cmd-accent/50 flex items-center justify-center">
            <Radio size={16} className="text-cmd-accent" />
          </div>
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cmd-green animate-flicker" />
        </div>
        <div className="leading-tight">
          <div className="font-mono font-bold tracking-[0.2em] text-cmd-text text-sm">DRTC</div>
          <div className="font-mono text-[9px] text-cmd-dim tracking-wider">
            DISTRIBUTED REAL-TIME COMMAND &amp; CONTROL
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Threat condition */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-cmd-dim tracking-widest">CONDITION</span>
          <div
            className="flex items-center gap-2 px-3 py-1 rounded border font-mono"
            style={{ borderColor: color, color, boxShadow: `0 0 12px ${color}33` }}
          >
            <Activity size={13} />
            <span className="text-sm font-bold glow-text">
              {threat.level} · {threat.label}
            </span>
          </div>
        </div>

        {/* Clock */}
        <div className="text-right leading-tight font-mono">
          <div className="text-cmd-text text-sm tracking-wider">{utcClock(now)}</div>
          <div className="text-cmd-dim text-[9px]">{utcDate(now)} · UTC</div>
        </div>

        {/* Sources */}
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-cmd-green" />
          <span className="text-cmd-text">{online}</span>
          <span className="text-cmd-dim">/{total} FEEDS</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={togglePause}
            title={paused ? 'Resume feeds (Space)' : 'Pause feeds (Space)'}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-cmd-border hover:border-cmd-accent/60 font-mono text-[11px] text-cmd-dim hover:text-cmd-text transition-colors"
          >
            {paused ? <Play size={12} /> : <Pause size={12} />}
            {paused ? 'PAUSED' : 'LIVE'}
          </button>
          <button
            onClick={() => setCommandOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-cmd-border hover:border-cmd-accent/60 font-mono text-[11px] text-cmd-dim hover:text-cmd-text transition-colors"
          >
            <Command size={12} /> ⌘K
          </button>
        </div>
      </div>
    </header>
  )
}
