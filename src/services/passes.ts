// SGP4 pass prediction: given current TLEs and the ground-station network,
// propagate each spacecraft forward and find the contact windows (passes) when
// it rises above a station's elevation mask. Each window carries a rough link
// budget so the schedule reads like a real TT&C / downlink plan.
//
// All functions are pure (time is injected) so the engine is unit-testable.
import * as satellite from 'satellite.js'
import type { ContactWindow, GroundStation, SatPosition, TrackedSat } from '../types'

const D2R = Math.PI / 180
const R2D = 180 / Math.PI

// Representative downlink rates by band (Mbit/s). Real numbers depend on the
// modem, coding and link margin; these are order-of-magnitude estimates.
const BAND_MBPS: Record<string, number> = { UHF: 0.0096, S: 6, X: 150, Ku: 300, Ka: 800 }

function bestBand(bands: string[]): { band: string; mbps: number } {
  let band = bands[0] ?? 'S'
  let mbps = BAND_MBPS[band] ?? 6
  for (const b of bands) {
    const r = BAND_MBPS[b] ?? 0
    if (r > mbps) {
      mbps = r
      band = b
    }
  }
  return { band, mbps }
}

// twoline2satrec tolerates junk input and returns a satrec with a non-zero
// `error` code (or one that propagates to NaN) instead of throwing — so we
// validate rather than rely on a catch.
function buildSatrec(sat: TrackedSat): satellite.SatRec | null {
  try {
    const rec = satellite.twoline2satrec(sat.line1, sat.line2)
    if (!rec || rec.error) return null
    return rec
  } catch {
    return null
  }
}

/** Current sub-satellite point + speed, or null if the propagation decayed. */
export function subpoint(sat: TrackedSat, at: number): SatPosition | null {
  const satrec = buildSatrec(sat)
  if (!satrec) return null
  const date = new Date(at)
  const pv = satellite.propagate(satrec, date)
  if (!pv || typeof pv.position === 'boolean' || !pv.position) return null
  const gmst = satellite.gstime(date)
  const gd = satellite.eciToGeodetic(pv.position, gmst)
  const lng = satellite.degreesLong(gd.longitude)
  const lat = satellite.degreesLat(gd.latitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(gd.height)) return null
  let v = 0
  if (pv.velocity && typeof pv.velocity !== 'boolean') {
    v = Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z)
  }
  return { id: sat.id, name: sat.name, lat, lng, altKm: gd.height, velocityKmS: v }
}

export interface PassResult {
  passes: ContactWindow[]
  positions: SatPosition[]
}

interface OpenPass {
  aos: number
  maxEl: number
  startAz: number
  lastAz: number
  lastT: number
}

export function computePasses(
  sats: TrackedSat[],
  stations: GroundStation[],
  now: number,
  opts: { horizonHours?: number; stepSec?: number } = {},
): PassResult {
  const horizonHours = opts.horizonHours ?? 12
  const stepSec = opts.stepSec ?? 30
  const steps = Math.floor((horizonHours * 3600) / stepSec)
  const passes: ContactWindow[] = []
  const positions: SatPosition[] = []

  const obs = stations.map((st) => ({
    st,
    gd: { longitude: st.lng * D2R, latitude: st.lat * D2R, height: 0 },
    link: bestBand(st.bands),
  }))

  const finalize = (
    sat: TrackedSat,
    st: GroundStation,
    link: { band: string; mbps: number },
    o: OpenPass,
  ): ContactWindow => {
    // A grazing pass seen in a single sample still lasted ~one step above the
    // mask; guarantee LOS > AOS so downstream math/UI stays well-formed.
    const los = o.lastT > o.aos ? o.lastT : o.aos + stepSec * 1000
    const durationSec = (los - o.aos) / 1000
    return {
      id: `pass-${sat.id}-${st.id}-${o.aos}`,
      satId: sat.id,
      satName: sat.name,
      stationId: st.id,
      stationName: st.name,
      operator: st.operator,
      aos: o.aos,
      los,
      durationSec,
      maxElevationDeg: o.maxEl,
      startAz: o.startAz,
      endAz: o.lastAz,
      band: link.band,
      downlinkMbps: link.mbps,
      // megabits → megabytes over the pass
      volumeMb: (link.mbps * durationSec) / 8,
    }
  }

  for (const sat of sats) {
    const satrec = buildSatrec(sat)
    if (!satrec) continue

    const pos = subpoint(sat, now)
    if (pos) positions.push(pos)

    const open: (OpenPass | null)[] = obs.map(() => null)
    for (let i = 0; i <= steps; i++) {
      const t = now + i * stepSec * 1000
      const date = new Date(t)
      const pv = satellite.propagate(satrec, date)
      if (!pv || typeof pv.position === 'boolean' || !pv.position) continue
      const gmst = satellite.gstime(date)
      const ecf = satellite.eciToEcf(pv.position, gmst)

      for (let s = 0; s < obs.length; s++) {
        const { st, gd, link } = obs[s]
        const la = satellite.ecfToLookAngles(gd, ecf)
        const elDeg = la.elevation * R2D
        const azDeg = (la.azimuth * R2D + 360) % 360
        const o = open[s]
        if (elDeg >= st.minElevDeg) {
          if (!o) {
            open[s] = { aos: t, maxEl: elDeg, startAz: azDeg, lastAz: azDeg, lastT: t }
          } else {
            if (elDeg > o.maxEl) o.maxEl = elDeg
            o.lastAz = azDeg
            o.lastT = t
          }
        } else if (o) {
          passes.push(finalize(sat, st, link, o))
          open[s] = null
        }
      }
    }
    // Close passes still open at the horizon edge.
    for (let s = 0; s < obs.length; s++) {
      const o = open[s]
      if (o) passes.push(finalize(sat, obs[s].st, obs[s].link, o))
    }
  }

  passes.sort((a, b) => a.aos - b.aos)
  return { passes, positions }
}

/** Passes that are live right now (AOS ≤ now ≤ LOS). */
export function activeContacts(passes: ContactWindow[], now: number): ContactWindow[] {
  return passes.filter((p) => now >= p.aos && now <= p.los)
}
