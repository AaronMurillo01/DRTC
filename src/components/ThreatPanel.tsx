import { useMemo } from 'react'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { CATEGORY_META, useStore } from '../store'
import type { EventCategory } from '../types'

const RING_COLOR: Record<number, string> = {
  1: '#34d399',
  2: '#a3e635',
  3: '#fbbf24',
  4: '#fb923c',
  5: '#f87171',
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const w = 100
  const h = 24
  const max = Math.max(100, ...data)
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-6">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export default function ThreatPanel() {
  const threat = useStore((s) => s.threat)
  const events = useStore((s) => s.events)
  const history = useStore((s) => s.threatHistory)
  const color = RING_COLOR[threat.level]

  const breakdown = useMemo(() => {
    const counts = new Map<EventCategory, number>()
    for (const e of events) counts.set(e.category, (counts.get(e.category) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [events])

  const r = 42
  const circ = 2 * Math.PI * r
  const dash = (threat.index / 100) * circ

  const Trend = threat.trend === 'up' ? TrendingUp : threat.trend === 'down' ? TrendingDown : Minus

  return (
    <div className="panel shrink-0">
      <div className="panel-header">
        <span>◢ Global Threat Index</span>
        <Trend
          size={13}
          className={
            threat.trend === 'up'
              ? 'text-cmd-red'
              : threat.trend === 'down'
                ? 'text-cmd-green'
                : 'text-cmd-dim'
          }
        />
      </div>
      <div className="p-3 flex items-center gap-4">
        <div className="relative shrink-0">
          <svg width="104" height="104" className="-rotate-90">
            <circle cx="52" cy="52" r={r} fill="none" stroke="#1b2430" strokeWidth="7" />
            <circle
              cx="52"
              cy="52"
              r={r}
              fill="none"
              stroke={color}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
              style={{
                filter: `drop-shadow(0 0 6px ${color})`,
                transition: 'stroke-dasharray .6s',
              }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-2xl font-bold" style={{ color }}>
              {threat.index}
            </span>
            <span className="font-mono text-[8px] text-cmd-dim tracking-widest">/ 100</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[9px] text-cmd-dim tracking-widest mb-1">CONDITION</div>
          <div className="font-mono text-lg font-bold" style={{ color }}>
            {threat.level} · {threat.label}
          </div>
          <div className="mt-2 space-y-1">
            {breakdown.slice(0, 4).map(([cat, n]) => {
              const meta = CATEGORY_META[cat]
              return (
                <div key={cat} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
                  <span className="font-mono text-[9px] text-cmd-dim flex-1">{meta.label}</span>
                  <span className="font-mono text-[10px] text-cmd-text">{n}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className="px-3 pb-2 -mt-1">
        <div className="flex items-center justify-between font-mono text-[8px] text-cmd-dim mb-0.5">
          <span>INDEX HISTORY</span>
          <span>{history.length} pts</span>
        </div>
        <Sparkline data={history} color={color} />
      </div>
    </div>
  )
}
