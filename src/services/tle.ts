// Two-line element (TLE) sets for the tracked constellation, used to drive
// SGP4 pass prediction. Source: tle.ivanstanojevic.me — a free, no-key,
// CORS-enabled TLE mirror of the public CelesTrak catalog.
import { getJSON } from './http'
import type { TrackedSat } from '../types'

interface TLEResponse {
  satelliteId: number
  name: string
  line1: string
  line2: string
}

// A representative LEO mission set: crewed, Earth-observation, weather and
// science birds. NORAD catalog numbers are public.
export const TRACKED = [
  { id: 25544, name: 'ISS (ZARYA)' },
  { id: 20580, name: 'HUBBLE (HST)' },
  { id: 49260, name: 'LANDSAT 9' },
  { id: 43013, name: 'NOAA 20 (JPSS-1)' },
  { id: 40697, name: 'SENTINEL-2A' },
  { id: 27424, name: 'AQUA' },
]

const ENDPOINT = 'https://tle.ivanstanojevic.me/api/tle'

function valid(t: Partial<TLEResponse>): t is TLEResponse {
  return (
    typeof t.line1 === 'string' &&
    typeof t.line2 === 'string' &&
    t.line1.startsWith('1 ') &&
    t.line2.startsWith('2 ')
  )
}

export async function fetchTLEs(): Promise<{ sats: TrackedSat[]; latencyMs: number }> {
  const started = performance.now()
  const results = await Promise.allSettled(
    TRACKED.map((s) =>
      getJSON<TLEResponse>(`${ENDPOINT}/${s.id}`, { retries: 1, timeoutMs: 9000 }),
    ),
  )
  const sats: TrackedSat[] = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && valid(r.value.data)) {
      const d = r.value.data
      sats.push({ id: TRACKED[i].id, name: TRACKED[i].name, line1: d.line1, line2: d.line2 })
    }
  })
  if (sats.length === 0) throw new Error('no TLEs available')
  return { sats, latencyMs: Math.round(performance.now() - started) }
}
