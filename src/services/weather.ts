// Active weather alerts via NOAA / NWS (free, no key, CORS enabled).
// US coverage only. Works from the browser as long as no custom User-Agent
// header is sent (the default browser UA is fine).
import { getJSON, hashId } from './http'
import type { IntelEvent } from '../types'

interface NWSResponse {
  features?: {
    id: string
    properties: {
      event: string
      headline?: string
      severity?: string
      areaDesc?: string
      onset?: string
      sent?: string
    }
    geometry: { type: string; coordinates: number[][][] | number[][][][] } | null
  }[]
}

const URL = 'https://api.weather.gov/alerts/active?status=actual&message_type=alert'

const SEV: Record<string, number> = {
  Extreme: 95,
  Severe: 80,
  Moderate: 60,
  Minor: 42,
  Unknown: 30,
}

// Rough centroid of a (Multi)Polygon's first ring.
function centroid(
  geom: NonNullable<NWSResponse['features']>[number]['geometry'],
): [number, number] | null {
  if (!geom) return null
  let ring: number[][] | undefined
  if (geom.type === 'Polygon') ring = (geom.coordinates as number[][][])[0]
  else if (geom.type === 'MultiPolygon') ring = (geom.coordinates as number[][][][])[0]?.[0]
  if (!ring || !ring.length) return null
  // GeoJSON rings repeat the first vertex as the last; drop it so the centroid
  // isn't biased toward that corner.
  const first = ring[0]
  const last = ring[ring.length - 1]
  const verts =
    ring.length > 1 && first[0] === last[0] && first[1] === last[1] ? ring.slice(0, -1) : ring
  let x = 0
  let y = 0
  for (const [lng, lat] of verts) {
    x += lng
    y += lat
  }
  return [x / verts.length, y / verts.length]
}

export function parseWeather(data: NWSResponse): IntelEvent[] {
  const events: IntelEvent[] = []
  for (const f of data?.features ?? []) {
    const c = centroid(f.geometry)
    if (!c) continue // many alerts are zone-only with no polygon; skip those
    const p = f.properties
    events.push({
      id: hashId('wx', f.id),
      source: 'NOAA NWS',
      category: 'weather',
      severity: SEV[p.severity ?? 'Unknown'] ?? 40,
      title: p.event,
      summary: (p.headline || p.areaDesc || p.event).slice(0, 160),
      region: p.areaDesc,
      lng: c[0],
      lat: c[1],
      timestamp: new Date(p.onset || p.sent || Date.now()).getTime(),
      meta: { severity: p.severity ?? 'Unknown' },
    })
  }
  return events.slice(0, 200)
}

export async function fetchWeather(): Promise<{ events: IntelEvent[]; latencyMs: number }> {
  const { data, latencyMs } = await getJSON<NWSResponse>(URL)
  return { events: parseWeather(data), latencyMs }
}
