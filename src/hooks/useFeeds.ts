import { useEffect } from 'react'
import { useStore } from '../store'
import { fetchSeismic } from '../services/seismic'
import { fetchDisasters } from '../services/disasters'
import { fetchSpace } from '../services/space'
import { fetchOrbital } from '../services/orbital'
import { fetchSignals } from '../services/signals'
import { fetchMarkets } from '../services/markets'
import { fetchNuclear, fetchSpaceports } from '../services/static'
import type { IntelEvent } from '../types'

interface FeedSpec {
  id: string
  intervalMs: number
  run: () => Promise<{ events?: IntelEvent[]; latencyMs: number }>
}

// Refresh cadence tuned to each upstream's update rate + rate limits.
const FEEDS: FeedSpec[] = [
  { id: 'orbital', intervalMs: 5_000, run: fetchOrbital },
  { id: 'seismic', intervalMs: 60_000, run: fetchSeismic },
  {
    id: 'market',
    intervalMs: 60_000,
    run: async () => {
      const { ticks, latencyMs } = await fetchMarkets()
      useStore.getState().setMarkets(ticks)
      return { latencyMs }
    },
  },
  { id: 'space', intervalMs: 120_000, run: fetchSpace },
  { id: 'signals', intervalMs: 180_000, run: fetchSignals },
  { id: 'disaster', intervalMs: 300_000, run: fetchDisasters },
  // Static reference layers — load once, refresh rarely.
  { id: 'spaceport', intervalMs: 3_600_000, run: fetchSpaceports },
  { id: 'nuclear', intervalMs: 3_600_000, run: fetchNuclear },
]

const MAX_BACKOFF = 600_000 // 10 min ceiling for a wedged source

export function useFeeds() {
  useEffect(() => {
    const { setSourceStatus, ingest, recompute } = useStore.getState()
    const timers: number[] = []
    // Circuit breaker: a source that keeps failing is skipped until this time.
    const nextAllowed: Record<string, number> = {}
    let disposed = false

    const tick = async (spec: FeedSpec) => {
      if (disposed) return
      const state = useStore.getState()
      if (state.paused) return
      if (Date.now() < (nextAllowed[spec.id] ?? 0)) return // breaker open

      const prev = state.sources[spec.id]
      try {
        const { events, latencyMs } = await spec.run()
        if (disposed) return
        const history = [...prev.latencyHistory, latencyMs].slice(-30)
        setSourceStatus(spec.id, {
          status: latencyMs > 6000 ? 'degraded' : 'online',
          lastSync: Date.now(),
          latencyMs,
          latencyHistory: history,
          consecutiveFailures: 0,
          syncs: prev.syncs + 1,
          count: events ? events.length : prev.count,
          error: undefined,
        })
        if (events) ingest(spec.id, events)
        nextAllowed[spec.id] = 0
      } catch (err) {
        if (disposed) return
        const failures = prev.consecutiveFailures + 1
        // Exponential breaker backoff on repeated failure.
        const backoff = Math.min(MAX_BACKOFF, spec.intervalMs * 2 ** Math.min(failures, 6))
        nextAllowed[spec.id] = Date.now() + backoff
        setSourceStatus(spec.id, {
          status: 'offline',
          consecutiveFailures: failures,
          error: err instanceof Error ? err.message : 'fetch failed',
        })
      }
      recompute()
    }

    // Kick all feeds immediately, then schedule each on its own cadence.
    FEEDS.forEach((spec) => {
      tick(spec)
      timers.push(window.setInterval(() => tick(spec), spec.intervalMs))
    })

    return () => {
      disposed = true
      timers.forEach((t) => window.clearInterval(t))
    }
  }, [])
}
