import { describe, expect, it } from 'vitest'
import { decode, wsUrl } from './liveClient'

describe('wsUrl', () => {
  it('maps http to ws and appends /ws', () => {
    expect(wsUrl('http://localhost:8000')).toBe('ws://localhost:8000/ws')
  })
  it('maps https to wss and trims a trailing slash', () => {
    expect(wsUrl('https://api.example.com/')).toBe('wss://api.example.com/ws')
  })
})

describe('decode', () => {
  it('parses a well-formed frame', () => {
    expect(decode('{"type":"threat","payload":{"index":5}}')).toEqual({
      type: 'threat',
      payload: { index: 5 },
    })
  })
  it('rejects malformed or incomplete frames', () => {
    expect(decode('not json')).toBeNull()
    expect(decode('{"type":"x"}')).toBeNull() // missing payload
    expect(decode('{"payload":{}}')).toBeNull() // missing type
    expect(decode('42')).toBeNull()
  })
})
