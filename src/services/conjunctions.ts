// Conjunction screening (frontend engine): closest approaches between tracked
// objects. Mirrors the backend's app/orbital/conjunctions.py so the standalone
// app shows the same space-domain-awareness picture without a server.
//
// Separation is computed in the ECI (TEME) frame satellite.js returns, which is
// frame-consistent for two objects sampled at the same instant.
import * as satellite from 'satellite.js'
import type { Conjunction, TrackedSat } from '../types'

/** A miss closer than this is flagged as a screening alert. */
export const ALERT_KM = 25

type Vec3 = [number, number, number]

function satrecOf(sat: TrackedSat): satellite.SatRec | null {
  try {
    const rec = satellite.twoline2satrec(sat.line1, sat.line2)
    return rec && !rec.error ? rec : null
  } catch {
    return null
  }
}

function stateAt(rec: satellite.SatRec, ms: number): { p: Vec3; v: Vec3 } | null {
  const pv = satellite.propagate(rec, new Date(ms))
  if (!pv || typeof pv.position === 'boolean' || typeof pv.velocity === 'boolean') return null
  if (!pv.position || !pv.velocity) return null
  return {
    p: [pv.position.x, pv.position.y, pv.position.z],
    v: [pv.velocity.x, pv.velocity.y, pv.velocity.z],
  }
}

function sep(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

// Ternary search for the minimum separation time inside [lo, hi] (epoch ms).
function refineTca(a: satellite.SatRec, b: satellite.SatRec, lo: number, hi: number): number {
  for (let k = 0; k < 40 && hi - lo > 200; k++) {
    const m1 = lo + (hi - lo) / 3
    const m2 = hi - (hi - lo) / 3
    const sa1 = stateAt(a, m1)
    const sb1 = stateAt(b, m1)
    const sa2 = stateAt(a, m2)
    const sb2 = stateAt(b, m2)
    if (!sa1 || !sb1 || !sa2 || !sb2) break
    if (sep(sa1.p, sb1.p) < sep(sa2.p, sb2.p)) hi = m2
    else lo = m1
  }
  return (lo + hi) / 2
}

export function screenConjunctions(
  sats: TrackedSat[],
  nowMs: number,
  opts: { horizonHours?: number; stepSec?: number; topK?: number } = {},
): Conjunction[] {
  const horizonHours = opts.horizonHours ?? 6
  const stepSec = opts.stepSec ?? 60
  const topK = opts.topK ?? 12
  const stepMs = stepSec * 1000
  const steps = Math.floor((horizonHours * 3600) / stepSec)

  const recs = sats
    .map((s) => ({ sat: s, rec: satrecOf(s) }))
    .filter((r): r is { sat: TrackedSat; rec: satellite.SatRec } => r.rec !== null)

  // Precompute each object's position track once.
  const tracks: (Vec3 | null)[][] = recs.map(({ rec }) => {
    const pts: (Vec3 | null)[] = []
    for (let i = 0; i <= steps; i++) {
      const st = stateAt(rec, nowMs + i * stepMs)
      pts.push(st ? st.p : null)
    }
    return pts
  })

  const out: Conjunction[] = []
  for (let i = 0; i < recs.length; i++) {
    for (let j = i + 1; j < recs.length; j++) {
      let bestIdx = -1
      let bestD = Infinity
      for (let k = 0; k <= steps; k++) {
        const pa = tracks[i][k]
        const pb = tracks[j][k]
        if (!pa || !pb) continue
        const d = sep(pa, pb)
        if (d < bestD) {
          bestD = d
          bestIdx = k
        }
      }
      if (bestIdx < 0) continue
      const lo = nowMs + Math.max(0, bestIdx - 1) * stepMs
      const hi = nowMs + Math.min(steps, bestIdx + 1) * stepMs
      const tca = refineTca(recs[i].rec, recs[j].rec, lo, hi)

      const sa = stateAt(recs[i].rec, tca)
      const sb = stateAt(recs[j].rec, tca)
      if (!sa || !sb) continue
      const missKm = sep(sa.p, sb.p)
      const relSpeedKmS = Math.hypot(sa.v[0] - sb.v[0], sa.v[1] - sb.v[1], sa.v[2] - sb.v[2])

      const a = recs[i].sat
      const b = recs[j].sat
      out.push({
        id: `cdm-${a.id}-${b.id}-${Math.round(tca)}`,
        aId: a.id,
        aName: a.name,
        bId: b.id,
        bName: b.name,
        tca,
        missKm,
        relSpeedKmS,
        alert: missKm < ALERT_KM,
      })
    }
  }

  out.sort((x, y) => x.missKm - y.missKm)
  return out.slice(0, topK)
}
