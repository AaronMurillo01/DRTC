// SGP4 pass prediction: given current TLEs and the ground-station network,
// propagate each spacecraft forward and find the contact windows (passes) when
// it rises above a station's elevation mask. Each window carries a refined
// AOS/LOS, peak elevation, a rough link budget, and a Doppler estimate, so the
// schedule reads like a real TT&C / downlink plan.
//
// All functions are pure (time is injected) so the engine is unit-testable.
import * as satellite from 'satellite.js'
import type { ContactWindow, GroundStation, SatPosition, SkySample, TrackedSat } from '../types'

const D2R = Math.PI / 180
const R2D = 180 / Math.PI

// Representative downlink rates by band (Mbit/s) and carrier frequency (GHz).
// Real numbers depend on the modem, coding and link margin; these are
// order-of-magnitude estimates that drive the budget + Doppler readouts.
const BAND_MBPS: Record<string, number> = { UHF: 0.0096, S: 6, X: 150, Ku: 300, Ka: 800 }
const BAND_GHZ: Record<string, number> = { UHF: 0.43, S: 2.25, X: 8.2, Ku: 12, Ka: 26 }

function bestBand(bands: string[]): { band: string; mbps: number; ghz: number } {
  let band = bands[0] ?? 'S'
  let mbps = BAND_MBPS[band] ?? 6
  for (const b of bands) {
    const r = BAND_MBPS[b] ?? 0
    if (r > mbps) {
      mbps = r
      band = b
    }
  }
  return { band, mbps, ghz: BAND_GHZ[band] ?? 2.25 }
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

interface Look {
  el: number
  az: number
  rangeKm: number
}

// Look angle (deg) from a station to a satellite at time t, or null if decayed.
function lookAngle(
  satrec: satellite.SatRec,
  gd: satellite.GeodeticLocation,
  t: number,
): Look | null {
  const date = new Date(t)
  const pv = satellite.propagate(satrec, date)
  if (!pv || typeof pv.position === 'boolean' || !pv.position) return null
  const gmst = satellite.gstime(date)
  const ecf = satellite.eciToEcf(pv.position, gmst)
  const la = satellite.ecfToLookAngles(gd, ecf)
  return { el: la.elevation * R2D, az: (la.azimuth * R2D + 360) % 360, rangeKm: la.rangeSat }
}

function elevationAt(satrec: satellite.SatRec, gd: satellite.GeodeticLocation, t: number): number {
  return lookAngle(satrec, gd, t)?.el ?? -90
}

// Bisection for the instant elevation crosses `mask`, given a bracket [lo, hi]
// where elevation-mask changes sign. Refines a 30 s sample to ~1 s.
function crossTime(
  satrec: satellite.SatRec,
  gd: satellite.GeodeticLocation,
  mask: number,
  lo: number,
  hi: number,
): number {
  const fLoNeg = elevationAt(satrec, gd, lo) - mask < 0
  for (let k = 0; k < 18; k++) {
    const mid = (lo + hi) / 2
    const fMidNeg = elevationAt(satrec, gd, mid) - mask < 0
    if (fMidNeg === fLoNeg) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

// Ternary search for the time of maximum elevation (the pass is unimodal in el).
function culmination(
  satrec: satellite.SatRec,
  gd: satellite.GeodeticLocation,
  lo: number,
  hi: number,
): { t: number; el: number } {
  for (let k = 0; k < 40 && hi - lo > 500; k++) {
    const m1 = lo + (hi - lo) / 3
    const m2 = hi - (hi - lo) / 3
    if (elevationAt(satrec, gd, m1) < elevationAt(satrec, gd, m2)) lo = m1
    else hi = m2
  }
  const t = (lo + hi) / 2
  return { t, el: elevationAt(satrec, gd, t) }
}

// Peak Doppler shift magnitude (kHz) for the carrier, sampled near AOS where the
// range rate is largest.
function dopplerKHz(
  satrec: satellite.SatRec,
  gd: satellite.GeodeticLocation,
  t: number,
  ghz: number,
): number {
  const date = new Date(t)
  const pv = satellite.propagate(satrec, date)
  if (
    !pv ||
    typeof pv.position === 'boolean' ||
    typeof pv.velocity === 'boolean' ||
    !pv.position ||
    !pv.velocity
  ) {
    return 0
  }
  const gmst = satellite.gstime(date)
  const posEcf = satellite.eciToEcf(pv.position, gmst)
  const velEcf = satellite.eciToEcf(pv.velocity, gmst)
  const obsEcf = satellite.geodeticToEcf(gd)
  const factor = satellite.dopplerFactor(obsEcf, posEcf, velEcf)
  const shiftHz = (factor - 1) * ghz * 1e9
  return Math.abs(shiftHz) / 1000
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

/** Azimuth/elevation track of a pass, for the sky (polar) plot. */
export function skyTrack(
  sat: TrackedSat,
  station: GroundStation,
  aos: number,
  los: number,
  n = 40,
): SkySample[] {
  const satrec = buildSatrec(sat)
  if (!satrec) return []
  const gd = { longitude: station.lng * D2R, latitude: station.lat * D2R, height: 0 }
  const out: SkySample[] = []
  for (let i = 0; i <= n; i++) {
    const l = lookAngle(satrec, gd, aos + ((los - aos) * i) / n)
    if (l) out.push({ az: l.az, el: Math.max(0, l.el) })
  }
  return out
}

export interface PassResult {
  passes: ContactWindow[]
  positions: SatPosition[]
}

interface OpenPass {
  aos: number
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
  const stepMs = stepSec * 1000
  const steps = Math.floor((horizonHours * 3600) / stepSec)
  const passes: ContactWindow[] = []
  const positions: SatPosition[] = []

  const obs = stations.map((st) => ({
    st,
    gd: { longitude: st.lng * D2R, latitude: st.lat * D2R, height: 0 },
    link: bestBand(st.bands),
  }))

  for (const sat of sats) {
    const satrec = buildSatrec(sat)
    if (!satrec) continue

    const pos = subpoint(sat, now)
    if (pos) positions.push(pos)

    const finalize = (
      st: GroundStation,
      gd: satellite.GeodeticLocation,
      link: { band: string; mbps: number; ghz: number },
      o: OpenPass,
      losRaw: number,
    ): ContactWindow => {
      const los = losRaw > o.aos ? losRaw : o.aos + stepMs
      const durationSec = (los - o.aos) / 1000
      const peak = culmination(satrec, gd, o.aos, los)
      return {
        id: `pass-${sat.id}-${st.id}-${Math.round(o.aos)}`,
        satId: sat.id,
        satName: sat.name,
        stationId: st.id,
        stationName: st.name,
        operator: st.operator,
        aos: o.aos,
        los,
        durationSec,
        maxElevationDeg: Math.max(peak.el, st.minElevDeg),
        startAz: o.startAz,
        endAz: o.lastAz,
        band: link.band,
        downlinkMbps: link.mbps,
        // megabits → megabytes over the pass
        volumeMb: (link.mbps * durationSec) / 8,
        dopplerKHz: dopplerKHz(satrec, gd, o.aos, link.ghz),
      }
    }

    const open: (OpenPass | null)[] = obs.map(() => null)
    const prevEl: number[] = obs.map(() => -90)
    for (let i = 0; i <= steps; i++) {
      const t = now + i * stepMs
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
        const above = elDeg >= st.minElevDeg
        const wasAbove = prevEl[s] >= st.minElevDeg
        const o = open[s]

        if (above && !o) {
          // Rising edge: refine AOS within the previous step (or use now if the
          // pass was already in progress at the horizon start).
          const aos = i > 0 ? crossTime(satrec, gd, st.minElevDeg, t - stepMs, t) : t
          open[s] = { aos, startAz: azDeg, lastAz: azDeg, lastT: t }
        } else if (above && o) {
          o.lastAz = azDeg
          o.lastT = t
        } else if (!above && o && wasAbove) {
          // Setting edge: refine LOS between the last in-view sample and now.
          const los = crossTime(satrec, gd, st.minElevDeg, o.lastT, t)
          passes.push(finalize(st, gd, link, o, los))
          open[s] = null
        } else if (!above && o) {
          passes.push(finalize(st, gd, link, o, o.lastT))
          open[s] = null
        }
        prevEl[s] = elDeg
      }
    }
    // Close passes still open at the horizon edge.
    for (let s = 0; s < obs.length; s++) {
      const o = open[s]
      if (o) passes.push(finalize(obs[s].st, obs[s].gd, obs[s].link, o, o.lastT))
    }
  }

  passes.sort((a, b) => a.aos - b.aos)
  return { passes, positions }
}

/** Passes that are live right now (AOS ≤ now ≤ LOS). */
export function activeContacts(passes: ContactWindow[], now: number): ContactWindow[] {
  return passes.filter((p) => now >= p.aos && now <= p.los)
}
