// Live precipitation radar + infrared cloud cover via RainViewer
// (free, no key, CORS enabled). Returns tile URL templates for the most
// recent frame of each product.
import { getJSON } from './http'

interface WeatherMaps {
  host: string
  radar?: { past?: { path: string }[] }
  satellite?: { infrared?: { path: string }[] }
}

const ENDPOINT = 'https://api.rainviewer.com/public/weather-maps.json'

export async function fetchRadarTemplate(): Promise<string | null> {
  const { data } = await getJSON<WeatherMaps>(ENDPOINT)
  const past = data?.radar?.past ?? []
  const last = past[past.length - 1]
  if (!data?.host || !last?.path) return null
  // size 256, color scheme 2 (universal blue), options 1_1 (smooth + snow)
  return `${data.host}${last.path}/256/{z}/{x}/{y}/2/1_1.png`
}

export async function fetchCloudsTemplate(): Promise<string | null> {
  const { data } = await getJSON<WeatherMaps>(ENDPOINT)
  const frames = data?.satellite?.infrared ?? []
  const last = frames[frames.length - 1]
  if (!data?.host || !last?.path) return null
  // size 256, color scheme 0 (infrared blue/white), options 0_0 (no smooth/snow)
  return `${data.host}${last.path}/256/{z}/{x}/{y}/0/0_0.png`
}
