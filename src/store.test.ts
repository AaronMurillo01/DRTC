import { beforeEach, describe, expect, it } from 'vitest'
import { feedEvents, useStore, visibleEvents } from './store'
import type { EventCategory, IntelEvent } from './types'

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

beforeEach(() => {
  useStore.setState({
    events: [],
    alerts: [],
    alertedIds: new Set<string>(),
    warmedSources: new Set<string>(),
    minSeverity: 0,
    timeRange: 'all',
    activeCategories: new Set<EventCategory>([
      'seismic',
      'disaster',
      'space',
      'orbital',
      'signals',
      'nuclear',
      'spaceport',
    ]),
  })
})

describe('ingest', () => {
  it('replaces a source batch wholesale while preserving other sources', () => {
    const { ingest } = useStore.getState()
    ingest('alpha', [ev({ id: 'a1', title: 'first' })])
    ingest('bravo', [ev({ id: 'b1', title: 'bravo' })])
    ingest('alpha', [ev({ id: 'a2', title: 'second' })])
    const ids = useStore.getState().events.map((e) => e.id)
    expect(ids).toContain('a2')
    expect(ids).toContain('b1')
    expect(ids).not.toContain('a1')
  })

  it('warms up silently then alerts on fresh criticals', () => {
    const { ingest } = useStore.getState()
    ingest('warm', [ev({ id: 'H1', severity: 95 })]) // seed, no alert
    expect(useStore.getState().alerts).toHaveLength(0)
    ingest('warm', [ev({ id: 'H2', severity: 95 })]) // fresh critical → alert
    expect(useStore.getState().alerts.length).toBeGreaterThanOrEqual(1)
    expect(useStore.getState().alerts[0].eventId).toBe('H2')
  })
})

describe('visibleEvents / feedEvents', () => {
  it('filters by severity floor (exempting orbital)', () => {
    useStore
      .getState()
      .ingest('s', [ev({ id: 'lo', severity: 10 }), ev({ id: 'hi', severity: 80 })])
    useStore.setState({ minSeverity: 50 })
    const vis = visibleEvents(useStore.getState()).map((e) => e.id)
    expect(vis).toContain('hi')
    expect(vis).not.toContain('lo')
  })

  it('filters by active category', () => {
    useStore.getState().ingest('s', [ev({ id: 'q', category: 'seismic' })])
    useStore.setState({ activeCategories: new Set<EventCategory>(['disaster']) })
    expect(visibleEvents(useStore.getState())).toHaveLength(0)
  })

  it('respects the time window for non-exempt categories', () => {
    useStore
      .getState()
      .ingest('s', [
        ev({ id: 'old', timestamp: Date.now() - 10 * 24 * 3600_000 }),
        ev({ id: 'new', timestamp: Date.now() }),
      ])
    useStore.setState({ timeRange: '24h' })
    const vis = visibleEvents(useStore.getState()).map((e) => e.id)
    expect(vis).toContain('new')
    expect(vis).not.toContain('old')
  })

  it('excludes static reference layers from the intel feed only', () => {
    useStore
      .getState()
      .ingest('s', [
        ev({ id: 'nuke', category: 'nuclear' }),
        ev({ id: 'quake', category: 'seismic' }),
      ])
    const feed = feedEvents(useStore.getState()).map((e) => e.id)
    const vis = visibleEvents(useStore.getState()).map((e) => e.id)
    expect(feed).toContain('quake')
    expect(feed).not.toContain('nuke')
    expect(vis).toContain('nuke')
  })
})
