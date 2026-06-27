// USGS Earthquake feed (GeoJSON, no key, CORS enabled).
import { getJSON, hashId } from './http'
import type { IntelEvent } from '../types'

interface USGSResponse {
  features: {
    id: string
    properties: { mag: number; place: string; time: number; url: string; title: string }
    geometry: { coordinates: [number, number, number] }
  }[]
}

const URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson'

export async function fetchSeismic(): Promise<{ events: IntelEvent[]; latencyMs: number }> {
  const { data, latencyMs } = await getJSON<USGSResponse>(URL)
  const events = (data.features ?? [])
    .filter((f) => f.geometry?.coordinates && f.properties?.mag != null)
    .map<IntelEvent>((f) => {
      const [lng, lat, depth] = f.geometry.coordinates
      const mag = f.properties.mag
      // Severity: M2.5 → ~25, M7+ → ~100
      const severity = Math.min(100, Math.round(mag * 13))
      return {
        id: hashId('eq', f.id),
        source: 'USGS',
        category: 'seismic',
        severity,
        title: `M${mag.toFixed(1)} Earthquake`,
        summary: f.properties.place || 'Unknown location',
        region: f.properties.place,
        lat,
        lng,
        timestamp: f.properties.time,
        url: f.properties.url,
        meta: { magnitude: mag, depthKm: Math.round(depth) },
      }
    })
  return { events, latencyMs }
}
