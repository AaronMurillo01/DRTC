// Resilient fetch layer with timeout, bounded retry + exponential backoff,
// and latency measurement. All DRTC feeds use public, key-less, CORS endpoints.

export interface Timed<T> {
  data: T
  latencyMs: number
}

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

interface GetOpts {
  timeoutMs?: number
  retries?: number
  /** signal lets the caller abort an in-flight chain (e.g. on unmount) */
  signal?: AbortSignal
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// 4xx (except 408/429) are not worth retrying — they won't change.
function retriable(err: unknown): boolean {
  if (err instanceof HttpError && err.status != null) {
    return err.status === 408 || err.status === 429 || err.status >= 500
  }
  return true // network/abort/timeout — retry
}

export async function getJSON<T>(url: string, opts: GetOpts = {}): Promise<Timed<T>> {
  const { timeoutMs = 12000, retries = 2, signal } = opts
  const started = performance.now()
  let attempt = 0
  // total attempts = retries + 1

  for (;;) {
    const ctrl = new AbortController()
    const onAbort = () => ctrl.abort()
    signal?.addEventListener('abort', onAbort)
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
      if (!res.ok) throw new HttpError(`HTTP ${res.status}`, res.status)
      const data = (await res.json()) as T
      return { data, latencyMs: Math.round(performance.now() - started) }
    } catch (err) {
      if (signal?.aborted) throw err
      if (attempt >= retries || !retriable(err)) throw err
      // Exponential backoff with jitter: ~300ms, 600ms, … capped at 4s.
      const base = Math.min(4000, 300 * 2 ** attempt)
      const jitter = base * 0.3 * (attempt % 2 === 0 ? 1 : 0.5)
      await sleep(base + jitter)
      attempt++
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  }
}

// Deterministic hash → id, so re-fetched events keep a stable identity.
export function hashId(prefix: string, ...parts: (string | number | undefined)[]): string {
  const s = parts.join('|')
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i)
  return `${prefix}-${(h >>> 0).toString(36)}`
}
