import { describe, expect, it } from 'vitest'
import { clamp, fmtPrice, timeAgo } from './utils'
import { hashId } from './services/http'

describe('utils', () => {
  it('clamp bounds values', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(99, 0, 10)).toBe(10)
  })

  it('fmtPrice scales precision by magnitude', () => {
    expect(fmtPrice(0.1234)).toBe('0.1234')
    expect(fmtPrice(12.3456)).toBe('12.35')
    expect(fmtPrice(98765)).toBe('98,765')
  })

  it('timeAgo renders compact units', () => {
    expect(timeAgo(Date.now())).toMatch(/^\d+s$/)
    expect(timeAgo(Date.now() - 90_000)).toMatch(/m$/)
    expect(timeAgo(Date.now() - 3 * 3600_000)).toMatch(/h$/)
  })
})

describe('hashId', () => {
  it('is stable for the same inputs', () => {
    expect(hashId('eq', 'abc', 1)).toBe(hashId('eq', 'abc', 1))
  })
  it('differs for different inputs', () => {
    expect(hashId('eq', 'abc')).not.toBe(hashId('eq', 'abd'))
  })
})
