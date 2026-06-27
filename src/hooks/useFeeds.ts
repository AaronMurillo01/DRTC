import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import { fetchSeismic } from '../services/seismic'
import { fetchDisasters } from '../services/disasters'
import { fetchSpace } from '../services/space'
import { fetchOrbital } from '../services/orbital'
import { fetchSignals } from '../services/signals'
import { fetchMarkets } from '../services/markets'
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
  { id: 'market', intervalMs: 60_000, run: async () => {
      const { ticks, latencyMs } = await fetchMarkets()
      useStore.getState().setMarkets(ticks)
      return { latencyMs }
    } },
  { id: 'space', intervalMs: 120_000, run: fetchSpace },
  { id: 'signals', intervalMs: 180_000, run: fetchSignals },
  { id: 'disaster', intervalMs: 300_000, run: fetchDisasters },
]

export function useFeeds() {
  const timers = useRef<number[]>([])

  useEffect(() => {
    const { setSourceStatus, ingest, recompute } = useStore.getState()

    const tick = async (spec: FeedSpec) => {
      if (useStore.getState().paused) return
      try {
        const { events, latencyMs } = await spec.run()
        if (events) ingest(spec.id, events)
        setSourceStatus(spec.id, {
          status: latencyMs > 6000 ? 'degraded' : 'online',
          lastSync: Date.now(),
          latencyMs,
          count: events ? events.length : useStore.getState().sources[spec.id].count,
          error: undefined,
        })
      } catch (err) {
        setSourceStatus(spec.id, {
          status: 'offline',
          error: err instanceof Error ? err.message : 'fetch failed',
        })
      }
      recompute()
    }

    // Kick all feeds immediately, then schedule each on its own cadence.
    FEEDS.forEach((spec) => {
      tick(spec)
      const t = window.setInterval(() => tick(spec), spec.intervalMs)
      timers.current.push(t)
    })

    return () => {
      timers.current.forEach((t) => window.clearInterval(t))
      timers.current = []
    }
  }, [])
}
