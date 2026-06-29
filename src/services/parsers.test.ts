import { describe, expect, it } from 'vitest'
import { parseSeismic } from './seismic'
import { parseWeather } from './weather'
import { parseAirQuality } from './airquality'
import { parseSignals } from './signals'
import { parseNeos } from './neo'

describe('parseSeismic', () => {
  it('maps a USGS feature to an event with scaled severity', () => {
    const out = parseSeismic({
      features: [
        {
          id: 'us1',
          properties: {
            mag: 6,
            place: '10km N of Testville',
            time: 1700000000000,
            url: 'u',
            title: 't',
          },
          geometry: { coordinates: [12, 34, 8] },
        },
      ],
    })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ category: 'seismic', lat: 34, lng: 12, severity: 78 })
    expect(out[0].meta).toMatchObject({ magnitude: 6, depthKm: 8 })
  })

  it('drops features missing magnitude or geometry', () => {
    const out = parseSeismic({
      features: [
        // @ts-expect-error intentional malformed input
        { id: 'a', properties: { place: 'x', time: 1 }, geometry: { coordinates: [1, 2, 3] } },
        // @ts-expect-error intentional malformed input
        { id: 'b', properties: { mag: 5, place: 'y', time: 1 }, geometry: null },
      ],
    })
    expect(out).toHaveLength(0)
  })

  it('survives an empty or shapeless payload', () => {
    // @ts-expect-error intentional malformed input
    expect(parseSeismic({})).toEqual([])
    // @ts-expect-error intentional malformed input
    expect(parseSeismic(null)).toEqual([])
  })
})

describe('parseWeather', () => {
  it('plots a polygon alert at its centroid with mapped severity', () => {
    const out = parseWeather({
      features: [
        {
          id: 'w1',
          properties: { event: 'Tornado Warning', severity: 'Extreme', areaDesc: 'County A' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [0, 2],
                [2, 2],
                [2, 0],
              ],
            ],
          },
        },
      ],
    })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ category: 'weather', severity: 95, title: 'Tornado Warning' })
    expect(out[0].lat).toBeCloseTo(1, 5)
    expect(out[0].lng).toBeCloseTo(1, 5)
  })

  it('skips zone-only alerts that have no geometry', () => {
    const out = parseWeather({
      features: [{ id: 'w2', properties: { event: 'Heat Advisory' }, geometry: null }],
    })
    expect(out).toHaveLength(0)
  })

  it('survives a shapeless payload', () => {
    // @ts-expect-error intentional malformed input
    expect(parseWeather(undefined)).toEqual([])
  })
})

describe('parseAirQuality', () => {
  it('zips results to the city list by index and scales severity', () => {
    const out = parseAirQuality([
      { latitude: 40.71, longitude: -74, current: { us_aqi: 150, pm2_5: 55 } },
    ])
    expect(out[0]).toMatchObject({ category: 'air', region: 'New York', severity: 50 })
    expect(out[0].meta).toMatchObject({ usAqi: 150, pm25: 55 })
  })

  it('ignores items without an AQI reading', () => {
    const out = parseAirQuality([{ latitude: 0, longitude: 0, current: {} }])
    expect(out).toHaveLength(0)
  })
})

describe('parseSignals', () => {
  it('normalizes severity against the busiest hotspot', () => {
    const out = parseSignals({
      features: [
        { properties: { name: 'A', count: 100 }, geometry: { type: 'Point', coordinates: [1, 2] } },
        { properties: { name: 'B', count: 0 }, geometry: { type: 'Point', coordinates: [3, 4] } },
      ],
    })
    const a = out.find((e) => e.title === 'A')!
    const b = out.find((e) => e.title === 'B')!
    expect(a.severity).toBeGreaterThan(b.severity)
    expect(a.severity).toBe(90)
  })

  it('survives a shapeless payload', () => {
    expect(parseSignals({})).toEqual([])
  })
})

describe('parseNeos', () => {
  const raw = {
    near_earth_objects: {
      '2026-06-29': [
        {
          id: '1',
          name: '(2026 AB) Safe',
          is_potentially_hazardous_asteroid: false,
          estimated_diameter: {
            meters: { estimated_diameter_min: 100, estimated_diameter_max: 300 },
          },
          close_approach_data: [
            {
              close_approach_date_full: '2026-Jun-29 12:00',
              relative_velocity: { kilometers_per_hour: '40000' },
              miss_distance: { kilometers: '5000000', lunar: '13' },
            },
          ],
        },
        {
          id: '2',
          name: '(2026 XY) Hazard',
          is_potentially_hazardous_asteroid: true,
          estimated_diameter: {
            meters: { estimated_diameter_min: 400, estimated_diameter_max: 600 },
          },
          close_approach_data: [
            {
              close_approach_date_full: '2026-Jun-29 06:00',
              relative_velocity: { kilometers_per_hour: '90000' },
              miss_distance: { kilometers: '8000000', lunar: '20' },
            },
          ],
        },
      ],
    },
  }

  it('parses, averages diameter, and ranks hazardous first', () => {
    const out = parseNeos(raw)
    expect(out).toHaveLength(2)
    expect(out[0].name).toBe('2026 XY Hazard') // hazardous sorts first
    expect(out[0]).toMatchObject({ hazardous: true, diameterM: 500, missLunar: 20 })
    expect(out[1].diameterM).toBe(200)
  })

  it('survives a shapeless payload', () => {
    expect(parseNeos({})).toEqual([])
  })
})
