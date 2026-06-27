// NOAA SWPC space weather alerts (no key, CORS enabled).
import { getJSON, hashId } from './http'
import type { IntelEvent } from '../types'

type SWPCAlert = { product_id: string; issue_datetime: string; message: string }

const URL = 'https://services.swpc.noaa.gov/products/alerts.json'

function severityFor(msg: string): number {
  const m = msg.toUpperCase()
  if (m.includes('G5') || m.includes('R5') || m.includes('S5')) return 98
  if (m.includes('G4') || m.includes('R4') || m.includes('S4')) return 88
  if (m.includes('G3') || m.includes('R3') || m.includes('S3')) return 74
  if (m.includes('G2') || m.includes('R2') || m.includes('S2')) return 58
  if (m.includes('WARNING')) return 55
  if (m.includes('WATCH')) return 45
  return 38
}

function titleFor(msg: string): string {
  const first = msg.split('\n').find((l) => /ALERT|WARNING|WATCH|SUMMARY/i.test(l))
  return (first || msg.split('\n')[0] || 'Space Weather Notice').trim().slice(0, 80)
}

export async function fetchSpace(): Promise<{ events: IntelEvent[]; latencyMs: number }> {
  const { data, latencyMs } = await getJSON<SWPCAlert[]>(URL)
  const events = (data ?? []).slice(0, 25).map<IntelEvent>((a) => ({
    id: hashId('swpc', a.product_id, a.issue_datetime),
    source: 'NOAA SWPC',
    category: 'space',
    severity: severityFor(a.message),
    title: titleFor(a.message),
    summary: a.message.replace(/\s+/g, ' ').slice(0, 200),
    timestamp: new Date(a.issue_datetime.replace(' ', 'T') + 'Z').getTime(),
    meta: { product: a.product_id },
  }))
  return { events, latencyMs }
}
