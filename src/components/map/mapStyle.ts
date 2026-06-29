import type maplibregl from 'maplibre-gl'
import type { StyleSpecification } from 'maplibre-gl'
import type { ViewMode } from '../../types'

// Dark basemap (CARTO), satellite imagery (Esri), terrain DEM (AWS), and a
// bundled vector world so land always renders. All free and key-less.
export const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap © CARTO',
    },
    satellite: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: 'Imagery © Esri',
    },
    dem: {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 14,
      attribution: 'Terrain: Mapzen / AWS',
    },
    world: { type: 'geojson', data: '/world.geo.json' },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#070707' } },
    { id: 'land', type: 'fill', source: 'world', paint: { 'fill-color': '#131315' } },
    {
      id: 'land-border',
      type: 'line',
      source: 'world',
      paint: { 'line-color': '#33333a', 'line-width': 0.5, 'line-opacity': 0.8 },
    },
    { id: 'carto', type: 'raster', source: 'carto', paint: { 'raster-opacity': 0.92 } },
    { id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' } },
  ],
}

// Switch between 2D flat mercator and 3D globe projection + terrain + tilt.
export function applyView(map: maplibregl.Map, mode: ViewMode) {
  if (mode === '3d') {
    map.setProjection({ type: 'globe' })
    if (map.getSource('dem')) map.setTerrain({ source: 'dem', exaggeration: 1.4 })
    map.easeTo({ pitch: 55, zoom: Math.max(map.getZoom(), 2.4), duration: 900 })
  } else {
    map.setTerrain(null)
    map.setProjection({ type: 'mercator' })
    map.easeTo({ pitch: 0, bearing: 0, duration: 700 })
  }
}
