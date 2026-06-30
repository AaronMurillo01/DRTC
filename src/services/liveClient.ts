// Optional live-backend client. When VITE_DRTC_API is set, DRTC connects to the
// Python gateway's websocket and is driven by it (snapshot on connect, then
// deltas) instead of running its own pollers. When unset, the app stays fully
// standalone. The client auto-reconnects with capped backoff.

export type LiveStatus = 'off' | 'connecting' | 'online' | 'reconnecting'

export interface LiveMessage {
  type: string
  // Backend payloads are heterogeneous; consumers narrow by message type.
  payload: Record<string, unknown>
}

/** Build the websocket URL from an http(s) API base. */
export function wsUrl(api: string): string {
  const base = api.replace(/\/$/, '').replace(/^http/, 'ws')
  return `${base}/ws`
}

/** Parse a raw frame into a LiveMessage, or null if it is malformed. */
export function decode(raw: string): LiveMessage | null {
  try {
    const m = JSON.parse(raw)
    if (m && typeof m.type === 'string' && 'payload' in m) return m as LiveMessage
  } catch {
    /* ignore malformed frame */
  }
  return null
}

const MAX_BACKOFF = 15_000

export class LiveClient {
  private ws: WebSocket | null = null
  private closed = false
  private attempt = 0
  private timer: number | null = null

  constructor(
    private readonly api: string,
    private readonly onMessage: (msg: LiveMessage) => void,
    private readonly onStatus: (s: LiveStatus) => void,
  ) {}

  connect(): void {
    this.closed = false
    this.open()
  }

  private open(): void {
    this.onStatus(this.attempt === 0 ? 'connecting' : 'reconnecting')
    let ws: WebSocket
    try {
      ws = new WebSocket(wsUrl(this.api))
    } catch {
      this.scheduleReconnect()
      return
    }
    this.ws = ws

    ws.onopen = () => {
      this.attempt = 0
      this.onStatus('online')
    }
    ws.onmessage = (ev) => {
      const msg = decode(typeof ev.data === 'string' ? ev.data : '')
      if (msg) this.onMessage(msg)
    }
    ws.onclose = () => {
      if (!this.closed) this.scheduleReconnect()
    }
    ws.onerror = () => {
      // onclose fires after onerror; let it drive the reconnect.
      ws.close()
    }
  }

  private scheduleReconnect(): void {
    if (this.closed) return
    this.onStatus('reconnecting')
    const backoff = Math.min(MAX_BACKOFF, 1000 * 2 ** Math.min(this.attempt, 4))
    this.attempt += 1
    this.timer = window.setTimeout(() => this.open(), backoff)
  }

  close(): void {
    this.closed = true
    if (this.timer) window.clearTimeout(this.timer)
    this.timer = null
    this.ws?.close()
    this.ws = null
    this.onStatus('off')
  }
}
