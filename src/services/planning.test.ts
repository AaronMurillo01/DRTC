import { describe, expect, it } from 'vitest'
import { planContacts } from './planning'
import type { ContactWindow } from '../types'

const T0 = 1_700_000_000_000

function cw(
  id: string,
  satId: number,
  stationId: string,
  startMin: number,
  durMin: number,
  vol: number,
): ContactWindow {
  const aos = T0 + startMin * 60_000
  const los = aos + durMin * 60_000
  return {
    id,
    satId,
    satName: `SAT${satId}`,
    stationId,
    stationName: stationId,
    operator: 'OP',
    aos,
    los,
    durationSec: durMin * 60,
    maxElevationDeg: 30,
    startAz: 10,
    endAz: 200,
    band: 'X',
    downlinkMbps: 150,
    volumeMb: vol,
    dopplerKHz: 180,
  }
}

describe('planContacts', () => {
  it('keeps non-conflicting passes', () => {
    const r = planContacts([
      cw('a', 1, 'st1', 0, 10, 100),
      cw('b', 2, 'st2', 0, 10, 100),
      cw('c', 1, 'st1', 20, 10, 100),
    ])
    expect(r.scheduledCount).toBe(3)
    expect(r.droppedCount).toBe(0)
  })

  it('drops the lower-value pass when a station double-books', () => {
    const r = planContacts([cw('low', 1, 'st1', 0, 10, 50), cw('high', 2, 'st1', 5, 10, 500)])
    expect(r.scheduledCount).toBe(1)
    expect(r.scheduledIds.has('high')).toBe(true)
    expect(r.scheduledIds.has('low')).toBe(false)
  })

  it('will not put one satellite in two overlapping contacts', () => {
    const r = planContacts([cw('s1', 7, 'st1', 0, 10, 100), cw('s2', 7, 'st2', 3, 10, 100)])
    expect(r.scheduledCount).toBe(1)
  })

  it('sums the scheduled volume', () => {
    const r = planContacts([cw('a', 1, 'st1', 0, 10, 120), cw('b', 2, 'st2', 0, 10, 80)])
    expect(r.scheduledCount).toBe(2)
    expect(r.totalVolumeMb).toBe(200)
  })

  it('handles an empty list', () => {
    const r = planContacts([])
    expect(r.scheduledCount).toBe(0)
    expect(r.droppedCount).toBe(0)
  })
})
