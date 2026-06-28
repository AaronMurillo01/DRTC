import { useEffect, useMemo, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import { CATEGORY_META, useStore, visibleEvents } from '../store'
import type { CountryRisk, IntelEvent } from '../types'

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

function riskColor(score: number): string {
  if (score >= 75) return '#f87171'
  if (score >= 55) return '#fb923c'
  if (score >= 38) return '#fbbf24'
  return '#34d399'
}

function countryTooltip(c: CountryRisk): string {
  const col = riskColor(c.score)
  return `
    <div style="font-family:'JetBrains Mono',monospace;background:#0a0e14;border:1px solid ${col};
      border-radius:6px;padding:7px 10px;color:#c7d3df;box-shadow:0 0 16px ${col}44">
      <div style="font-size:11px;font-weight:700">${c.name} · CII ${c.score}</div>
      <div style="font-size:9px;color:#5c6b7a;text-transform:uppercase">${c.drivers.join(' · ')}</div>
    </div>`
}

export default function GlobeView() {
  const globeRef = useRef<any>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 600, h: 600 })

  const events = useStore(visibleEvents)
  const countryRisk = useStore((s) => s.countryRisk)
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

  // Correlation arcs: link the most unstable watch-country to the nearby
  // high-severity live tracks that are driving its score.
  const arcs = useMemo(() => {
    const top = countryRisk[0]
    if (!top) return []
    return located
      .filter((e) => e.category !== 'orbital' && e.severity >= 60)
      .map((e) => ({ e, d: haversineKm(top.lat, top.lng, e.lat!, e.lng!) }))
      .filter((x) => x.d <= 1600)
      .sort((a, b) => b.e.severity - a.e.severity)
      .slice(0, 14)
      .map((x) => ({
        startLat: x.e.lat!,
        startLng: x.e.lng!,
        endLat: top.lat,
        endLng: top.lng,
        color: CATEGORY_META[x.e.category].color,
      }))
  }, [countryRisk, located])

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
        labelsData={countryRisk}
        labelLat={(d: object) => (d as CountryRisk).lat}
        labelLng={(d: object) => (d as CountryRisk).lng}
        labelText={(d: object) => (d as CountryRisk).iso}
        labelColor={(d: object) => riskColor((d as CountryRisk).score)}
        labelSize={(d: object) => 0.6 + ((d as CountryRisk).score / 100) * 0.9}
        labelDotRadius={(d: object) => 0.25 + ((d as CountryRisk).score / 100) * 0.55}
        labelResolution={2}
        labelLabel={(d: object) => countryTooltip(d as CountryRisk)}
        onLabelClick={(d: object) => {
          const c = d as CountryRisk
          globeRef.current?.pointOfView({ lat: c.lat, lng: c.lng, altitude: 1.8 }, 900)
        }}
        arcsData={arcs}
        arcColor={(d: object) => (d as { color: string }).color}
        arcStroke={0.4}
        arcDashLength={0.5}
        arcDashGap={0.25}
        arcDashAnimateTime={1800}
        arcAltitudeAutoScale={0.4}
      />
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

