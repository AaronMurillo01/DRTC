// Near-Earth Objects via NASA NeoWs (free; uses the shared DEMO_KEY unless a
// VITE_NASA_KEY is provided). api.nasa.gov is CORS enabled.
import { getJSON } from './http'
import type { Neo } from '../types'

const KEY = import.meta.env.VITE_NASA_KEY || 'DEMO_KEY'

interface NeoRaw {
  id: string
  name: string
  is_potentially_hazardous_asteroid?: boolean
  estimated_diameter?: {
    meters?: { estimated_diameter_min?: number; estimated_diameter_max?: number }
  }
  close_approach_data?: {
    close_approach_date_full?: string
    relative_velocity?: { kilometers_per_hour?: string }
    miss_distance?: { kilometers?: string; lunar?: string }
  }[]
}
interface FeedResponse {
  near_earth_objects?: Record<string, NeoRaw[]>
}

// Pure parser, exported for testing.
export function parseNeos(data: FeedResponse): Neo[] {
  const groups = data?.near_earth_objects ?? {}
  const all = Object.values(groups).flat()
  return all
    .map<Neo>((n) => {
      const ca = n.close_approach_data?.[0]
      const dmin = n.estimated_diameter?.meters?.estimated_diameter_min ?? 0
      const dmax = n.estimated_diameter?.meters?.estimated_diameter_max ?? 0
      return {
        id: n.id,
        name: (n.name ?? n.id).replace(/[()]/g, '').trim(),
        diameterM: Math.round((dmin + dmax) / 2),
        hazardous: !!n.is_potentially_hazardous_asteroid,
        missKm: ca?.miss_distance?.kilometers ? Math.round(Number(ca.miss_distance.kilometers)) : 0,
        missLunar: ca?.miss_distance?.lunar ? Number(Number(ca.miss_distance.lunar).toFixed(1)) : 0,
        velocityKmh: ca?.relative_velocity?.kilometers_per_hour
          ? Math.round(Number(ca.relative_velocity.kilometers_per_hour))
          : 0,
        approach: ca?.close_approach_date_full ?? '',
      }
    })
    .filter((n) => n.missKm > 0)
    .sort((a, b) => Number(b.hazardous) - Number(a.hazardous) || a.missKm - b.missKm)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function fetchNeos(): Promise<{ neos: Neo[]; latencyMs: number }> {
  const d = today()
  const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${d}&end_date=${d}&api_key=${KEY}`
  const { data, latencyMs } = await getJSON<FeedResponse>(url)
  return { neos: parseNeos(data), latencyMs }
}
