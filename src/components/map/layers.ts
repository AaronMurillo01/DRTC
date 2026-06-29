import type maplibregl from 'maplibre-gl'
import { eventsFC, riskFC, arcsFC, terminatorFC } from './sources'

// Registers all DRTC data layers on a freshly loaded map.
export function addDataLayers(map: maplibregl.Map) {
  map.addSource('risk', { type: 'geojson', data: riskFC([]) })
  map.addSource('arcs', { type: 'geojson', data: arcsFC([], []) })
  map.addSource('events', { type: 'geojson', data: eventsFC([]) })
  map.addSource('terminator', { type: 'geojson', data: terminatorFC(new Date()) })

  map.addLayer({
    id: 'terminator-fill',
    type: 'fill',
    source: 'terminator',
    layout: { visibility: 'none' },
    paint: { 'fill-color': '#02040a', 'fill-opacity': 0.42 },
  })

  map.addLayer({
    id: 'risk-zone',
    type: 'circle',
    source: 'risk',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'score'], 20, 14, 100, 46],
      'circle-color': [
        'step',
        ['get', 'score'],
        '#7a818c',
        40,
        '#cf9a40',
        65,
        '#f4642a',
        85,
        '#e2574a',
      ],
      'circle-opacity': 0.1,
      'circle-blur': 0.6,
    },
  })

  map.addLayer({
    id: 'arcs',
    type: 'line',
    source: 'arcs',
    layout: { 'line-cap': 'round' },
    paint: {
      'line-color': '#b5663a',
      'line-width': 1.1,
      'line-opacity': 0.5,
      'line-blur': 0.3,
    },
  })

  map.addLayer({
    id: 'events-heat',
    type: 'heatmap',
    source: 'events',
    layout: { visibility: 'none' },
    paint: {
      'heatmap-weight': ['interpolate', ['linear'], ['get', 'sev'], 0, 0.1, 100, 1],
      'heatmap-intensity': 1.1,
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 14, 6, 40],
      'heatmap-opacity': 0.75,
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0,
        'rgba(0,0,0,0)',
        0.3,
        'rgba(120,70,40,0.5)',
        0.55,
        '#cf9a40',
        0.78,
        '#f4642a',
        1,
        '#d94a3d',
      ],
    },
  })

  map.addLayer({
    id: 'events-glow',
    type: 'circle',
    source: 'events',
    filter: ['>=', ['get', 'sev'], 65],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'sev'], 65, 10, 100, 22],
      'circle-color': ['step', ['get', 'sev'], '#f4642a', 85, '#e2574a'],
      'circle-opacity': 0.16,
      'circle-blur': 0.8,
    },
  })

  map.addLayer({
    id: 'events-pt',
    type: 'circle',
    source: 'events',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'sev'], 0, 3, 100, 11],
      'circle-color': [
        'step',
        ['get', 'sev'],
        '#7a818c',
        40,
        '#cf9a40',
        65,
        '#f4642a',
        85,
        '#e2574a',
      ],
      'circle-opacity': 0.92,
      'circle-stroke-color': '#070707',
      'circle-stroke-width': ['case', ['>=', ['get', 'sev'], 85], 1.5, 0.6],
    },
  })

  map.addLayer({
    id: 'events-sel',
    type: 'circle',
    source: 'events',
    filter: ['==', ['get', 'id'], ''],
    paint: {
      'circle-radius': 14,
      'circle-color': 'rgba(0,0,0,0)',
      'circle-stroke-color': '#f4642a',
      'circle-stroke-width': 2,
    },
  })
}
