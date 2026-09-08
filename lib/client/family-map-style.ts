import type { StyleSpecification } from 'maplibre-gl'

/** A real street map at family/region zoom, with attribution kept visible. */
export function familyMapStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      streets: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    },
    layers: [{ id: 'streets', type: 'raster', source: 'streets' }],
  }
}
