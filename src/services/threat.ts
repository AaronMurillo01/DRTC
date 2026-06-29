// DRTC correlation engine: turns the raw event stream into a Global Threat
// Index, a 5-tier condition level, and a per-country Instability Index.
import type { CountryRisk, IntelEvent, MarketTick, ThreatState } from '../types'
import { haversineKm } from './geo'

// Tier-1 watch list with a baseline geopolitical stress weight (0-40).
const WATCH: { iso: string; name: string; lat: number; lng: number; base: number }[] = [
  { iso: 'US', name: 'United States', lat: 38.9, lng: -77.0, base: 14 },
  { iso: 'RU', name: 'Russia', lat: 55.75, lng: 37.6, base: 32 },
  { iso: 'CN', name: 'China', lat: 39.9, lng: 116.4, base: 24 },
  { iso: 'UA', name: 'Ukraine', lat: 50.45, lng: 30.5, base: 40 },
  { iso: 'IL', name: 'Israel', lat: 31.78, lng: 35.22, base: 36 },
  { iso: 'IR', name: 'Iran', lat: 35.7, lng: 51.4, base: 34 },
  { iso: 'KP', name: 'North Korea', lat: 39.03, lng: 125.75, base: 33 },
  { iso: 'TW', name: 'Taiwan', lat: 25.03, lng: 121.57, base: 28 },
  { iso: 'IN', name: 'India', lat: 28.61, lng: 77.21, base: 18 },
  { iso: 'PK', name: 'Pakistan', lat: 33.69, lng: 73.06, base: 26 },
  { iso: 'SY', name: 'Syria', lat: 33.51, lng: 36.29, base: 35 },
  { iso: 'SD', name: 'Sudan', lat: 15.5, lng: 32.56, base: 34 },
  { iso: 'YE', name: 'Yemen', lat: 15.37, lng: 44.19, base: 33 },
  { iso: 'VE', name: 'Venezuela', lat: 10.49, lng: -66.88, base: 24 },
  { iso: 'TR', name: 'Türkiye', lat: 39.93, lng: 32.86, base: 20 },
  { iso: 'KR', name: 'South Korea', lat: 37.57, lng: 126.98, base: 16 },
  { iso: 'JP', name: 'Japan', lat: 35.68, lng: 139.69, base: 12 },
  { iso: 'FR', name: 'France', lat: 48.85, lng: 2.35, base: 12 },
  { iso: 'GB', name: 'United Kingdom', lat: 51.5, lng: -0.12, base: 12 },
  { iso: 'DE', name: 'Germany', lat: 52.52, lng: 13.4, base: 11 },
]

const CAT_LABEL: Record<string, string> = {
  seismic: 'seismic activity',
  disaster: 'natural disaster',
  signals: 'media/crisis signals',
  space: 'space weather',
  weather: 'severe weather',
}

// Reference / non-hazard layers must not drive the threat or instability scores.
const NON_THREAT = new Set(['orbital', 'spaceport', 'nuclear', 'market', 'air'])

export function computeCountryRisk(events: IntelEvent[]): CountryRisk[] {
  const located = events.filter(
    (e) => e.lat != null && e.lng != null && !NON_THREAT.has(e.category),
  )
  return WATCH.map((c) => {
    let stress = c.base
    const driverCats = new Map<string, number>()
    for (const e of located) {
      const d = haversineKm(c.lat, c.lng, e.lat!, e.lng!)
      if (d > 1200) continue
      // Linear falloff within 1200km, scaled by event severity.
      const contrib = (1 - d / 1200) * (e.severity / 100) * 22
      stress += contrib
      driverCats.set(e.category, (driverCats.get(e.category) ?? 0) + contrib)
    }
    const drivers = [...driverCats.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([cat]) => CAT_LABEL[cat] ?? cat)
    return {
      iso: c.iso,
      name: c.name,
      lat: c.lat,
      lng: c.lng,
      score: Math.min(100, Math.round(stress)),
      drivers: drivers.length ? drivers : ['baseline posture'],
    }
  }).sort((a, b) => b.score - a.score)
}

const LEVELS: { min: number; level: 1 | 2 | 3 | 4 | 5; label: string }[] = [
  { min: 82, level: 5, label: 'CRITICAL' },
  { min: 64, level: 4, label: 'SEVERE' },
  { min: 46, level: 3, label: 'HIGH' },
  { min: 28, level: 2, label: 'ELEVATED' },
  { min: 0, level: 1, label: 'NOMINAL' },
]

export function computeThreat(allEvents: IntelEvent[], prevIndex?: number): ThreatState {
  const events = allEvents.filter((e) => !NON_THREAT.has(e.category))
  if (!events.length) {
    return { level: 1, label: 'NOMINAL', index: 0, trend: 'flat' }
  }
  const sorted = [...events].sort((a, b) => b.severity - a.severity)
  const topAvg = sorted.slice(0, 8).reduce((s, e) => s + e.severity, 0) / Math.min(8, sorted.length)
  const highCount = events.filter((e) => e.severity >= 70).length
  const signalDensity = events.filter((e) => e.category === 'signals').length
  const index = Math.min(
    100,
    Math.round(topAvg * 0.6 + Math.min(highCount, 20) * 1.4 + Math.min(signalDensity, 40) * 0.35),
  )
  const tier = LEVELS.find((l) => index >= l.min)!
  let trend: ThreatState['trend'] = 'flat'
  if (prevIndex != null) {
    if (index > prevIndex + 1) trend = 'up'
    else if (index < prevIndex - 1) trend = 'down'
  }
  return { level: tier.level, label: tier.label, index, trend }
}

// Rule-based situational synthesis — a deterministic "intelligence brief"
// generated from the live picture (no LLM / no keys required).
export function buildBrief(
  events: IntelEvent[],
  threat: ThreatState,
  risk: CountryRisk[],
  markets: MarketTick[],
): string {
  if (!events.length)
    return 'Awaiting feed acquisition. No tracks in the common operating picture yet.'

  const by = (c: string) => events.filter((e) => e.category === c)
  const seismic = by('seismic')
  const disasters = by('disaster')
  const space = by('space')
  const signals = by('signals')
  const weather = by('weather')
  const air = by('air')

  const parts: string[] = []
  parts.push(
    `Condition ${threat.level} (${threat.label}); Global Threat Index ${threat.index}/100, trend ${threat.trend}.`,
  )

  const topHot = [...signals].sort((a, b) => b.severity - a.severity)[0]
  if (topHot) parts.push(`Media/crisis attention concentrating on ${topHot.title}.`)

  const bigQuake = [...seismic].sort((a, b) => b.severity - a.severity)[0]
  if (bigQuake)
    parts.push(
      `${seismic.length} seismic events tracked; strongest ${bigQuake.title} near ${bigQuake.region ?? 'unknown'}.`,
    )

  if (disasters.length)
    parts.push(`${disasters.length} active natural-disaster events in the picture.`)

  const bigWx = [...weather].sort((a, b) => b.severity - a.severity)[0]
  if (bigWx)
    parts.push(
      `${weather.length} active weather alerts; most severe ${bigWx.title} (${bigWx.region ?? 'US'}).`,
    )

  const worstAir = [...air].sort((a, b) => b.severity - a.severity)[0]
  if (worstAir && worstAir.severity >= 33) parts.push(`Worst air quality: ${worstAir.title}.`)

  const sevSpace = [...space].sort((a, b) => b.severity - a.severity)[0]
  if (sevSpace && sevSpace.severity >= 55) parts.push(`Elevated space weather: ${sevSpace.title}.`)

  const topRisk = risk
    .slice(0, 3)
    .map((r) => `${r.name} (${r.score})`)
    .join(', ')
  if (topRisk) parts.push(`Highest instability posture: ${topRisk}.`)

  if (markets.length) {
    const up = markets.filter((m) => m.changePct >= 0).length
    const tone = up > markets.length / 2 ? 'risk-on' : 'risk-off'
    parts.push(`Markets ${tone} (${up}/${markets.length} majors up).`)
  }

  return parts.join(' ')
}
