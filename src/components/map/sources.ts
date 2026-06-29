// GeoJSON FeatureCollection builders for the map's data sources.
import { CATEGORY_META } from '../../store'
import { greatCircle, haversineKm, subsolarPoint, D2R } from '../../services/geo'
import type { CountryRisk, IntelEvent } from '../../types'

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
