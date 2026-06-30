import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource } from 'maplibre-gl'
import { forward as mgrsForward } from 'mgrs'
import { Cloud, CloudRain, Flame, Moon, Orbit, Radio, Ruler, Satellite } from 'lucide-react'
import { useStore, useVisibleEvents, visibleEvents } from '../store'
import { STYLE, applyView } from './map/mapStyle'
import { addDataLayers } from './map/layers'
import {
  eventsFC,
  riskFC,
  arcsFC,
  terminatorFC,
  groundStationsFC,
  satellitesFC,
  contactsFC,
  conjunctionsFC,
} from './map/sources'
import { MapToolbar, type MapTool } from './map/MapToolbar'
import { fetchRadarTemplate, fetchCloudsTemplate } from '../services/radar'
import { activeContacts } from '../services/passes'
import { bearing, haversineKm } from '../services/geo'

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const orbitRef = useRef<number | null>(null)
  const draggingRef = useRef(false)
  const readyRef = useRef(false)
  const lastMoveRef = useRef(0)
  const rulerRef = useRef(false)
  const [satellite, setSatellite] = useState(false)
  const [heatmap, setHeatmap] = useState(false)
  const [night, setNight] = useState(false)
  const [orbit, setOrbit] = useState(false)
  const [radar, setRadar] = useState(false)
  const [clouds, setClouds] = useState(false)
  const [ruler, setRuler] = useState(false)
  const [ground, setGround] = useState(true)
  const [measurePts, setMeasurePts] = useState<[number, number][]>([])

  const events = useVisibleEvents()
  const risk = useStore((s) => s.countryRisk)
  const select = useStore((s) => s.select)
  const selectedId = useStore((s) => s.selectedId)
  const viewMode = useStore((s) => s.viewMode)
  const issTrail = useStore((s) => s.issTrail)
  const groundStations = useStore((s) => s.groundStations)
  const passes = useStore((s) => s.passes)
  const conjunctions = useStore((s) => s.conjunctions)
  const satPositions = useStore((s) => s.satPositions)
  const selectedStationId = useStore((s) => s.selectedStationId)
  const selectStation = useStore((s) => s.selectStation)

  rulerRef.current = ruler

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
      // allow exporting the canvas as a PNG (valid at runtime; not in v5 types)
      preserveDrawingBuffer: true,
    } as maplibregl.MapOptions)
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')
    popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 })

    map.on('load', () => {
      map.setSky({
        'sky-color': '#0c0c0e',
        'horizon-color': '#161618',
        'fog-color': '#070707',
        'sky-horizon-blend': 0.5,
        'horizon-fog-blend': 0.5,
        'fog-ground-blend': 0.5,
        'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.7, 6, 0],
      })
      addDataLayers(map)
      readyRef.current = true

      const st = useStore.getState()
      ;(map.getSource('events') as GeoJSONSource)?.setData(eventsFC(visibleEvents(st)))
      ;(map.getSource('risk') as GeoJSONSource)?.setData(riskFC(st.countryRisk))
      ;(map.getSource('arcs') as GeoJSONSource)?.setData(arcsFC(st.countryRisk, visibleEvents(st)))

      // Ground segment overlay (initial paint + default-on visibility).
      const active0 = activeContacts(st.passes, Date.now())
      const activeIds0 = new Set(active0.map((p) => p.stationId))
      ;(map.getSource('gstations') as GeoJSONSource)?.setData(
        groundStationsFC(st.groundStations, activeIds0, st.selectedStationId),
      )
      ;(map.getSource('satellites') as GeoJSONSource)?.setData(satellitesFC(st.satPositions))
      ;(map.getSource('contacts') as GeoJSONSource)?.setData(
        contactsFC(active0, st.satPositions, st.groundStations),
      )
      ;(map.getSource('conjunctions') as GeoJSONSource)?.setData(
        conjunctionsFC(st.conjunctions, st.satPositions),
      )
      const gndVis = ground ? 'visible' : 'none'
      for (const id of [
        'gs-ring',
        'gs-pt',
        'sat-pt',
        'contact-line',
        'conjunction-line',
        'conjunction-flag',
      ]) {
        map.setLayoutProperty(id, 'visibility', gndVis)
      }
      applyView(map, st.viewMode)

      const showPopup = (e: maplibregl.MapLayerMouseEvent) => {
        map.getCanvas().style.cursor = 'pointer'
        const f = e.features?.[0]
        if (!f) return
        const p = f.properties as Record<string, string>
        popupRef.current
          ?.setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(
            `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#f3f4f5;max-width:200px">
               <b>${p.title}</b><div style="color:#71747a;font-size:10px">${p.cat} · SEV ${p.sev}</div></div>`,
          )
          .addTo(map)
      }
      map.on('mouseenter', 'events-pt', showPopup)
      map.on('mousemove', 'events-pt', showPopup)
      map.on('mouseleave', 'events-pt', () => {
        map.getCanvas().style.cursor = ''
        popupRef.current?.remove()
      })
      // Click a track to select it; click it again to deselect.
      // (Suppressed while the ruler tool is active.)
      map.on('click', 'events-pt', (e) => {
        if (rulerRef.current) return
        const id = e.features?.[0]?.properties?.id as string | undefined
        if (!id) return
        const current = useStore.getState().selectedId
        select(current === id ? null : id)
      })
      // Ground-station hover + click (select to filter the schedule).
      const showGsPopup = (e: maplibregl.MapLayerMouseEvent) => {
        map.getCanvas().style.cursor = 'pointer'
        const f = e.features?.[0]
        if (!f) return
        const p = f.properties as Record<string, string>
        popupRef.current
          ?.setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(
            `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#f3f4f5;max-width:200px">
               <b>${p.name}</b><div style="color:#71747a;font-size:10px">${p.operator} · ground station</div></div>`,
          )
          .addTo(map)
      }
      map.on('mouseenter', 'gs-pt', showGsPopup)
      map.on('mousemove', 'gs-pt', showGsPopup)
      map.on('mouseleave', 'gs-pt', () => {
        map.getCanvas().style.cursor = ''
        popupRef.current?.remove()
      })
      map.on('click', 'gs-pt', (e) => {
        if (rulerRef.current) return
        const id = e.features?.[0]?.properties?.id as string | undefined
        if (!id) return
        const current = useStore.getState().selectedStationId
        selectStation(current === id ? null : id)
      })

      // Ruler adds vertices; otherwise empty-map click clears the selection.
      map.on('click', (e) => {
        if (rulerRef.current) {
          const { lng, lat } = e.lngLat
          setMeasurePts((pts) => [...pts, [lng, lat]])
          return
        }
        const hits = map.queryRenderedFeatures(e.point, { layers: ['events-pt'] })
        if (!hits.length) select(null)
      })

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
        useStore.getState().setCursor({ lat, lng, mgrs })
      })
      map.on('mouseout', () => useStore.getState().setCursor(null))
      map.on('dragstart', () => (draggingRef.current = true))
      map.on('dragend', () => (draggingRef.current = false))
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

  // Data updates.
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
    // Use the same filtered view as the events effect so arcs stay consistent.
    ;(map.getSource('arcs') as GeoJSONSource)?.setData(
      arcsFC(risk, visibleEvents(useStore.getState())),
    )
  }, [risk])

  useEffect(() => {
    const map = mapRef.current
    if (map && readyRef.current) applyView(map, viewMode)
  }, [viewMode])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    map.setLayoutProperty('satellite', 'visibility', satellite ? 'visible' : 'none')
    map.setLayoutProperty('carto', 'visibility', satellite ? 'none' : 'visible')
  }, [satellite])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    map.setLayoutProperty('events-heat', 'visibility', heatmap ? 'visible' : 'none')
    map.setLayoutProperty('events-glow', 'visibility', heatmap ? 'none' : 'visible')
  }, [heatmap])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    map.setLayoutProperty('terminator-fill', 'visibility', night ? 'visible' : 'none')
    if (!night) return
    const refresh = () =>
      (map.getSource('terminator') as GeoJSONSource)?.setData(terminatorFC(new Date()))
    refresh()
    const t = window.setInterval(refresh, 60_000)
    return () => window.clearInterval(t)
  }, [night])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!orbit) {
      if (orbitRef.current) cancelAnimationFrame(orbitRef.current)
      orbitRef.current = null
      return
    }
    const step = () => {
      if (map && !draggingRef.current) {
        const c = map.getCenter()
        map.setCenter([c.lng + 0.12, c.lat])
      }
      orbitRef.current = requestAnimationFrame(step)
    }
    orbitRef.current = requestAnimationFrame(step)
    return () => {
      if (orbitRef.current) cancelAnimationFrame(orbitRef.current)
      orbitRef.current = null
    }
  }, [orbit])

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

  // ISS ground track.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const data: GeoJSON.FeatureCollection =
      issTrail.length > 1
        ? {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: issTrail },
                properties: {},
              },
            ],
          }
        : { type: 'FeatureCollection', features: [] }
    ;(map.getSource('iss-trail') as GeoJSONSource)?.setData(data)
  }, [issTrail])

  // Precipitation radar (RainViewer) — add/remove the raster layer on toggle.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    let cancelled = false
    const remove = () => {
      if (map.getLayer('radar')) map.removeLayer('radar')
      if (map.getSource('radar')) map.removeSource('radar')
    }
    if (radar) {
      fetchRadarTemplate()
        .then((tpl) => {
          if (cancelled || !tpl || !mapRef.current) return
          remove()
          map.addSource('radar', { type: 'raster', tiles: [tpl], tileSize: 256, maxzoom: 7 })
          map.addLayer(
            { id: 'radar', type: 'raster', source: 'radar', paint: { 'raster-opacity': 0.55 } },
            'risk-zone',
          )
        })
        .catch(() => {})
    } else {
      remove()
    }
    return () => {
      cancelled = true
    }
  }, [radar])

  // Infrared cloud cover (RainViewer satellite) — add/remove on toggle.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    let cancelled = false
    const remove = () => {
      if (map.getLayer('clouds')) map.removeLayer('clouds')
      if (map.getSource('clouds')) map.removeSource('clouds')
    }
    if (clouds) {
      fetchCloudsTemplate()
        .then((tpl) => {
          if (cancelled || !tpl || !mapRef.current) return
          remove()
          map.addSource('clouds', { type: 'raster', tiles: [tpl], tileSize: 256, maxzoom: 7 })
          map.addLayer(
            { id: 'clouds', type: 'raster', source: 'clouds', paint: { 'raster-opacity': 0.45 } },
            'risk-zone',
          )
        })
        .catch(() => {})
    } else {
      remove()
    }
    return () => {
      cancelled = true
    }
  }, [clouds])

  // Measurement (ruler) vertices/line.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const features: GeoJSON.Feature[] = measurePts.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: p },
      properties: {},
    }))
    if (measurePts.length > 1) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: measurePts },
        properties: {},
      })
    }
    ;(map.getSource('measure') as GeoJSONSource)?.setData({
      type: 'FeatureCollection',
      features,
    })
  }, [measurePts])

  // Clearing the ruler when toggled off.
  useEffect(() => {
    if (!ruler) setMeasurePts([])
  }, [ruler])

  // Ground-segment data: stations, sub-points, and live contact links.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const active = activeContacts(passes, Date.now())
    const activeIds = new Set(active.map((p) => p.stationId))
    ;(map.getSource('gstations') as GeoJSONSource)?.setData(
      groundStationsFC(groundStations, activeIds, selectedStationId),
    )
    ;(map.getSource('satellites') as GeoJSONSource)?.setData(satellitesFC(satPositions))
    ;(map.getSource('contacts') as GeoJSONSource)?.setData(
      contactsFC(active, satPositions, groundStations),
    )
    ;(map.getSource('conjunctions') as GeoJSONSource)?.setData(
      conjunctionsFC(conjunctions, satPositions),
    )
  }, [groundStations, passes, conjunctions, satPositions, selectedStationId])

  // Ground-segment overlay visibility.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const vis = ground ? 'visible' : 'none'
    for (const id of [
      'gs-ring',
      'gs-pt',
      'sat-pt',
      'contact-line',
      'conjunction-line',
      'conjunction-flag',
    ]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis)
    }
  }, [ground])

  const tools: MapTool[] = [
    { on: satellite, set: () => setSatellite((v) => !v), icon: Satellite, label: 'SAT' },
    { on: heatmap, set: () => setHeatmap((v) => !v), icon: Flame, label: 'HEAT' },
    { on: night, set: () => setNight((v) => !v), icon: Moon, label: 'DAY/NIGHT' },
    { on: orbit, set: () => setOrbit((v) => !v), icon: Orbit, label: 'ORBIT' },
    { on: radar, set: () => setRadar((v) => !v), icon: CloudRain, label: 'RADAR' },
    { on: clouds, set: () => setClouds((v) => !v), icon: Cloud, label: 'CLOUDS' },
    { on: ground, set: () => setGround((v) => !v), icon: Radio, label: 'GND' },
    { on: ruler, set: () => setRuler((v) => !v), icon: Ruler, label: 'RULER' },
  ]

  // Ruler readout: total path distance + bearing of the last leg.
  const measure = useMemo(() => {
    if (measurePts.length < 2) return null
    let total = 0
    for (let i = 1; i < measurePts.length; i++) {
      const a = measurePts[i - 1]
      const b = measurePts[i]
      total += haversineKm(a[1], a[0], b[1], b[0])
    }
    const last = measurePts[measurePts.length - 1]
    const prev = measurePts[measurePts.length - 2]
    return { km: total, brg: bearing(prev, last) }
  }, [measurePts])

  return (
    <>
      <div ref={containerRef} className="absolute inset-0" />
      <MapToolbar tools={tools} />
      {ruler && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 px-3 py-1 rounded-sm bg-cmd-bg/90 border border-cmd-accent/50 font-mono text-[10px] whitespace-nowrap">
          <span className="text-cmd-accent">RULER</span>
          {measure ? (
            <>
              <span className="text-cmd-text">
                {measure.km < 1000
                  ? `${measure.km.toFixed(1)} km`
                  : `${(measure.km / 1000).toFixed(2)}k km`}
              </span>
              <span className="text-white/15">|</span>
              <span className="text-cmd-text">
                BRG {Math.round(measure.brg).toString().padStart(3, '0')}°
              </span>
            </>
          ) : (
            <span className="text-cmd-dim">click points to measure</span>
          )}
        </div>
      )}
    </>
  )
}
