import { useEffect, useState } from 'react'
import { Activity, Bell, Command, HelpCircle, Pause, Play, Radio } from 'lucide-react'
import { useStore } from '../store'
import { utcClock, utcDate } from '../utils'
import ExportMenu from './ExportMenu'

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
  const alerts = useStore((s) => s.alerts)
  const clearAlerts = useStore((s) => s.clearAlerts)
  const viewMode = useStore((s) => s.viewMode)
  const setViewMode = useStore((s) => s.setViewMode)
  const setHelpOpen = useStore((s) => s.setHelpOpen)

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const online = Object.values(sources).filter((s) => s.status === 'online').length
  const total = Object.values(sources).length
  const color = LEVEL_COLOR[threat.level]

  return (
    <header className="shrink-0 h-16 flex items-center justify-between px-3 sm:px-5 border-b border-cmd-border bg-cmd-bg">
      {/* Brand */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
        <div className="relative shrink-0">
          <div className="w-9 h-9 rounded-sm border border-cmd-border flex items-center justify-center">
            <Radio size={17} className="text-cmd-accent" />
          </div>
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cmd-accent ring-2 ring-cmd-bg animate-pulseDot" />
        </div>
        <div className="leading-tight min-w-0">
          <div className="font-mono font-bold tracking-[0.28em] text-cmd-text text-[15px]">
            DRTC
          </div>
          <div className="hidden sm:block font-mono text-[8.5px] text-cmd-dim tracking-[0.2em] uppercase truncate">
            Distributed Real-Time Command &amp; Control
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-5">
        {/* Threat condition */}
        <div className="hidden xl:flex items-center gap-2.5">
          <span className="hidden xl:inline font-mono text-[9px] text-cmd-dim tracking-[0.2em]">
            CONDITION
          </span>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-sm border font-mono"
            style={{ borderColor: `${color}66`, color, background: `${color}12` }}
          >
            <Activity size={13} />
            <span className="text-sm font-bold tracking-wide glow-text">
              {threat.level} · {threat.label}
            </span>
          </div>
        </div>

        {/* Clock */}
        <div className="hidden xl:block text-right leading-tight font-mono border-l border-cmd-border/70 pl-5">
          <div className="text-cmd-text text-sm tracking-[0.15em] tabular-nums">
            {utcClock(now)}
          </div>
          <div className="text-cmd-dim text-[9px] tracking-wide">{utcDate(now)} · UTC</div>
        </div>

        {/* Feed health */}
        <div className="hidden xl:flex items-center gap-1.5 font-mono text-[11px]">
          <span
            className={`w-1.5 h-1.5 rounded-full ${online === total ? 'bg-cmd-green' : online === 0 ? 'bg-cmd-red' : 'bg-cmd-amber'}`}
          />
          <span className="text-cmd-text tabular-nums">{online}</span>
          <span className="text-cmd-dim">/{total} FEEDS</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 border-l border-cmd-border/70 pl-3 sm:pl-5">
          {/* view toggle */}
          <div className="flex items-center p-0.5 rounded-sm border border-cmd-border">
            {(
              [
                ['2d', '2D'],
                ['3d', '3D'],
                ['globe', 'GLB'],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                title={
                  m === '3d' ? '3D terrain map' : m === 'globe' ? 'Stylized globe' : 'Flat map'
                }
                className={`px-3 py-1 rounded-sm font-mono text-[10px] font-bold tracking-wider transition-colors duration-150 ${
                  viewMode === m
                    ? 'bg-cmd-accent text-cmd-bg accent-glow'
                    : 'text-cmd-dim hover:text-cmd-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={clearAlerts}
            title={alerts.length ? 'Clear alerts' : 'No active alerts'}
            className="ctl relative !px-2 hidden sm:flex"
          >
            <Bell size={13} className={alerts.length ? 'text-cmd-red' : ''} />
            {alerts.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] px-0.5 rounded-full bg-cmd-red text-cmd-bg font-mono text-[8px] font-bold flex items-center justify-center ring-2 ring-cmd-bg">
                {alerts.length > 99 ? '99+' : alerts.length}
              </span>
            )}
          </button>

          <button
            onClick={togglePause}
            title={paused ? 'Resume feeds' : 'Pause feeds'}
            className="ctl hidden sm:flex"
          >
            {paused ? <Play size={12} /> : <Pause size={12} />}
            {paused ? 'PAUSED' : 'LIVE'}
          </button>

          <span className="hidden xl:block">
            <ExportMenu />
          </span>

          <button onClick={() => setCommandOpen(true)} title="Command palette" className="ctl">
            <Command size={12} /> <span className="hidden sm:inline">⌘K</span>
          </button>

          <button
            onClick={() => setHelpOpen(true)}
            title="Keyboard & controls (?)"
            className="ctl !px-2 hidden sm:flex"
          >
            <HelpCircle size={13} />
          </button>
        </div>
      </div>
    </header>
  )
}
