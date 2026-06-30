import { useEffect } from 'react'
import { useStore } from '../store'
import { LiveClient, type LiveMessage } from '../services/liveClient'
import type { Conjunction, ContactWindow, FeedSource, IntelEvent, SatPosition } from '../types'

// When a backend URL is configured, drive the store from its websocket: the
// backend owns ingestion + orbital compute, and the client re-derives the
// analytic layers (country risk, threat, SITREP) from the streamed events so the
// picture stays complete. A no-op when `enabled` is false or no URL is set.
export function useLive(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const api = import.meta.env.VITE_DRTC_API as string | undefined
    if (!api) return

    const dispatch = (msg: LiveMessage) => {
      const s = useStore.getState()
      const p = msg.payload ?? {}
      const events = p.events as IntelEvent[] | undefined
      const sources = p.sources as Partial<FeedSource>[] | undefined
      const passes = p.passes as ContactWindow[] | undefined
      const positions = (p.satPositions as SatPosition[] | undefined) ?? []
      const conjunctions = p.conjunctions as Conjunction[] | undefined
      switch (msg.type) {
        case 'snapshot':
          if (events) s.setLiveEvents(events)
          if (sources) s.mergeSources(sources)
          if (passes) s.setPasses(passes, positions)
          if (conjunctions) s.setConjunctions(conjunctions)
          s.recompute()
          break
        case 'events':
          if (events) {
            s.setLiveEvents(events)
            s.recompute()
          }
          break
        case 'sources':
          if (sources) s.mergeSources(sources)
          break
        case 'passes':
          if (passes) s.setPasses(passes, positions)
          if (conjunctions) s.setConjunctions(conjunctions)
          break
        default:
          break
      }
    }

    const client = new LiveClient(api, dispatch, useStore.getState().setLiveStatus)
    client.connect()
    return () => client.close()
  }, [enabled])
}
