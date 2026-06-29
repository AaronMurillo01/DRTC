import { useEffect, useMemo, useState } from 'react'
import { Radio, Satellite, ShieldCheck, X } from 'lucide-react'
import { useStore } from '../store'
import { GROUND_OPERATORS } from '../services/groundstations'
import type { ContactWindow } from '../types'

function countdown(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

function clockZ(ts: number): string {
  return new Date(ts).toISOString().slice(11, 16) + 'Z'
}

function dur(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function vol(mb: number): string {
  if (mb >= 1000) return `${(mb / 1000).toFixed(1)} GB`
  if (mb >= 1) return `${Math.round(mb)} MB`
  return `${(mb * 1000).toFixed(0)} kB`
}

export default function GroundSegment() {
  const passes = useStore((s) => s.passes)
  const satPositions = useStore((s) => s.satPositions)
  const stations = useStore((s) => s.groundStations)
  const trackedSats = useStore((s) => s.trackedSats)
  const selectedStationId = useStore((s) => s.selectedStationId)
  const selectStation = useStore((s) => s.selectStation)

  // Tick once per second so the AOS/LOS countdowns stay live.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const station = stations.find((s) => s.id === selectedStationId) ?? null

  const scoped = useMemo(
    () => (station ? passes.filter((p) => p.stationId === station.id) : passes),
    [passes, station],
  )

  const active = useMemo(
    () => scoped.filter((p) => now >= p.aos && now <= p.los).sort((a, b) => a.los - b.los),
    [scoped, now],
  )
  const upcoming = useMemo(() => scoped.filter((p) => p.aos > now).slice(0, 30), [scoped, now])
  const nextAos = upcoming[0]

  const acquiring = passes.length === 0 && trackedSats.length === 0

  return (
    <div className="panel shrink-0">
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <Radio size={11} /> Ground Segment
        </span>
        <span className="text-cmd-dim normal-case tracking-normal">
          {GROUND_OPERATORS.length} networks
        </span>
      </div>

      {/* Network summary strip */}
      <div className="grid grid-cols-4 divide-x divide-cmd-border border-b border-cmd-border">
        <Stat label="STATIONS" value={String(stations.length)} />
        <Stat label="BIRDS" value={String(satPositions.length || trackedSats.length)} />
        <Stat label="LIVE" value={String(active.length)} accent={active.length > 0} />
        <Stat label="NEXT AOS" value={nextAos ? `T-${countdown(nextAos.aos - now)}` : '—'} />
      </div>

      {/* Station filter chip */}
      {station && (
        <div className="flex items-center justify-between px-2 py-1 border-b border-cmd-border bg-cmd-accent/5">
          <span className="font-mono text-[9px] text-cmd-accent uppercase tracking-wider truncate">
            ▸ {station.name} · {station.operator}
          </span>
          <button
            onClick={() => selectStation(null)}
            className="text-cmd-dim hover:text-cmd-text shrink-0"
            title="Clear station filter"
          >
            <X size={11} />
          </button>
        </div>
      )}

      {/* Active contacts */}
      {active.length > 0 && (
        <div className="border-b border-cmd-border">
          <div className="px-2 pt-1.5 pb-0.5 font-mono text-[8px] uppercase tracking-[0.2em] text-cmd-green">
            ● In Contact
          </div>
          {active.map((p) => (
            <ContactRow key={p.id} p={p} now={now} live />
          ))}
        </div>
      )}

      {/* Upcoming schedule */}
      <div className="max-h-64 overflow-y-auto">
        <div className="px-2 pt-1.5 pb-0.5 font-mono text-[8px] uppercase tracking-[0.2em] text-cmd-dim">
          Pass Schedule · 12h
        </div>
        {acquiring && (
          <div className="px-2 py-4 text-center font-mono text-[10px] text-cmd-dim animate-pulse">
            propagating orbits…
          </div>
        )}
        {!acquiring && upcoming.length === 0 && (
          <div className="px-2 py-4 text-center font-mono text-[10px] text-cmd-dim">
            no passes in window
          </div>
        )}
        {upcoming.map((p) => (
          <ContactRow key={p.id} p={p} now={now} />
        ))}
      </div>

      {/* COMSEC posture — nods to the encrypted, CCSDS-framed link */}
      <div className="flex items-center gap-1.5 px-2 py-1 border-t border-cmd-border font-mono text-[8px] text-cmd-dim">
        <ShieldCheck size={10} className="text-cmd-green" />
        <span className="text-cmd-green">COMSEC AES-256</span>
        <span className="text-white/15">·</span>
        <span>CCSDS AOS</span>
        <span className="text-white/15">·</span>
        <span>KEY OK</span>
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="px-1.5 py-1.5 text-center">
      <div
        className={`font-mono text-[13px] leading-none ${accent ? 'text-cmd-green' : 'text-cmd-text'}`}
      >
        {value}
      </div>
      <div className="font-mono text-[7px] text-cmd-dim tracking-wider mt-1">{label}</div>
    </div>
  )
}

function ContactRow({ p, now, live }: { p: ContactWindow; now: number; live?: boolean }) {
  const select = useStore((s) => s.selectStation)
  const t = live ? p.los - now : p.aos - now
  return (
    <button
      onClick={() => select(p.stationId)}
      className="w-full text-left px-2 py-1.5 border-b border-cmd-border/40 last:border-0 hover:bg-cmd-panel2 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Satellite
          size={11}
          className={live ? 'text-cmd-green shrink-0' : 'text-cmd-dim shrink-0'}
        />
        <span className="text-[11px] text-cmd-text font-medium truncate flex-1">{p.satName}</span>
        <span
          className={`font-mono text-[10px] shrink-0 ${live ? 'text-cmd-green' : 'text-cmd-accent'}`}
        >
          {live ? `LOS T-${countdown(t)}` : `T-${countdown(t)}`}
        </span>
      </div>
      <div className="flex items-center gap-1.5 mt-0.5 pl-[19px] font-mono text-[8.5px] text-cmd-dim">
        <span className="truncate max-w-[120px]">{p.stationName}</span>
        <span className="text-white/15">·</span>
        <span>EL {Math.round(p.maxElevationDeg)}°</span>
        <span className="text-white/15">·</span>
        <span>{p.band}-band</span>
        <span className="ml-auto shrink-0">
          {clockZ(p.aos)} · {dur(p.durationSec)} · {vol(p.volumeMb)}
        </span>
      </div>
    </button>
  )
}
