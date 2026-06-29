// Commercial + agency ground-station networks used for satellite TT&C and
// payload downlink. Public reference data (site locations, operators, bands);
// nothing sensitive. Bands and elevation masks are representative, not
// operator-published values, and only feed the pass/link-budget estimates.
import type { GroundStation } from '../types'

const RAW: Omit<GroundStation, 'id'>[] = [
  // KSAT — Kongsberg Satellite Services (global polar + mid-latitude network)
  {
    name: 'Svalbard (SvalSat)',
    operator: 'KSAT',
    lat: 78.23,
    lng: 15.39,
    bands: ['S', 'X', 'Ka'],
    minElevDeg: 5,
  },
  { name: 'TrollSat', operator: 'KSAT', lat: -72.01, lng: 2.53, bands: ['S', 'X'], minElevDeg: 5 },
  { name: 'Tromsø', operator: 'KSAT', lat: 69.66, lng: 18.94, bands: ['S', 'X'], minElevDeg: 5 },
  {
    name: 'Punta Arenas',
    operator: 'KSAT',
    lat: -52.94,
    lng: -70.85,
    bands: ['S', 'X'],
    minElevDeg: 5,
  },
  {
    name: 'Hartebeesthoek',
    operator: 'KSAT',
    lat: -25.89,
    lng: 27.69,
    bands: ['S', 'X'],
    minElevDeg: 5,
  },
  { name: 'Mauritius', operator: 'KSAT', lat: -20.31, lng: 57.5, bands: ['S', 'X'], minElevDeg: 5 },
  { name: 'Singapore', operator: 'KSAT', lat: 1.39, lng: 103.9, bands: ['S', 'X'], minElevDeg: 7 },
  { name: 'Awarua', operator: 'KSAT', lat: -46.53, lng: 168.38, bands: ['S', 'X'], minElevDeg: 5 },
  { name: 'Inuvik', operator: 'KSAT', lat: 68.32, lng: -133.55, bands: ['S', 'X'], minElevDeg: 5 },

  // Leaf Space — Leaf Line GSaaS
  {
    name: 'Leaf · Awarua',
    operator: 'Leaf Space',
    lat: -46.52,
    lng: 168.39,
    bands: ['S', 'X'],
    minElevDeg: 8,
  },
  {
    name: 'Leaf · Cordoba',
    operator: 'Leaf Space',
    lat: -31.52,
    lng: -64.46,
    bands: ['S', 'X'],
    minElevDeg: 8,
  },
  {
    name: 'Leaf · Azores',
    operator: 'Leaf Space',
    lat: 37.74,
    lng: -25.66,
    bands: ['S', 'X'],
    minElevDeg: 8,
  },
  {
    name: 'Leaf · Svalbard',
    operator: 'Leaf Space',
    lat: 78.22,
    lng: 15.65,
    bands: ['S', 'X'],
    minElevDeg: 8,
  },

  // RBC Signals
  {
    name: 'RBC · Fairbanks',
    operator: 'RBC Signals',
    lat: 64.86,
    lng: -147.85,
    bands: ['S', 'X'],
    minElevDeg: 5,
  },
  {
    name: 'RBC · Punta Arenas',
    operator: 'RBC Signals',
    lat: -53.0,
    lng: -70.86,
    bands: ['S', 'X'],
    minElevDeg: 5,
  },
  {
    name: 'RBC · Brewster',
    operator: 'RBC Signals',
    lat: 48.2,
    lng: -119.68,
    bands: ['S', 'X'],
    minElevDeg: 5,
  },

  // AWS Ground Station
  {
    name: 'AWS · Ohio',
    operator: 'AWS GS',
    lat: 39.96,
    lng: -83.0,
    bands: ['S', 'X'],
    minElevDeg: 5,
  },
  {
    name: 'AWS · Oregon',
    operator: 'AWS GS',
    lat: 45.84,
    lng: -119.7,
    bands: ['S', 'X'],
    minElevDeg: 5,
  },
  {
    name: 'AWS · Stockholm',
    operator: 'AWS GS',
    lat: 59.33,
    lng: 18.07,
    bands: ['S', 'X'],
    minElevDeg: 5,
  },
  {
    name: 'AWS · Bahrain',
    operator: 'AWS GS',
    lat: 26.07,
    lng: 50.56,
    bands: ['S', 'X'],
    minElevDeg: 5,
  },

  // NASA Near Earth Network
  {
    name: 'Wallops (WGS)',
    operator: 'NASA NEN',
    lat: 37.95,
    lng: -75.46,
    bands: ['S', 'X'],
    minElevDeg: 5,
  },
  {
    name: 'Fairbanks (ASF)',
    operator: 'NASA NEN',
    lat: 64.97,
    lng: -147.51,
    bands: ['S', 'X'],
    minElevDeg: 5,
  },
  {
    name: 'McMurdo (MG1)',
    operator: 'NASA NEN',
    lat: -77.84,
    lng: 166.67,
    bands: ['S', 'X'],
    minElevDeg: 5,
  },
  {
    name: 'White Sands',
    operator: 'NASA NEN',
    lat: 32.5,
    lng: -106.61,
    bands: ['S', 'Ku'],
    minElevDeg: 5,
  },

  // ESA Estrack (deep-space + LEO support)
  {
    name: 'Kiruna (KIR)',
    operator: 'ESA Estrack',
    lat: 67.86,
    lng: 21.06,
    bands: ['S', 'X'],
    minElevDeg: 5,
  },
  {
    name: 'Kourou (KRU)',
    operator: 'ESA Estrack',
    lat: 5.25,
    lng: -52.8,
    bands: ['S', 'X'],
    minElevDeg: 5,
  },
  {
    name: 'New Norcia (NNO)',
    operator: 'ESA Estrack',
    lat: -31.05,
    lng: 116.19,
    bands: ['S', 'X'],
    minElevDeg: 5,
  },

  // Atlas Space Operations — Freedom network
  {
    name: 'Atlas · Guam',
    operator: 'Atlas',
    lat: 13.59,
    lng: 144.86,
    bands: ['S', 'X'],
    minElevDeg: 8,
  },
  {
    name: 'Atlas · Ghana',
    operator: 'Atlas',
    lat: 5.66,
    lng: -0.18,
    bands: ['S', 'X'],
    minElevDeg: 8,
  },
]

export const GROUND_STATIONS: GroundStation[] = RAW.map((s) => ({
  ...s,
  id: `gs-${s.operator.replace(/\W+/g, '').toLowerCase()}-${s.name.replace(/\W+/g, '').toLowerCase()}`,
}))

export const GROUND_OPERATORS = [...new Set(GROUND_STATIONS.map((s) => s.operator))]
