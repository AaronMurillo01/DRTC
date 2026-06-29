// GeoJSON FeatureCollection builders for the map's data sources.
import { CATEGORY_META } from '../../store'
import { greatCircle, haversineKm, subsolarPoint, D2R } from '../../services/geo'
import type {
  ContactWindow,
  CountryRisk,
  GroundStation,
  IntelEvent,
  SatPosition,
} from '../../types'

export function eventsFC(events: IntelEvent[]): GeoJSON.FeatureCollection {
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
          cat: CATEGORY_META[e.category].label,
        },
      })),
  }
}

export function riskFC(risk: CountryRisk[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: risk.map((c) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      properties: { score: c.score, name: c.name, drivers: c.drivers.join(' · ') },
    })),
  }
}

// Arcs from the most unstable watch-country to nearby high-severity tracks.
export function arcsFC(risk: CountryRisk[], events: IntelEvent[]): GeoJSON.FeatureCollection {
  const top = risk[0]
  if (!top) return { type: 'FeatureCollection', features: [] }
  const located = events.filter((e) => e.lat != null && e.lng != null && e.severity >= 60)
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

// Ground-station network markers (with active/selected flags for styling).
export function groundStationsFC(
  stations: GroundStation[],
  activeIds: Set<string>,
  selectedId: string | null,
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: stations.map((st) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [st.lng, st.lat] },
      properties: {
        id: st.id,
        name: st.name,
        operator: st.operator,
        active: activeIds.has(st.id) ? 1 : 0,
        selected: st.id === selectedId ? 1 : 0,
      },
    })),
  }
}

// Live sub-satellite points for the tracked constellation.
export function satellitesFC(positions: SatPosition[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: positions.map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      properties: { id: s.id, name: s.name, alt: Math.round(s.altKm) },
    })),
  }
}

// Active-contact links: great-circle line from station to the bird's sub-point.
export function contactsFC(
  active: ContactWindow[],
  positions: SatPosition[],
  stations: GroundStation[],
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  for (const p of active) {
    const sat = positions.find((s) => s.id === p.satId)
    const st = stations.find((s) => s.id === p.stationId)
    if (!sat || !st) continue
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: greatCircle([st.lng, st.lat], [sat.lng, sat.lat]),
      },
      properties: {},
    })
  }
  return { type: 'FeatureCollection', features }
}

// Polygon covering the night hemisphere at time `d` (solar terminator).
export function terminatorFC(d: Date): GeoJSON.FeatureCollection {
  const sun = subsolarPoint(d)
  const decl = Math.abs(sun.lat) < 0.5 ? (sun.lat < 0 ? -0.5 : 0.5) : sun.lat
  const ring: number[][] = []
  for (let lng = -180; lng <= 180; lng += 2) {
    const ha = (lng - sun.lng) * D2R
    const lat = (Math.atan(-Math.cos(ha) / Math.tan(decl * D2R)) * 180) / Math.PI
    ring.push([lng, lat])
  }
  const darkPole = decl > 0 ? -90 : 90
  ring.push([180, darkPole], [-180, darkPole], ring[0])
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} },
    ],
  }
}
