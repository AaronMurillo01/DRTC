import { create } from 'zustand'
import type {
  Alert,
  CountryRisk,
  EventCategory,
  FeedSource,
  IntelEvent,
  MarketTick,
  Neo,
  ThreatState,
  TimeRangeKey,
  ViewMode,
} from './types'
import { buildBrief, computeCountryRisk, computeThreat } from './services/threat'

export const CATEGORY_META: Record<EventCategory, { label: string; color: string; short: string }> =
  {
    seismic: { label: 'Seismic', color: '#fbbf24', short: 'SEIS' },
    disaster: { label: 'Disaster', color: '#f87171', short: 'DSTR' },
    space: { label: 'Space Weather', color: '#e879f9', short: 'SPCE' },
    orbital: { label: 'Orbital', color: '#22d3ee', short: 'ORBT' },
    market: { label: 'Markets', color: '#34d399', short: 'MKT' },
    cyber: { label: 'Cyber', color: '#60a5fa', short: 'CYBR' },
    signals: { label: 'Signals', color: '#34d399', short: 'SIG' },
    spaceport: { label: 'Spaceports', color: '#a78bfa', short: 'SPRT' },
    nuclear: { label: 'Nuclear Sites', color: '#facc15', short: 'NUKE' },
    air: { label: 'Air Quality', color: '#2dd4bf', short: 'AIR' },
    weather: { label: 'Weather Alerts', color: '#38bdf8', short: 'WX' },
    neo: { label: 'Near-Earth Objects', color: '#c4b5fd', short: 'NEO' },
  }

// Persistent reference layers — exempt from the time filter and the intel feed.
export const STATIC_CATEGORIES = new Set<EventCategory>(['spaceport', 'nuclear'])
const TIME_EXEMPT = new Set<EventCategory>(['orbital', 'spaceport', 'nuclear'])

export const TIME_RANGES: { key: TimeRangeKey; label: string; ms: number }[] = [
  { key: '1h', label: '1h', ms: 3_600_000 },
  { key: '6h', label: '6h', ms: 6 * 3_600_000 },
  { key: '24h', label: '24h', ms: 24 * 3_600_000 },
  { key: '48h', label: '48h', ms: 48 * 3_600_000 },
  { key: '7d', label: '7d', ms: 7 * 24 * 3_600_000 },
  { key: 'all', label: 'ALL', ms: Infinity },
]

const ALERT_THRESHOLD = 85
const PREFS_KEY = 'drtc.prefs.v2'

// --- preference persistence (active layers + severity floor) ---
interface Prefs {
  activeCategories: EventCategory[]
  minSeverity: number
  viewMode: ViewMode
  timeRange: TimeRangeKey
}
function loadPrefs(): Prefs | null {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    return raw ? (JSON.parse(raw) as Prefs) : null
  } catch {
    return null
  }
}
function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

interface DRTCState {
  events: IntelEvent[]
  markets: MarketTick[]
  neos: Neo[]
  sources: Record<string, FeedSource>
  countryRisk: CountryRisk[]
  threat: ThreatState
  threatHistory: number[]
  brief: string
  alerts: Alert[]
  /** ids already surfaced as alerts, so we don't re-alert (first-class state) */
  alertedIds: Set<string>
  /** sources whose first historical batch has been seen (warm-up) */
  warmedSources: Set<string>
  selectedId: string | null
  activeCategories: Set<EventCategory>
  minSeverity: number
  query: string
  viewMode: ViewMode
  timeRange: TimeRangeKey
  paused: boolean
  commandOpen: boolean
  helpOpen: boolean
  lastTick: number
  /** live map cursor readout (MGRS + lat/lng), shown in the status bar */
  cursor: { lat: number; lng: number; mgrs: string } | null

  setSourceStatus: (id: string, patch: Partial<FeedSource>) => void
  ingest: (sourceId: string, events: IntelEvent[]) => void
  setMarkets: (ticks: MarketTick[]) => void
  setNeos: (neos: Neo[]) => void
  recompute: () => void
  select: (id: string | null) => void
  toggleCategory: (cat: EventCategory) => void
  setMinSeverity: (v: number) => void
  setQuery: (q: string) => void
  setViewMode: (m: ViewMode) => void
  setTimeRange: (t: TimeRangeKey) => void
  togglePause: () => void
  setCommandOpen: (open: boolean) => void
  setHelpOpen: (open: boolean) => void
  setCursor: (c: { lat: number; lng: number; mgrs: string } | null) => void
  dismissAlert: (id: string) => void
  clearAlerts: () => void
}

const INITIAL_SOURCES: FeedSource[] = [
  {
    id: 'seismic',
    label: 'USGS Seismic',
    category: 'seismic',
    status: 'pending',
    lastSync: null,
    count: 0,
    latencyMs: null,
    latencyHistory: [],
    consecutiveFailures: 0,
    syncs: 0,
  },
  {
    id: 'disaster',
    label: 'NASA EONET',
    category: 'disaster',
    status: 'pending',
    lastSync: null,
    count: 0,
    latencyMs: null,
    latencyHistory: [],
    consecutiveFailures: 0,
    syncs: 0,
  },
  {
    id: 'space',
    label: 'NOAA Space Wx',
    category: 'space',
    status: 'pending',
    lastSync: null,
    count: 0,
    latencyMs: null,
    latencyHistory: [],
    consecutiveFailures: 0,
    syncs: 0,
  },
  {
    id: 'orbital',
    label: 'ISS Telemetry',
    category: 'orbital',
    status: 'pending',
    lastSync: null,
    count: 0,
    latencyMs: null,
    latencyHistory: [],
    consecutiveFailures: 0,
    syncs: 0,
  },
  {
    id: 'signals',
    label: 'GDELT Signals',
    category: 'signals',
    status: 'pending',
    lastSync: null,
    count: 0,
    latencyMs: null,
    latencyHistory: [],
    consecutiveFailures: 0,
    syncs: 0,
  },
  {
    id: 'market',
    label: 'Markets Radar',
    category: 'market',
    status: 'pending',
    lastSync: null,
    count: 0,
    latencyMs: null,
    latencyHistory: [],
    consecutiveFailures: 0,
    syncs: 0,
  },
  {
    id: 'spaceport',
    label: 'Spaceports',
    category: 'spaceport',
    status: 'pending',
    lastSync: null,
    count: 0,
    latencyMs: null,
    latencyHistory: [],
    consecutiveFailures: 0,
    syncs: 0,
  },
  {
    id: 'nuclear',
    label: 'Nuclear Sites',
    category: 'nuclear',
    status: 'pending',
    lastSync: null,
    count: 0,
    latencyMs: null,
    latencyHistory: [],
    consecutiveFailures: 0,
    syncs: 0,
  },
  {
    id: 'air',
    label: 'Air Quality',
    category: 'air',
    status: 'pending',
    lastSync: null,
    count: 0,
    latencyMs: null,
    latencyHistory: [],
    consecutiveFailures: 0,
    syncs: 0,
  },
  {
    id: 'weather',
    label: 'Weather Alerts',
    category: 'weather',
    status: 'pending',
    lastSync: null,
    count: 0,
    latencyMs: null,
    latencyHistory: [],
    consecutiveFailures: 0,
    syncs: 0,
  },
  {
    id: 'neo',
    label: 'NASA NeoWs',
    category: 'neo',
    status: 'pending',
    lastSync: null,
    count: 0,
    latencyMs: null,
    latencyHistory: [],
    consecutiveFailures: 0,
    syncs: 0,
  },
]

const prefs = loadPrefs()
const DEFAULT_CATS: EventCategory[] = [
  'seismic',
  'disaster',
  'space',
  'orbital',
  'signals',
  'weather',
  'air',
]

export const useStore = create<DRTCState>((set) => ({
  events: [],
  markets: [],
  neos: [],
  sources: Object.fromEntries(INITIAL_SOURCES.map((s) => [s.id, s])),
  countryRisk: [],
  threat: { level: 1, label: 'NOMINAL', index: 0, trend: 'flat' },
  threatHistory: [],
  brief: '',
  alerts: [],
  alertedIds: new Set<string>(),
  warmedSources: new Set<string>(),
  selectedId: null,
  activeCategories: new Set<EventCategory>(prefs?.activeCategories ?? DEFAULT_CATS),
  minSeverity: prefs?.minSeverity ?? 0,
  query: '',
  viewMode: prefs?.viewMode ?? '2d',
  timeRange: prefs?.timeRange ?? '7d',
  paused: false,
  commandOpen: false,
  helpOpen: false,
  lastTick: 0,
  cursor: null,

  setSourceStatus: (id, patch) =>
    set((s) => ({ sources: { ...s.sources, [id]: { ...s.sources[id], ...patch } } })),

  ingest: (sourceId, incoming) =>
    set((s) => {
      const others = s.events.filter((e) => srcOf(e) !== sourceId)
      const tagged = incoming.map((e) => ({ ...e, __src: sourceId }) as IntelEvent)
      const merged = [...others, ...tagged].sort((a, b) => b.timestamp - a.timestamp)

      // Alert detection: emit only for fresh criticals after a source warms up,
      // so the first historical batch doesn't flood the alert log.
      let alerts = s.alerts
      const alertedIds = new Set(s.alertedIds)
      const warmedSources = new Set(s.warmedSources)
      const high = incoming.filter((e) => e.severity >= ALERT_THRESHOLD)
      if (!warmedSources.has(sourceId)) {
        high.forEach((e) => alertedIds.add(e.id))
        warmedSources.add(sourceId)
      } else {
        const fresh = high.filter((e) => !alertedIds.has(e.id))
        if (fresh.length) {
          fresh.forEach((e) => alertedIds.add(e.id))
          // Bound the dedup set so a long session can't grow it without limit.
          if (alertedIds.size > 1000) {
            const trimmed = [...alertedIds].slice(-500)
            alertedIds.clear()
            trimmed.forEach((id) => alertedIds.add(id))
          }
          const newAlerts: Alert[] = fresh.map((e) => ({
            id: `al-${e.id}`,
            title: e.title,
            summary: e.summary,
            category: e.category,
            severity: e.severity,
            ts: Date.now(),
            eventId: e.id,
          }))
          alerts = [...newAlerts, ...s.alerts].slice(0, 40)
        }
      }
      return { events: merged, alerts, alertedIds, warmedSources }
    }),

  setMarkets: (ticks) => set({ markets: ticks }),
  setNeos: (neos) => set({ neos }),

  recompute: () =>
    set((s) => {
      const countryRisk = computeCountryRisk(s.events)
      const threat = computeThreat(s.events, s.threat.index)
      const history = [...s.threatHistory, threat.index].slice(-60)
      const brief = buildBrief(s.events, threat, countryRisk, s.markets)
      return { countryRisk, threat, threatHistory: history, brief, lastTick: Date.now() }
    }),

  select: (id) => set({ selectedId: id }),

  toggleCategory: (cat) =>
    set((s) => {
      const next = new Set(s.activeCategories)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      const patch = { activeCategories: next }
      savePrefs(prefsOf(s, patch))
      return patch
    }),

  setMinSeverity: (v) =>
    set((s) => {
      savePrefs(prefsOf(s, { minSeverity: v }))
      return { minSeverity: v }
    }),

  setQuery: (q) => set({ query: q }),
  setViewMode: (m) =>
    set((s) => {
      savePrefs(prefsOf(s, { viewMode: m }))
      return { viewMode: m }
    }),
  setTimeRange: (t) =>
    set((s) => {
      savePrefs(prefsOf(s, { timeRange: t }))
      return { timeRange: t }
    }),
  togglePause: () => set((s) => ({ paused: !s.paused })),
  setCommandOpen: (open) => set({ commandOpen: open }),
  setHelpOpen: (open) => set({ helpOpen: open }),
  setCursor: (c) => set({ cursor: c }),
  dismissAlert: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),
  clearAlerts: () => set({ alerts: [] }),
}))

// Helper: which source an event belongs to (stashed on ingest).
function srcOf(e: IntelEvent): string | undefined {
  return (e as IntelEvent & { __src?: string }).__src
}

// Build a Prefs snapshot from current state + a patch (for persistence).
function prefsOf(s: DRTCState, patch: Partial<DRTCState>): Prefs {
  const cats = (patch.activeCategories ?? s.activeCategories) as Set<EventCategory>
  return {
    activeCategories: [...cats],
    minSeverity: patch.minSeverity ?? s.minSeverity,
    viewMode: patch.viewMode ?? s.viewMode,
    timeRange: patch.timeRange ?? s.timeRange,
  }
}

// Map + globe share this filtered view (category + severity + time window).
export const visibleEvents = (s: DRTCState): IntelEvent[] => {
  const range = TIME_RANGES.find((r) => r.key === s.timeRange)!.ms
  const cutoff = Date.now() - range
  return s.events.filter((e) => {
    if (!s.activeCategories.has(e.category)) return false
    if (TIME_EXEMPT.has(e.category)) return true
    if (e.severity < s.minSeverity) return false
    return e.timestamp >= cutoff
  })
}

// Intel feed excludes static reference layers (spaceports / nuclear sites).
export const feedEvents = (s: DRTCState): IntelEvent[] =>
  visibleEvents(s).filter((e) => !STATIC_CATEGORIES.has(e.category))
