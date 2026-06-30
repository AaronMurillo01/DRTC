import { describe, expect, it } from 'vitest'
import { frameAt } from './store'
import type { ReplayFrame } from './types'

const f = (ts: number): ReplayFrame => ({ ts, index: ts, level: 1, events: [] })

describe('frameAt', () => {
  const frames = [f(1000), f(2000), f(3000)]

  it('returns the most recent frame at or before the instant', () => {
    expect(frameAt(frames, 2500)?.ts).toBe(2000)
    expect(frameAt(frames, 3000)?.ts).toBe(3000)
    expect(frameAt(frames, 9999)?.ts).toBe(3000)
  })

  it('falls back to the earliest frame before the buffer starts', () => {
    expect(frameAt(frames, 0)?.ts).toBe(1000)
  })

  it('returns null for an empty buffer', () => {
    expect(frameAt([], 1000)).toBeNull()
  })
})
