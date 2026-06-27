// GDELT GEO 2.0 — geolocated global news hotspots (no key, CORS enabled).
// Surfaces where the world's media attention is concentrating on crisis themes.
import { getJSON, hashId } from './http'
import type { IntelEvent } from '../types'

interface GeoResponse {
  features?: {
    properties: { name: string; count: number; html?: string; shareimage?: string }
    geometry: { type: string; coordinates: [number, number] }
  }[]
}

const QUERY = '(conflict OR military OR strike OR protest OR attack OR crisis OR sanctions)'
const URL = `https://api.gdeltproject.org/api/v2/geo/geo?query=${encodeURIComponent(
  QUERY,
)}&format=geojson&timespan=24h`

function firstHref(html?: string): string | undefined {
  if (!html) return undefined
  const m = html.match(/href=["']([^"']+)["']/i)
  return m?.[1]
}

export async function fetchSignals(): Promise<{ events: IntelEvent[]; latencyMs: number }> {
  const { data, latencyMs } = await getJSON<GeoResponse>(URL)
  const feats = (data.features ?? []).filter((f) => f.geometry?.type === 'Point')
  const max = Math.max(1, ...feats.map((f) => f.properties.count || 0))
  const events = feats.slice(0, 60).map<IntelEvent>((f) => {
    const [lng, lat] = f.geometry.coordinates
    const count = f.properties.count || 0
    return {
      id: hashId('sig', f.properties.name, lat, lng),
      source: 'GDELT',
      category: 'signals',
      // Normalize against the busiest hotspot in this batch
      severity: 35 + Math.round((count / max) * 55),
      title: f.properties.name,
      summary: `${count} crisis-theme mentions · last 24h`,
      region: f.properties.name,
      lat,
      lng,
      timestamp: Date.now(),
      url: firstHref(f.properties.html),
      meta: { mentions: count },
    }
  })
  return { events, latencyMs }
}
