import { describe, expect, it } from 'vitest'
import { ALERT_KM, screenConjunctions } from './conjunctions'
import type { TrackedSat } from '../types'

// Two co-orbital objects: the ISS element set and a "twin" phased a hair ahead in
// mean anomaly. They ride the same ellipse, so a close approach is guaranteed.
const ISS: TrackedSat = {
  id: 25544,
  name: 'ISS (ZARYA)',
  line1: '1 25544U 98067A   20029.51782528 -.00016717  00000-0 -10270-3 0  9009',
  line2: '2 25544  51.6423 339.0822 0007423  68.4684 280.0578 15.49514637 18888',
}
const TWIN: TrackedSat = {
  id: 99999,
  name: 'TWIN',
  line1: '1 25544U 98067A   20029.51782528 -.00016717  00000-0 -10270-3 0  9009',
  line2: '2 25544  51.6423 339.0822 0007423  68.4684 280.0878 15.49514637 18888',
}
const NOW = Date.UTC(2020, 0, 29, 12, 30, 0)

describe('screenConjunctions', () => {
  it('finds the single pair among two objects', () => {
    const cdms = screenConjunctions([ISS, TWIN], NOW, { horizonHours: 2, stepSec: 60 })
    expect(cdms).toHaveLength(1)
    expect(new Set([cdms[0].aId, cdms[0].bId])).toEqual(new Set([25544, 99999]))
  })

  it('reports a physical, alert-flagged close approach', () => {
    const c = screenConjunctions([ISS, TWIN], NOW, { horizonHours: 2, stepSec: 60 })[0]
    expect(c.missKm).toBeGreaterThan(0)
    expect(c.missKm).toBeLessThan(100)
    expect(c.relSpeedKmS).toBeGreaterThanOrEqual(0)
    expect(c.tca).toBeGreaterThanOrEqual(NOW)
    expect(c.tca).toBeLessThanOrEqual(NOW + 2 * 3600 * 1000)
    expect(c.alert).toBe(c.missKm < ALERT_KM)
  })

  it('sorts by miss distance and respects topK', () => {
    const cdms = screenConjunctions([ISS, TWIN, ISS], NOW, {
      horizonHours: 1,
      stepSec: 60,
      topK: 2,
    })
    expect(cdms.length).toBeLessThanOrEqual(2)
    const misses = cdms.map((c) => c.missKm)
    expect(misses).toEqual([...misses].sort((a, b) => a - b))
  })

  it('returns nothing for a single object', () => {
    expect(screenConjunctions([ISS], NOW)).toEqual([])
  })
})
