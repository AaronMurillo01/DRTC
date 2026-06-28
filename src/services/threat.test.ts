import { describe, expect, it } from 'vitest'
import { buildBrief, computeCountryRisk, computeThreat } from './threat'
import type { IntelEvent } from '../types'

function ev(p: Partial<IntelEvent>): IntelEvent {
  return {
    id: Math.random().toString(36),
    source: 'TEST',
    category: 'seismic',
    severity: 50,
    title: 't',
    summary: 's',
    timestamp: Date.now(),
    ...p,
  }
}

describe('computeThreat', () => {
  it('returns NOMINAL for an empty picture', () => {
    const t = computeThreat([])
    expect(t.level).toBe(1)
    expect(t.index).toBe(0)
  })

  it('escalates condition as severity/volume rise', () => {
    const calm = computeThreat([ev({ severity: 20 })])
    const hot = computeThreat(
      Array.from({ length: 12 }, () => ev({ severity: 95, category: 'signals' })),
    )
    expect(hot.index).toBeGreaterThan(calm.index)
    expect(hot.level).toBeGreaterThan(calm.level)
  })

  it('ignores non-threat reference layers (orbital/infra/market)', () => {
    const withInfra = computeThreat([
      ev({ severity: 95, category: 'signals' }),
      ev({ severity: 100, category: 'nuclear' }),
      ev({ severity: 100, category: 'spaceport' }),
      ev({ severity: 100, category: 'orbital' }),
    ])
    const without = computeThreat([ev({ severity: 95, category: 'signals' })])
    expect(withInfra.index).toBe(without.index)
  })

  it('reports trend relative to previous index', () => {
    const events = Array.from({ length: 8 }, () => ev({ severity: 80 }))
    expect(computeThreat(events, 0).trend).toBe('up')
    expect(computeThreat(events, 100).trend).toBe('down')
  })
})

describe('computeCountryRisk', () => {
  it('raises a country score when severe events are nearby', () => {
    const base = computeCountryRisk([])
    const ukrBase = base.find((c) => c.iso === 'UA')!.score
    const withEvent = computeCountryRisk([
      ev({ lat: 50.45, lng: 30.5, severity: 100, category: 'signals' }),
    ])
    const ukr = withEvent.find((c) => c.iso === 'UA')!
    expect(ukr.score).toBeGreaterThan(ukrBase)
    expect(ukr.drivers).toContain('media/crisis signals')
  })

  it('does not let reference infrastructure drive instability', () => {
    const withNuke = computeCountryRisk([
      ev({ lat: 39.03, lng: 125.75, severity: 100, category: 'nuclear' }),
    ])
    const kp = withNuke.find((c) => c.iso === 'KP')!
    expect(kp.drivers).toEqual(['baseline posture'])
  })

  it('is sorted by descending score', () => {
    const r = computeCountryRisk([])
    for (let i = 1; i < r.length; i++) expect(r[i - 1].score).toBeGreaterThanOrEqual(r[i].score)
  })
})

describe('buildBrief', () => {
  it('summarizes condition and counts', () => {
    const events = [ev({ category: 'seismic', severity: 80, region: 'Pacific' })]
    const threat = computeThreat(events)
    const text = buildBrief(events, threat, computeCountryRisk(events), [])
    expect(text).toContain(`Condition ${threat.level}`)
    expect(text).toContain('seismic')
  })

  it('handles an empty picture gracefully', () => {
    expect(buildBrief([], computeThreat([]), [], [])).toMatch(/Awaiting/)
  })
})
