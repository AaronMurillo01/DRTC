// NASA EONET — Earth Observatory Natural Event Tracker (no key, CORS enabled).
import { getJSON, hashId } from './http'
import type { IntelEvent } from '../types'

interface EONETResponse {
  events: {
    id: string
    title: string
    categories: { id: string; title: string }[]
    geometry: { date: string; type: string; coordinates: number[] }[]
    sources?: { url: string }[]
  }[]
}

const URL = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30&limit=120'

// EONET category → rough severity weight
const WEIGHT: Record<string, number> = {
  wildfires: 62,
  severeStorms: 78,
  volcanoes: 80,
  floods: 70,
  earthquakes: 65,
  drought: 50,
  dustHaze: 40,
  landslides: 60,
  seaLakeIce: 35,
  snow: 38,
  manmade: 55,
  waterColor: 30,
  temperatureExtremes: 58,
}

export async function fetchDisasters(): Promise<{ events: IntelEvent[]; latencyMs: number }> {
  const { data, latencyMs } = await getJSON<EONETResponse>(URL)
  const events: IntelEvent[] = []
  for (const ev of data.events ?? []) {
    const geo = ev.geometry?.[ev.geometry.length - 1]
    if (!geo || geo.type !== 'Point') continue
    const [lng, lat] = geo.coordinates
    const cat = ev.categories?.[0]
    events.push({
      id: hashId('eonet', ev.id),
      source: 'NASA EONET',
      category: 'disaster',
      severity: WEIGHT[cat?.id ?? ''] ?? 50,
      title: ev.title,
      summary: cat?.title ?? 'Natural event',
      region: cat?.title,
      lat,
      lng,
      timestamp: new Date(geo.date).getTime(),
      url: ev.sources?.[0]?.url,
      meta: { type: cat?.title ?? 'event' },
    })
  }
  return { events, latencyMs }
}
