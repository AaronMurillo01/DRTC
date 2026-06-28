import { useEffect, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource, type StyleSpecification } from 'maplibre-gl'
import { forward as mgrsForward } from 'mgrs'
import { CATEGORY_META, useStore, visibleEvents } from '../store'
import type { CountryRisk, IntelEvent } from '../types'

interface Coord {
  lat: number
  lng: number
  mgrs: string
}

// Dark basemap from CARTO (free, key-less, CORS-enabled) — © OpenStreetMap © CARTO.
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
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#05070a' } },
    { id: 'carto', type: 'raster', source: 'carto', paint: { 'raster-opacity': 0.85 } },
  ],
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

  // Init once.
  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: [12, 25],
      zoom: 1.4,
      attributionControl: { compact: true },
      maxZoom: 12,
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
    popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 })

    map.on('load', () => {
      map.addSource('risk', { type: 'geojson', data: riskFC([]) })
      map.addSource('events', { type: 'geojson', data: eventsFC([]) })

      // Instability "zones" — translucent fills scaled by score.
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

      // Severity glow under high-alert tracks.
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

      // Main tracks.
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

      // Selected highlight ring.
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
      ;(map.getSource('events') as GeoJSONSource)?.setData(
        eventsFC(visibleEvents(useStore.getState())),
      )
      ;(map.getSource('risk') as GeoJSONSource)?.setData(riskFC(useStore.getState().countryRisk))

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

  // Push event + risk data on change.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    ;(map.getSource('events') as GeoJSONSource)?.setData(eventsFC(events))
  }, [events])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    ;(map.getSource('risk') as GeoJSONSource)?.setData(riskFC(risk))
  }, [risk])

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
