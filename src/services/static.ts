// Curated static infrastructure layers (public, non-sensitive reference data).
// These are persistent sites, not live events — exempt from the time filter.
import type { IntelEvent } from '../types'

interface Site {
  name: string
  lat: number
  lng: number
  note: string
}

const SPACEPORTS: Site[] = [
  { name: 'Kennedy Space Center', lat: 28.57, lng: -80.65, note: 'USA · NASA/SpaceX' },
  { name: 'Cape Canaveral SFS', lat: 28.49, lng: -80.58, note: 'USA · USSF' },
  { name: 'Vandenberg SFB', lat: 34.74, lng: -120.57, note: 'USA · polar launches' },
  { name: 'Starbase Boca Chica', lat: 25.997, lng: -97.157, note: 'USA · SpaceX' },
  { name: 'Baikonur Cosmodrome', lat: 45.92, lng: 63.34, note: 'Kazakhstan · Roscosmos' },
  { name: 'Plesetsk Cosmodrome', lat: 62.93, lng: 40.57, note: 'Russia' },
  { name: 'Vostochny Cosmodrome', lat: 51.88, lng: 128.33, note: 'Russia' },
  { name: 'Guiana Space Centre', lat: 5.24, lng: -52.77, note: 'France/ESA · Kourou' },
  { name: 'Satish Dhawan SC', lat: 13.72, lng: 80.23, note: 'India · ISRO' },
  { name: 'Wenchang SLS', lat: 19.61, lng: 110.95, note: 'China' },
  { name: 'Jiuquan SLC', lat: 40.96, lng: 100.29, note: 'China' },
  { name: 'Tanegashima SC', lat: 30.4, lng: 130.97, note: 'Japan · JAXA' },
  { name: 'Mahia LC-1', lat: -39.26, lng: 177.86, note: 'New Zealand · Rocket Lab' },
  { name: 'Naro Space Center', lat: 34.43, lng: 127.54, note: 'South Korea' },
]

const NUCLEAR_PLANTS: Site[] = [
  { name: 'Kashiwazaki-Kariwa', lat: 37.43, lng: 138.6, note: 'Japan · power plant' },
  { name: 'Bruce NPP', lat: 44.32, lng: -81.6, note: 'Canada · power plant' },
  { name: 'Zaporizhzhia NPP', lat: 47.51, lng: 34.59, note: 'Ukraine · power plant' },
  { name: 'Hanul (Uljin)', lat: 37.09, lng: 129.38, note: 'South Korea' },
  { name: 'Gravelines', lat: 51.01, lng: 2.14, note: 'France' },
  { name: 'Palo Verde', lat: 33.39, lng: -112.86, note: 'USA · Arizona' },
  { name: 'Yangjiang', lat: 21.71, lng: 112.26, note: 'China' },
  { name: 'Taishan', lat: 21.92, lng: 112.98, note: 'China' },
  { name: 'Kori / Shin-Kori', lat: 35.32, lng: 129.29, note: 'South Korea' },
  { name: 'Cattenom', lat: 49.42, lng: 6.22, note: 'France' },
  { name: 'Vogtle', lat: 33.14, lng: -81.76, note: 'USA · Georgia' },
  { name: 'Kudankulam', lat: 8.17, lng: 77.71, note: 'India' },
  { name: 'Barakah', lat: 23.97, lng: 52.23, note: 'UAE' },
  { name: 'Leningrad NPP', lat: 59.85, lng: 29.04, note: 'Russia' },
]

function toEvents(sites: Site[], cat: IntelEvent['category'], source: string): IntelEvent[] {
  return sites.map((s) => ({
    id: `${cat}-${s.name.replace(/\W+/g, '').toLowerCase()}`,
    source,
    category: cat,
    severity: 15,
    title: s.name,
    summary: s.note,
    region: s.note,
    lat: s.lat,
    lng: s.lng,
    timestamp: Date.now(),
  }))
}

export async function fetchSpaceports(): Promise<{ events: IntelEvent[]; latencyMs: number }> {
  return { events: toEvents(SPACEPORTS, 'spaceport', 'DRTC Reference'), latencyMs: 0 }
}

export async function fetchNuclear(): Promise<{ events: IntelEvent[]; latencyMs: number }> {
  return { events: toEvents(NUCLEAR_PLANTS, 'nuclear', 'DRTC Reference'), latencyMs: 0 }
}
