// Air quality via Open-Meteo (free, no key, CORS enabled).
// One request covers every city by passing comma-separated coordinates.
import { getJSON, hashId } from './http'
import type { IntelEvent } from '../types'

const CITIES: { name: string; lat: number; lng: number }[] = [
  { name: 'New York', lat: 40.71, lng: -74.0 },
  { name: 'Los Angeles', lat: 34.05, lng: -118.24 },
  { name: 'Mexico City', lat: 19.43, lng: -99.13 },
  { name: 'Bogotá', lat: 4.71, lng: -74.07 },
  { name: 'São Paulo', lat: -23.55, lng: -46.63 },
  { name: 'Santiago', lat: -33.45, lng: -70.66 },
  { name: 'London', lat: 51.51, lng: -0.13 },
  { name: 'Paris', lat: 48.85, lng: 2.35 },
  { name: 'Madrid', lat: 40.42, lng: -3.7 },
  { name: 'Moscow', lat: 55.75, lng: 37.62 },
  { name: 'Istanbul', lat: 41.01, lng: 28.98 },
  { name: 'Cairo', lat: 30.04, lng: 31.24 },
  { name: 'Lagos', lat: 6.52, lng: 3.38 },
  { name: 'Johannesburg', lat: -26.2, lng: 28.05 },
  { name: 'Tehran', lat: 35.69, lng: 51.39 },
  { name: 'Dubai', lat: 25.2, lng: 55.27 },
  { name: 'Karachi', lat: 24.86, lng: 67.0 },
  { name: 'Delhi', lat: 28.61, lng: 77.21 },
  { name: 'Mumbai', lat: 19.08, lng: 72.88 },
  { name: 'Dhaka', lat: 23.81, lng: 90.41 },
  { name: 'Bangkok', lat: 13.76, lng: 100.5 },
  { name: 'Jakarta', lat: -6.21, lng: 106.85 },
  { name: 'Beijing', lat: 39.9, lng: 116.4 },
  { name: 'Shanghai', lat: 31.23, lng: 121.47 },
  { name: 'Seoul', lat: 37.57, lng: 126.98 },
  { name: 'Tokyo', lat: 35.68, lng: 139.69 },
  { name: 'Sydney', lat: -33.87, lng: 151.21 },
  { name: 'Singapore', lat: 1.35, lng: 103.82 },
]

interface AQItem {
  latitude: number
  longitude: number
  current?: { us_aqi?: number; pm2_5?: number }
}

function band(aqi: number): string {
  if (aqi <= 50) return 'Good'
  if (aqi <= 100) return 'Moderate'
  if (aqi <= 150) return 'Unhealthy (sensitive)'
  if (aqi <= 200) return 'Unhealthy'
  if (aqi <= 300) return 'Very unhealthy'
  return 'Hazardous'
}

export async function fetchAirQuality(): Promise<{ events: IntelEvent[]; latencyMs: number }> {
  const lats = CITIES.map((c) => c.lat).join(',')
  const lngs = CITIES.map((c) => c.lng).join(',')
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lngs}&current=us_aqi,pm2_5`
  const { data, latencyMs } = await getJSON<AQItem | AQItem[]>(url)
  const items = Array.isArray(data) ? data : [data]
  const events: IntelEvent[] = []
  items.forEach((it, i) => {
    const city = CITIES[i]
    const aqi = it?.current?.us_aqi
    if (!city || aqi == null) return
    events.push({
      id: hashId('air', city.name),
      source: 'Open-Meteo',
      category: 'air',
      severity: Math.min(100, Math.round(aqi / 3)),
      title: `${city.name} · AQI ${Math.round(aqi)}`,
      summary: `${band(aqi)} · PM2.5 ${it.current?.pm2_5 ?? '–'} µg/m³`,
      region: city.name,
      lat: city.lat,
      lng: city.lng,
      timestamp: Date.now(),
      meta: { usAqi: Math.round(aqi), pm25: it.current?.pm2_5 ?? 0 },
    })
  })
  return { events, latencyMs }
}
