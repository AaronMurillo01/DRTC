// Shared geospatial math used by the map and the correlation engine.

export const D2R = Math.PI / 180
export const R2D = 180 / Math.PI
const EARTH_KM = 6371

/** Great-circle distance in kilometers between two lat/lng points. */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = (bLat - aLat) * D2R
  const dLng = (bLng - aLng) * D2R
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(aLat * D2R) * Math.cos(bLat * D2R) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(s)))
}

/** Interpolate a great-circle arc between two [lng, lat] points. */
export function greatCircle(a: [number, number], b: [number, number], n = 48): number[][] {
  const lon1 = a[0] * D2R
  const lat1 = a[1] * D2R
  const lon2 = b[0] * D2R
  const lat2 = b[1] * D2R
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
      ),
    )
  if (d === 0 || Number.isNaN(d)) return [a, b]
  const pts: number[][] = []
  for (let i = 0; i <= n; i++) {
    const f = i / n
    const A = Math.sin((1 - f) * d) / Math.sin(d)
    const B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2)
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2)
    const z = A * Math.sin(lat1) + B * Math.sin(lat2)
    pts.push([Math.atan2(y, x) * R2D, Math.atan2(z, Math.hypot(x, y)) * R2D])
  }
  return pts
}

/** Subsolar point (lat/lng where the sun is overhead) for a given time. */
export function subsolarPoint(d: Date): { lat: number; lng: number } {
  const dayMs = Date.UTC(d.getUTCFullYear(), 0, 0)
  const dayOfYear = (d.getTime() - dayMs) / 86_400_000
  const decl = -23.44 * Math.cos(D2R * (360 / 365) * (dayOfYear + 10))
  const utcHours = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600
  return { lat: decl, lng: -15 * (utcHours - 12) }
}
