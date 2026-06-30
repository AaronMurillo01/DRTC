import { useEffect, useState } from 'react'
import { Crosshair, TriangleAlert } from 'lucide-react'
import { useStore } from '../store'
import { ALERT_KM } from '../services/conjunctions'

function countdown(ms: number): string {
  const past = ms < 0
  const s = Math.max(0, Math.round(Math.abs(ms) / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  const body = h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
  return `${past ? 'T+' : 'T-'}${body}`
}

function miss(km: number): string {
  if (km >= 1000) return `${(km / 1000).toFixed(1)}k km`
  if (km >= 10) return `${Math.round(km)} km`
  return `${km.toFixed(1)} km`
}

export default function ConjunctionWatch() {
  const conjunctions = useStore((s) => s.conjunctions)
  const trackedSats = useStore((s) => s.trackedSats)

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const alerts = conjunctions.filter((c) => c.alert).length
  const acquiring = conjunctions.length === 0 && trackedSats.length === 0
  const top = conjunctions.slice(0, 8)

  return (
    <div className="panel shrink-0">
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <Crosshair size={11} /> Conjunctions
        </span>
        <span className={`normal-case tracking-normal ${alerts ? 'text-cmd-red' : 'text-cmd-dim'}`}>
          {alerts ? `${alerts} alert${alerts > 1 ? 's' : ''}` : `≤ ${ALERT_KM} km`}
        </span>
      </div>

      {acquiring && (
        <div className="px-2 py-4 text-center font-mono text-[10px] text-cmd-dim animate-pulse">
          screening orbits…
        </div>
      )}
      {!acquiring && top.length === 0 && (
        <div className="px-2 py-4 text-center font-mono text-[10px] text-cmd-dim">
          no approaches in window
        </div>
      )}

      {top.map((c) => (
        <div
          key={c.id}
          className="px-2 py-1.5 border-b border-cmd-border/40 last:border-0"
          style={c.alert ? { boxShadow: 'inset 2px 0 0 #e2574a' } : undefined}
        >
          <div className="flex items-center gap-1.5">
            {c.alert && <TriangleAlert size={11} className="text-cmd-red shrink-0" />}
            <span className="text-[11px] text-cmd-text truncate flex-1">
              {c.aName} <span className="text-cmd-dim">×</span> {c.bName}
            </span>
            <span
              className={`font-mono text-[11px] shrink-0 ${c.alert ? 'text-cmd-red' : 'text-cmd-text'}`}
            >
              {miss(c.missKm)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 font-mono text-[8.5px] text-cmd-dim">
            <span>TCA {countdown(c.tca - now)}</span>
            <span className="text-white/15">·</span>
            <span>Δv {c.relSpeedKmS.toFixed(2)} km/s</span>
            <span className="ml-auto">miss distance</span>
          </div>
        </div>
      ))}

      {!acquiring && top.length > 0 && (
        <div className="px-2 py-1 border-t border-cmd-border font-mono text-[8px] text-cmd-dim">
          SGP4 pairwise screen · 6h horizon · {trackedSats.length} objects
        </div>
      )}
    </div>
  )
}
