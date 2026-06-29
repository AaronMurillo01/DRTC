import { describe, expect, it } from 'vitest'
import { activeContacts, computePasses, subpoint } from './passes'
import { GROUND_STATIONS } from './groundstations'
import type { TrackedSat } from '../types'

// Canonical, well-formed ISS TLE (the example set shipped with satellite.js).
const ISS: TrackedSat = {
  id: 25544,
  name: 'ISS (ZARYA)',
  line1: '1 25544U 98067A   20029.51782528 -.00016717  00000-0 -10270-3 0  9009',
  line2: '2 25544  51.6423 339.0822 0007423  68.4684 280.0578 15.49514637 18888',
}

// A fixed instant a few minutes after the TLE epoch, so results are deterministic.
const NOW = Date.UTC(2020, 0, 29, 12, 30, 0)

describe('subpoint', () => {
  it('returns a finite sub-satellite point near LEO altitude', () => {
    const p = subpoint(ISS, NOW)
    expect(p).not.toBeNull()
    expect(Number.isFinite(p!.lat)).toBe(true)
    expect(Number.isFinite(p!.lng)).toBe(true)
    expect(p!.lat).toBeGreaterThanOrEqual(-90)
    expect(p!.lat).toBeLessThanOrEqual(90)
    // ISS orbits ~400-420 km up.
    expect(p!.altKm).toBeGreaterThan(300)
    expect(p!.altKm).toBeLessThan(500)
  })

  it('returns null for a malformed TLE', () => {
    expect(subpoint({ id: 0, name: 'x', line1: 'garbage', line2: 'garbage' }, NOW)).toBeNull()
  })
})

describe('computePasses', () => {
  const { passes, positions } = computePasses([ISS], GROUND_STATIONS, NOW, {
    horizonHours: 24,
    stepSec: 60,
  })

  it('propagates one sub-point for the tracked satellite', () => {
    expect(positions).toHaveLength(1)
    expect(positions[0].id).toBe(25544)
  })

  it('finds contact windows over the network', () => {
    expect(passes.length).toBeGreaterThan(0)
  })

  it('produces physically valid, station-consistent passes', () => {
    const byId = new Map(GROUND_STATIONS.map((s) => [s.id, s]))
    for (const p of passes) {
      const st = byId.get(p.stationId)!
      expect(p.los).toBeGreaterThan(p.aos)
      expect(p.durationSec).toBeGreaterThan(0)
      expect(p.maxElevationDeg).toBeGreaterThanOrEqual(st.minElevDeg)
      expect(p.maxElevationDeg).toBeLessThanOrEqual(90)
      expect(p.startAz).toBeGreaterThanOrEqual(0)
      expect(p.startAz).toBeLessThanOrEqual(360)
      expect(p.downlinkMbps).toBeGreaterThan(0)
      expect(p.volumeMb).toBeGreaterThan(0)
    }
  })

  it('returns passes sorted by AOS', () => {
    for (let i = 1; i < passes.length; i++) {
      expect(passes[i].aos).toBeGreaterThanOrEqual(passes[i - 1].aos)
    }
  })

  it('activeContacts selects only windows spanning the given instant', () => {
    const p = passes[0]
    const mid = (p.aos + p.los) / 2
    const live = activeContacts(passes, mid)
    expect(live).toContainEqual(p)
    expect(live.every((c) => mid >= c.aos && mid <= c.los)).toBe(true)
  })
})
