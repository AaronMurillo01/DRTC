import { useEffect, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource, type StyleSpecification } from 'maplibre-gl'
import { forward as mgrsForward } from 'mgrs'
import { CATEGORY_META, useStore, visibleEvents } from '../store'
import type { CountryRisk, IntelEvent, ViewMode } from '../types'

interface Coord {
  lat: number
  lng: number
  mgrs: string
}

// Dark basemap from CARTO (free, key-less, CORS-enabled) — © OpenStreetMap © CARTO.
// Terrain DEM is AWS Terrain Tiles (Terrarium encoding, free, key-less).
const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap © CARTO',
    },
    dem: {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 14,
      attribution: 'Terrain: Mapzen / AWS',
    },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#05070a' } },
    { id: 'carto', type: 'raster', source: 'carto', paint: { 'raster-opacity': 0.88 } },
  ],
}

// Apply 2D (flat mercator) vs 3D (globe projection + terrain + tilt).
function applyView(map: maplibregl.Map, mode: ViewMode) {
  if (mode === '3d') {
    map.setProjection({ type: 'globe' })
    if (map.getSource('dem')) map.setTerrain({ source: 'dem', exaggeration: 1.4 })
    map.easeTo({ pitch: 55, zoom: Math.max(map.getZoom(), 2.4), duration: 900 })
  } else {
    map.setTerrain(null)
    map.setProjection({ type: 'mercator' })
    map.easeTo({ pitch: 0, bearing: 0, duration: 700 })
  }
}

function eventsFC(events: IntelEvent[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: events
      .filter((e) => e.lat != null && e.lng != null)
      .map((e) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [e.lng!, e.lat!] },
        properties: {
          id: e.id,
          sev: e.severity,
          color: CATEGORY_META[e.category].color,
          title: e.title,
          summary: e.summary,
          cat: CATEGORY_META[e.category].label,
        },
      })),
  }
}

function riskFC(risk: CountryRisk[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: risk.map((c) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      properties: { score: c.score, name: c.name, drivers: c.drivers.join(' · ') },
    })),
  }
}

const D2R = Math.PI / 180
const R2D = 180 / Math.PI

// Great-circle interpolation between two lon/lat points (for correlation arcs).
function greatCircle(a: [number, number], b: [number, number], n = 48): number[][] {
  const [lon1, lat1] = [a[0] * D2R, a[1] * D2R]
  const [lon2, lat2] = [b[0] * D2R, b[1] * D2R]
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
      ),
    )
  if (d === 0 || Number.isNaN(d)) return [a, b]
  const pts: number[][] = []
  for (let i = 0; i <= n; i++) {
    const f = i / n
    const A = Math.sin((1 - f) * d) / Math.sin(d)
    const B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2)
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2)
    const z = A * Math.sin(lat1) + B * Math.sin(lat2)
    pts.push([Math.atan2(y, x) * R2D, Math.atan2(z, Math.hypot(x, y)) * R2D])
  }
  return pts
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = (bLat - aLat) * D2R
  const dLng = (bLng - aLng) * D2R
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(aLat * D2R) * Math.cos(bLat * D2R) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(s)))
}

// Arcs from the most unstable watch-country to nearby high-severity tracks.
function arcsFC(risk: CountryRisk[], events: IntelEvent[]): GeoJSON.FeatureCollection {
  const top = risk[0]
  const located = events.filter((e) => e.lat != null && e.lng != null && e.severity >= 60)
  if (!top) return { type: 'FeatureCollection', features: [] }
  const features = located
    .map((e) => ({ e, d: haversineKm(top.lat, top.lng, e.lat!, e.lng!) }))
    .filter((x) => x.d <= 1600)
    .sort((a, b) => b.e.severity - a.e.severity)
    .slice(0, 14)
    .map<GeoJSON.Feature>((x) => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: greatCircle([x.e.lng!, x.e.lat!], [top.lng, top.lat]),
      },
      properties: { color: CATEGORY_META[x.e.category].color },
    }))
  return { type: 'FeatureCollection', features }
}

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const readyRef = useRef(false)
  const lastMoveRef = useRef(0)
  const [coord, setCoord] = useState<Coord | null>(null)

  const events = useStore(visibleEvents)
  const risk = useStore((s) => s.countryRisk)
  const select = useStore((s) => s.select)
  const selectedId = useStore((s) => s.selectedId)
  const viewMode = useStore((s) => s.viewMode)

  // Init once.
  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: [12, 25],
      zoom: 1.5,
      attributionControl: { compact: true },
      maxZoom: 16,
      maxPitch: 75,
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')
    popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 })

    map.on('load', () => {
      // Atmospheric sky for the 3D/tilted view.
      map.setSky({
        'sky-color': '#0a1420',
        'horizon-color': '#0d1f2c',
        'fog-color': '#05070a',
        'sky-horizon-blend': 0.5,
        'horizon-fog-blend': 0.5,
        'fog-ground-blend': 0.5,
        'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.8, 6, 0],
      })

      map.addSource('risk', { type: 'geojson', data: riskFC([]) })
      map.addSource('arcs', { type: 'geojson', data: arcsFC([], []) })
      map.addSource('events', { type: 'geojson', data: eventsFC([]) })

      map.addLayer({
        id: 'risk-zone',
        type: 'circle',
        source: 'risk',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'score'], 20, 14, 100, 46],
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'score'],
            30,
            '#34d399',
            50,
            '#fbbf24',
            70,
            '#fb923c',
            85,
            '#f87171',
          ],
          'circle-opacity': 0.12,
          'circle-blur': 0.6,
        },
      })

      map.addLayer({
        id: 'arcs',
        type: 'line',
        source: 'arcs',
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 1.2,
          'line-opacity': 0.55,
          'line-blur': 0.3,
        },
      })

      map.addLayer({
        id: 'events-glow',
        type: 'circle',
        source: 'events',
        filter: ['>=', ['get', 'sev'], 65],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'sev'], 65, 10, 100, 22],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.18,
          'circle-blur': 0.8,
        },
      })

      map.addLayer({
        id: 'events-pt',
        type: 'circle',
        source: 'events',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'sev'], 0, 3, 100, 11],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.9,
          'circle-stroke-color': '#05070a',
          'circle-stroke-width': ['case', ['>=', ['get', 'sev'], 85], 1.5, 0.6],
        },
      })

      map.addLayer({
        id: 'events-sel',
        type: 'circle',
        source: 'events',
        filter: ['==', ['get', 'id'], ''],
        paint: {
          'circle-radius': 14,
          'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-color': '#22d3ee',
          'circle-stroke-width': 2,
        },
      })

      readyRef.current = true
      const st = useStore.getState()
      ;(map.getSource('events') as GeoJSONSource)?.setData(eventsFC(visibleEvents(st)))
      ;(map.getSource('risk') as GeoJSONSource)?.setData(riskFC(st.countryRisk))
      ;(map.getSource('arcs') as GeoJSONSource)?.setData(arcsFC(st.countryRisk, visibleEvents(st)))
      applyView(map, st.viewMode)

      const onEnter = (e: maplibregl.MapLayerMouseEvent) => {
        map.getCanvas().style.cursor = 'pointer'
        const f = e.features?.[0]
        if (!f) return
        const p = f.properties as Record<string, string>
        popupRef.current
          ?.setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(
            `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#c7d3df;max-width:200px">
               <b>${p.title}</b><div style="color:#5c6b7a;font-size:10px">${p.cat} · SEV ${p.sev}</div></div>`,
          )
          .addTo(map)
      }
      const onLeave = () => {
        map.getCanvas().style.cursor = ''
        popupRef.current?.remove()
      }
      map.on('mouseenter', 'events-pt', onEnter)
      map.on('mousemove', 'events-pt', onEnter)
      map.on('mouseleave', 'events-pt', onLeave)
      map.on('click', 'events-pt', (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined
        if (id) select(id)
      })

      // MGRS / lat-lon cursor readout (throttled to ~12fps).
      map.on('mousemove', (e) => {
        const now = performance.now()
        if (now - lastMoveRef.current < 80) return
        lastMoveRef.current = now
        const { lng, lat } = e.lngLat
        let mgrs = 'OUT OF GRID'
        try {
          mgrs = mgrsForward([lng, lat], 4)
        } catch {
          /* polar regions are outside the MGRS grid */
        }
        setCoord({ lat, lng, mgrs })
      })
      map.on('mouseout', () => setCoord(null))
    })

    const ro = new ResizeObserver(() => map.resize())
    ro.observe(containerRef.current)
    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
      readyRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Push event + arc data on change.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    ;(map.getSource('events') as GeoJSONSource)?.setData(eventsFC(events))
    ;(map.getSource('arcs') as GeoJSONSource)?.setData(
      arcsFC(useStore.getState().countryRisk, events),
    )
  }, [events])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    ;(map.getSource('risk') as GeoJSONSource)?.setData(riskFC(risk))
    ;(map.getSource('arcs') as GeoJSONSource)?.setData(arcsFC(risk, useStore.getState().events))
  }, [risk])

  // 2D / 3D projection + terrain switch.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    applyView(map, viewMode)
  }, [viewMode])

  // Selected highlight + fly-to.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    map.setFilter('events-sel', ['==', ['get', 'id'], selectedId ?? ''])
    const ev = events.find((e) => e.id === selectedId)
    if (ev?.lat != null && ev?.lng != null) {
      map.flyTo({ center: [ev.lng, ev.lat], zoom: Math.max(map.getZoom(), 4), speed: 1.2 })
    }
  }, [selectedId, events])

  return (
    <>
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 panel bg-cmd-panel/90 backdrop-blur px-3 py-1 flex items-center gap-3 font-mono text-[10px]">
        <span className="text-cmd-dim">MGRS</span>
        <span className="text-cmd-accent w-44 text-center">{coord ? coord.mgrs : '——'}</span>
        <span className="text-cmd-border">|</span>
        <span className="text-cmd-text w-32 text-center">
          {coord ? `${coord.lat.toFixed(3)}, ${coord.lng.toFixed(3)}` : '——'}
        </span>
      </div>
    </>
  )
}
