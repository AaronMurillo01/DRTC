// Small fetch helper with timeout + latency measurement.
// All DRTC feeds use only public, key-less, CORS-enabled endpoints.

export interface Timed<T> {
  data: T
  latencyMs: number
}

export async function getJSON<T>(url: string, timeoutMs = 12000): Promise<Timed<T>> {
  const started = performance.now()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as T
    return { data, latencyMs: Math.round(performance.now() - started) }
  } finally {
    clearTimeout(timer)
  }
}

// Deterministic hash → id, so re-fetched events keep a stable identity.
export function hashId(prefix: string, ...parts: (string | number | undefined)[]): string {
  const s = parts.join('|')
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i)
  return `${prefix}-${(h >>> 0).toString(36)}`
}
