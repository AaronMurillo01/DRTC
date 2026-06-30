import { useEffect } from 'react'
import { useStore } from '../store'

// Records a history frame on a fixed cadence so the replay slider has something
// to scrub. Captures the raw event set + threat at each tick; the store keeps a
// bounded ring of frames. Works the same whether events come from the local
// pollers or the live backend. Recording pauses while the user is scrubbing.
const INTERVAL_MS = 15_000

export function useHistory() {
  useEffect(() => {
    const tick = () => {
      const s = useStore.getState()
      if (s.replayAt != null) return // don't record while replaying
      if (s.events.length === 0) return
      s.pushReplayFrame({
        ts: Date.now(),
        index: s.threat.index,
        level: s.threat.level,
        events: s.events,
      })
    }
    tick()
    const t = window.setInterval(tick, INTERVAL_MS)
    return () => window.clearInterval(t)
  }, [])
}
