import { useEffect, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource } from 'maplibre-gl'
import { forward as mgrsForward } from 'mgrs'
import { Flame, Moon, Orbit, Satellite } from 'lucide-react'
import { useStore, visibleEvents } from '../store'
import { STYLE, applyView } from './map/mapStyle'
import { addDataLayers } from './map/layers'
import { eventsFC, riskFC, arcsFC, terminatorFC } from './map/sources'
import { MapToolbar, type MapTool } from './map/MapToolbar'

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const orbitRef = useRef<number | null>(null)
  const draggingRef = useRef(false)
  const readyRef = useRef(false)
  const lastMoveRef = useRef(0)
  const [satellite, setSatellite] = useState(false)
  const [heatmap, setHeatmap] = useState(false)
  const [night, setNight] = useState(false)
  const [orbit, setOrbit] = useState(false)

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
      map.on('click', 'events-pt', (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined
        if (!id) return
        const current = useStore.getState().selectedId
        select(current === id ? null : id)
      })
      // Click empty map (no track under the cursor) to clear the selection.
      map.on('click', (e) => {
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

  const tools: MapTool[] = [
    { on: satellite, set: () => setSatellite((v) => !v), icon: Satellite, label: 'SAT' },
    { on: heatmap, set: () => setHeatmap((v) => !v), icon: Flame, label: 'HEAT' },
    { on: night, set: () => setNight((v) => !v), icon: Moon, label: 'DAY/NIGHT' },
    { on: orbit, set: () => setOrbit((v) => !v), icon: Orbit, label: 'ORBIT' },
  ]

  return (
    <>
      <div ref={containerRef} className="absolute inset-0" />
      <MapToolbar tools={tools} />
    </>
  )
}
