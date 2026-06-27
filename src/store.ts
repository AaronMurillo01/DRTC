import { create } from 'zustand'
import type {
  CountryRisk,
  EventCategory,
  FeedSource,
  IntelEvent,
  MarketTick,
  ThreatState,
} from './types'
import { computeCountryRisk, computeThreat } from './services/threat'

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

interface DRTCState {
  events: IntelEvent[]
  markets: MarketTick[]
  sources: Record<string, FeedSource>
  countryRisk: CountryRisk[]
  threat: ThreatState
  selectedId: string | null
  activeCategories: Set<EventCategory>
  paused: boolean
  commandOpen: boolean
  lastTick: number

  setSourceStatus: (id: string, patch: Partial<FeedSource>) => void
  ingest: (sourceId: string, events: IntelEvent[]) => void
  setMarkets: (ticks: MarketTick[]) => void
  recompute: () => void
  select: (id: string | null) => void
  toggleCategory: (cat: EventCategory) => void
  togglePause: () => void
  setCommandOpen: (open: boolean) => void
}

const INITIAL_SOURCES: FeedSource[] = [
  { id: 'seismic', label: 'USGS Seismic', category: 'seismic', status: 'pending', lastSync: null, count: 0, latencyMs: null },
  { id: 'disaster', label: 'NASA EONET', category: 'disaster', status: 'pending', lastSync: null, count: 0, latencyMs: null },
  { id: 'space', label: 'NOAA Space Wx', category: 'space', status: 'pending', lastSync: null, count: 0, latencyMs: null },
  { id: 'orbital', label: 'ISS Telemetry', category: 'orbital', status: 'pending', lastSync: null, count: 0, latencyMs: null },
  { id: 'signals', label: 'GDELT Signals', category: 'signals', status: 'pending', lastSync: null, count: 0, latencyMs: null },
  { id: 'market', label: 'Markets Radar', category: 'market', status: 'pending', lastSync: null, count: 0, latencyMs: null },
]

export const useStore = create<DRTCState>((set) => ({
  events: [],
  markets: [],
  sources: Object.fromEntries(INITIAL_SOURCES.map((s) => [s.id, s])),
  countryRisk: [],
  threat: { level: 1, label: 'NOMINAL', index: 0, trend: 'flat' },
  selectedId: null,
  activeCategories: new Set<EventCategory>([
    'seismic',
    'disaster',
    'space',
    'orbital',
    'signals',
  ]),
  paused: false,
  commandOpen: false,
  lastTick: 0,

  setSourceStatus: (id, patch) =>
    set((s) => ({ sources: { ...s.sources, [id]: { ...s.sources[id], ...patch } } })),

  ingest: (sourceId, incoming) =>
    set((s) => {
      // Replace this source's events wholesale, keep the rest.
      const others = s.events.filter((e) => e.source && srcOf(e) !== sourceId)
      const tagged = incoming.map((e) => ({ ...e, __src: sourceId }) as IntelEvent)
      const merged = [...others, ...tagged].sort((a, b) => b.timestamp - a.timestamp)
      return { events: merged }
    }),

  setMarkets: (ticks) => set({ markets: ticks }),

  recompute: () =>
    set((s) => ({
      countryRisk: computeCountryRisk(s.events),
      threat: computeThreat(s.events, s.threat.index),
      lastTick: Date.now(),
    })),

  select: (id) => set({ selectedId: id }),
  toggleCategory: (cat) =>
    set((s) => {
      const next = new Set(s.activeCategories)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return { activeCategories: next }
    }),
  togglePause: () => set((s) => ({ paused: !s.paused })),
  setCommandOpen: (open) => set({ commandOpen: open }),
}))

// Helper: which source an event belongs to (we stash it on ingest).
function srcOf(e: IntelEvent): string | undefined {
  return (e as IntelEvent & { __src?: string }).__src
}

export const visibleEvents = (s: DRTCState): IntelEvent[] =>
  s.events.filter((e) => s.activeCategories.has(e.category))
