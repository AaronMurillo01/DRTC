// Contact planning (frontend): resolve ground-station + satellite contention
// into a conflict-free contact plan. The backend solves this optimally with
// CP-SAT; the standalone app uses a greedy value-first pass that is fast and
// good enough to mark which contacts make the cut.
import type { ContactWindow } from '../types'

export interface ContactPlan {
  scheduledIds: Set<string>
  scheduledCount: number
  droppedCount: number
  totalVolumeMb: number
}

function overlaps(a: ContactWindow, b: ContactWindow): boolean {
  return a.aos < b.los && b.aos < a.los
}

export function planContacts(passes: ContactWindow[]): ContactPlan {
  // Highest-value passes first; keep a pass unless it collides with one already
  // chosen at the same station or for the same satellite.
  const sorted = [...passes].sort((a, b) => b.volumeMb - a.volumeMb)
  const chosen: ContactWindow[] = []
  for (const p of sorted) {
    const conflict = chosen.some(
      (c) => overlaps(p, c) && (c.stationId === p.stationId || c.satId === p.satId),
    )
    if (!conflict) chosen.push(p)
  }
  const scheduledIds = new Set(chosen.map((c) => c.id))
  const totalVolumeMb = chosen.reduce((s, c) => s + c.volumeMb, 0)
  return {
    scheduledIds,
    scheduledCount: chosen.length,
    droppedCount: passes.length - chosen.length,
    totalVolumeMb,
  }
}
