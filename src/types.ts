// DRTC core domain model — every feed normalizes into an IntelEvent.

export type EventCategory =
  | 'seismic'
  | 'disaster'
  | 'space'
  | 'orbital'
  | 'market'
  | 'cyber'
  | 'signals'
  | 'spaceport'
  | 'nuclear'
  | 'air'
  | 'weather'
  | 'neo'

export type ViewMode = '2d' | '3d' | 'globe'

export type TimeRangeKey = '1h' | '6h' | '24h' | '48h' | '7d' | 'all'

export interface IntelEvent {
  id: string
  source: string
  category: EventCategory
  /** 0-100 normalized severity used for ranking + globe styling */
  severity: number
  title: string
  summary: string
  lat?: number
  lng?: number
  /** epoch ms */
  timestamp: number
  url?: string
  /** optional human-readable location/region label */
  region?: string
  meta?: Record<string, string | number>
}

export type SourceStatus = 'online' | 'degraded' | 'offline' | 'pending'

export interface FeedSource {
  id: string
  label: string
  category: EventCategory
  status: SourceStatus
  lastSync: number | null
  count: number
  latencyMs: number | null
  /** rolling latency samples for the health sparkline */
  latencyHistory: number[]
  /** consecutive failures — drives the circuit breaker backoff */
  consecutiveFailures: number
  /** total successful syncs since boot */
  syncs: number
  error?: string
}

export interface MarketTick {
  symbol: string
  name: string
  price: number
  changePct: number
}

/** Near-Earth Object (asteroid) close approach, from NASA NeoWs. */
export interface Neo {
  id: string
  name: string
  diameterM: number
  hazardous: boolean
  missKm: number
  missLunar: number
  velocityKmh: number
  approach: string
}

export interface CountryRisk {
  iso: string
  name: string
  lat: number
  lng: number
  /** 0-100 composite instability score (DRTC Instability Index) */
  score: number
  drivers: string[]
}

export interface Alert {
  id: string
  title: string
  summary: string
  category: EventCategory
  severity: number
  ts: number
  eventId: string
}

// --- Ground segment: ground-station network + satellite contact planning ---

/** A TT&C / payload-downlink ground station in a (GSaaS) network. */
export interface GroundStation {
  id: string
  name: string
  /** network operator, e.g. KSAT, Leaf Space, RBC Signals, NASA NEN, ESA Estrack */
  operator: string
  lat: number
  lng: number
  /** supported RF bands */
  bands: string[]
  /** elevation mask in degrees — passes below this can't close a link */
  minElevDeg: number
}

/** A spacecraft being tracked for pass planning, with its current TLE. */
export interface TrackedSat {
  id: number
  name: string
  line1: string
  line2: string
}

/** Live SGP4-propagated sub-satellite point. */
export interface SatPosition {
  id: number
  name: string
  lat: number
  lng: number
  altKm: number
  velocityKmS: number
}

/** A predicted contact window (pass) of a satellite over a ground station. */
export interface ContactWindow {
  id: string
  satId: number
  satName: string
  stationId: string
  stationName: string
  operator: string
  /** epoch ms */
  aos: number
  los: number
  durationSec: number
  maxElevationDeg: number
  startAz: number
  endAz: number
  /** band selected for the link budget estimate */
  band: string
  downlinkMbps: number
  /** rough payload volume that could be downlinked over the pass (megabytes) */
  volumeMb: number
}

export type ThreatLevel = 1 | 2 | 3 | 4 | 5

export interface ThreatState {
  level: ThreatLevel
  label: string
  index: number // 0-100 global threat index
  trend: 'up' | 'down' | 'flat'
}
