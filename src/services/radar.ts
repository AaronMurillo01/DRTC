// Live precipitation radar via RainViewer (free, no key, CORS enabled).
// Returns a tile URL template for the most recent radar frame.
import { getJSON } from './http'

interface WeatherMaps {
  host: string
  radar?: { past?: { path: string }[] }
}

export async function fetchRadarTemplate(): Promise<string | null> {
  const { data } = await getJSON<WeatherMaps>('https://api.rainviewer.com/public/weather-maps.json')
  const past = data?.radar?.past ?? []
  const last = past[past.length - 1]
  if (!data?.host || !last?.path) return null
  // size 256, color scheme 2 (universal blue), options 1_1 (smooth + snow)
  return `${data.host}${last.path}/256/{z}/{x}/{y}/2/1_1.png`
}
