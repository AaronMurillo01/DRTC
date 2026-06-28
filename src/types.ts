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

export type ThreatLevel = 1 | 2 | 3 | 4 | 5

export interface ThreatState {
  level: ThreatLevel
  label: string
  index: number // 0-100 global threat index
  trend: 'up' | 'down' | 'flat'
}
