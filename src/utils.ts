// Shared formatting helpers.

export function timeAgo(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.round(h / 24)}d`
}

export function utcClock(d = new Date()): string {
  return d.toISOString().slice(11, 19) + 'Z'
}

export function utcDate(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

export function fmtPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (n >= 1) return n.toFixed(2)
  return n.toFixed(4)
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

// Single source of truth for severity color. Color encodes severity, not
// category — a disciplined two-tone (neutral + accent) scheme.
export function severityColor(sev: number): string {
  if (sev >= 85) return '#e2574a' // critical
  if (sev >= 65) return '#f4642a' // high (accent)
  if (sev >= 40) return '#cf9a40' // moderate
  return '#7a818c' // low / nominal
}
