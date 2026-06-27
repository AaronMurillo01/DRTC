import { useEffect, useMemo, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import { CATEGORY_META, useStore, visibleEvents } from '../store'
import type { IntelEvent } from '../types'

export default function GlobeView() {
  const globeRef = useRef<any>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 600, h: 600 })

  const events = useStore(visibleEvents)
  const select = useStore((s) => s.select)
  const selectedId = useStore((s) => s.selectedId)

  const located = useMemo(
    () => events.filter((e) => e.lat != null && e.lng != null),
    [events],
  )
  const rings = useMemo(
    () => located.filter((e) => e.severity >= 65 || e.category === 'orbital'),
    [located],
  )

  // Responsive sizing.
  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setDims({ w: Math.max(200, width), h: Math.max(200, height) })
    })
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  // Initial camera + gentle auto-rotation.
  useEffect(() => {
    const g = globeRef.current
    if (!g) return
    g.pointOfView({ lat: 20, lng: 10, altitude: 2.4 }, 0)
    const controls = g.controls()
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.35
    controls.enableDamping = true
  }, [])

  // Fly to selected event.
  useEffect(() => {
    const g = globeRef.current
    if (!g || !selectedId) return
    const ev = located.find((e) => e.id === selectedId)
    if (ev?.lat != null && ev?.lng != null) {
      g.pointOfView({ lat: ev.lat, lng: ev.lng, altitude: 1.6 }, 900)
    }
  }, [selectedId, located])

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <Globe
        ref={globeRef}
        width={dims.w}
        height={dims.h}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        atmosphereColor="#22d3ee"
        atmosphereAltitude={0.2}
        pointsData={located}
        pointLat={(d: object) => (d as IntelEvent).lat!}
        pointLng={(d: object) => (d as IntelEvent).lng!}
        pointColor={(d: object) => CATEGORY_META[(d as IntelEvent).category].color}
        pointAltitude={(d: object) => 0.01 + ((d as IntelEvent).severity / 100) * 0.32}
        pointRadius={(d: object) =>
          (d as IntelEvent).id === selectedId
            ? 0.7
            : 0.18 + ((d as IntelEvent).severity / 100) * 0.4
        }
        pointResolution={6}
        pointLabel={(d: object) => pointTooltip(d as IntelEvent)}
        onPointClick={(d: object) => select((d as IntelEvent).id)}
        ringsData={rings}
        ringLat={(d: object) => (d as IntelEvent).lat!}
        ringLng={(d: object) => (d as IntelEvent).lng!}
        ringColor={(d: object) => {
          const c = CATEGORY_META[(d as IntelEvent).category].color
          return () => c
        }}
        ringMaxRadius={(d: object) => 2 + ((d as IntelEvent).severity / 100) * 4}
        ringPropagationSpeed={1.4}
        ringRepeatPeriod={(d: object) => 1600 - ((d as IntelEvent).severity / 100) * 900}
      />
      <Legend />
    </div>
  )
}

function pointTooltip(e: IntelEvent): string {
  const c = CATEGORY_META[e.category]
  return `
    <div style="font-family:'JetBrains Mono',monospace;background:#0a0e14;border:1px solid ${c.color};
      border-radius:6px;padding:8px 10px;max-width:240px;color:#c7d3df;box-shadow:0 0 16px ${c.color}44">
      <div style="font-size:9px;letter-spacing:.15em;color:${c.color};text-transform:uppercase">
        ${c.label} · SEV ${e.severity}
      </div>
      <div style="font-size:12px;font-weight:700;margin:3px 0">${escapeHtml(e.title)}</div>
      <div style="font-size:10px;color:#5c6b7a">${escapeHtml(e.summary)}</div>
    </div>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
}

function Legend() {
  const active = useStore((s) => s.activeCategories)
  const toggle = useStore((s) => s.toggleCategory)
  const cats = Object.entries(CATEGORY_META).filter(([k]) =>
    ['seismic', 'disaster', 'space', 'orbital', 'signals'].includes(k),
  )
  return (
    <div className="absolute bottom-2 left-2 flex flex-wrap gap-1.5 max-w-[60%]">
      {cats.map(([key, meta]) => {
        const on = active.has(key as never)
        return (
          <button
            key={key}
            onClick={() => toggle(key as never)}
            className="flex items-center gap-1.5 px-2 py-1 rounded border bg-cmd-panel/80 backdrop-blur font-mono text-[9px] uppercase tracking-wider transition-opacity"
            style={{ borderColor: meta.color + '55', opacity: on ? 1 : 0.35 }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
            <span style={{ color: meta.color }}>{meta.short}</span>
          </button>
        )
      })}
    </div>
  )
}
