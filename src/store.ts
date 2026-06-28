import { create } from 'zustand'
import type {
  Alert,
  CountryRisk,
  EventCategory,
  FeedSource,
  IntelEvent,
  MarketTick,
  ThreatState,
} from './types'
import { buildBrief, computeCountryRisk, computeThreat } from './services/threat'

export const CATEGORY_META: Record<
  EventCategory,
  { label: string; color: string; short: string }
> = {
  seismic: { label: 'Seismic', color: '#fbbf24', short: 'SEIS' },
  disaster: { label: 'Disaster', color: '#f87171', short: 'DSTR' },
  space: { label: 'Space Weather', color: '#e879f9', short: 'SPCE' },
  orbital: { label: 'Orbital', color: '#22d3ee', short: 'ORBT' },
  market: { label: 'Markets', color: '#34d399', short: 'MKT' },
  cyber: { label: 'Cyber', color: '#60a5fa', short: 'CYBR' },
  signals: { label: 'Signals', color: '#34d399', short: 'SIG' },
}

const ALERT_THRESHOLD = 85
const PREFS_KEY = 'drtc.prefs.v1'

// --- preference persistence (active layers + severity floor) ---
interface Prefs {
  activeCategories: EventCategory[]
  minSeverity: number
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

// Module-level alert bookkeeping (kept out of state to avoid churn).
const alerted = new Set<string>()
const warmedSources = new Set<string>()

interface DRTCState {
  events: IntelEvent[]
  markets: MarketTick[]
  sources: Record<string, FeedSource>
  countryRisk: CountryRisk[]
  threat: ThreatState
  threatHistory: number[]
  brief: string
  alerts: Alert[]
  selectedId: string | null
  activeCategories: Set<EventCategory>
  minSeverity: number
  query: string
  paused: boolean
  commandOpen: boolean
  lastTick: number

  setSourceStatus: (id: string, patch: Partial<FeedSource>) => void
  ingest: (sourceId: string, events: IntelEvent[]) => void
  setMarkets: (ticks: MarketTick[]) => void
  recompute: () => void
  select: (id: string | null) => void
  toggleCategory: (cat: EventCategory) => void
  setMinSeverity: (v: number) => void
  setQuery: (q: string) => void
  togglePause: () => void
  setCommandOpen: (open: boolean) => void
  dismissAlert: (id: string) => void
  clearAlerts: () => void
}

const INITIAL_SOURCES: FeedSource[] = [
  { id: 'seismic', label: 'USGS Seismic', category: 'seismic', status: 'pending', lastSync: null, count: 0, latencyMs: null },
  { id: 'disaster', label: 'NASA EONET', category: 'disaster', status: 'pending', lastSync: null, count: 0, latencyMs: null },
  { id: 'space', label: 'NOAA Space Wx', category: 'space', status: 'pending', lastSync: null, count: 0, latencyMs: null },
  { id: 'orbital', label: 'ISS Telemetry', category: 'orbital', status: 'pending', lastSync: null, count: 0, latencyMs: null },
  { id: 'signals', label: 'GDELT Signals', category: 'signals', status: 'pending', lastSync: null, count: 0, latencyMs: null },
  { id: 'market', label: 'Markets Radar', category: 'market', status: 'pending', lastSync: null, count: 0, latencyMs: null },
]

const prefs = loadPrefs()
const DEFAULT_CATS: EventCategory[] = ['seismic', 'disaster', 'space', 'orbital', 'signals']

export const useStore = create<DRTCState>((set) => ({
  events: [],
  markets: [],
  sources: Object.fromEntries(INITIAL_SOURCES.map((s) => [s.id, s])),
  countryRisk: [],
  threat: { level: 1, label: 'NOMINAL', index: 0, trend: 'flat' },
  threatHistory: [],
  brief: '',
  alerts: [],
  selectedId: null,
  activeCategories: new Set<EventCategory>(prefs?.activeCategories ?? DEFAULT_CATS),
  minSeverity: prefs?.minSeverity ?? 0,
  query: '',
  paused: false,
  commandOpen: false,
  lastTick: 0,

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
      const high = incoming.filter((e) => e.severity >= ALERT_THRESHOLD)
      if (!warmedSources.has(sourceId)) {
        high.forEach((e) => alerted.add(e.id))
        warmedSources.add(sourceId)
      } else {
        const fresh = high.filter((e) => !alerted.has(e.id))
        if (fresh.length) {
          fresh.forEach((e) => alerted.add(e.id))
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
      return { events: merged, alerts }
    }),

  setMarkets: (ticks) => set({ markets: ticks }),

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
      next.has(cat) ? next.delete(cat) : next.add(cat)
      savePrefs({ activeCategories: [...next], minSeverity: s.minSeverity })
      return { activeCategories: next }
    }),

  setMinSeverity: (v) =>
    set((s) => {
      savePrefs({ activeCategories: [...s.activeCategories], minSeverity: v })
      return { minSeverity: v }
    }),

  setQuery: (q) => set({ query: q }),
  togglePause: () => set((s) => ({ paused: !s.paused })),
  setCommandOpen: (open) => set({ commandOpen: open }),
  dismissAlert: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),
  clearAlerts: () => set({ alerts: [] }),
}))

// Helper: which source an event belongs to (stashed on ingest).
function srcOf(e: IntelEvent): string | undefined {
  return (e as IntelEvent & { __src?: string }).__src
}

// Globe + feed share this filtered view (category + severity floor).
export const visibleEvents = (s: DRTCState): IntelEvent[] =>
  s.events.filter(
    (e) =>
      s.activeCategories.has(e.category) &&
      (e.category === 'orbital' || e.severity >= s.minSeverity),
  )
