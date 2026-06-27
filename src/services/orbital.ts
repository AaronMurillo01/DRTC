// ISS live position via wheretheiss.at (no key, CORS enabled).
import { getJSON } from './http'
import type { IntelEvent } from '../types'

interface ISSResponse {
  latitude: number
  longitude: number
  altitude: number
  velocity: number
  timestamp: number
}

const URL = 'https://api.wheretheiss.at/v1/satellites/25544'

export async function fetchOrbital(): Promise<{ events: IntelEvent[]; latencyMs: number }> {
  const { data, latencyMs } = await getJSON<ISSResponse>(URL)
  const event: IntelEvent = {
    id: 'iss-25544', // stable id so the marker moves rather than duplicating
    source: 'ISS / NORAD 25544',
    category: 'orbital',
    severity: 20,
    title: 'ISS — International Space Station',
    summary: `Alt ${Math.round(data.altitude)} km · ${Math.round(data.velocity)} km/h`,
    lat: data.latitude,
    lng: data.longitude,
    timestamp: data.timestamp * 1000,
    meta: {
      altitudeKm: Math.round(data.altitude),
      velocityKmh: Math.round(data.velocity),
    },
  }
  return { events: [event], latencyMs }
}
