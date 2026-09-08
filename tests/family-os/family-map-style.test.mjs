import test from 'node:test'
import assert from 'node:assert/strict'
import { familyMapStyle } from '../../lib/client/family-map-style.ts'

test('the family map has street-level tiles and mandatory visible attribution, not a country-only demo', () => {
  const style = familyMapStyle()
  assert.equal(style.sources.streets.type, 'raster')
  assert.ok(style.sources.streets.maxzoom >= 16)
  assert.deepEqual(style.sources.streets.tiles, ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'])
  assert.match(style.sources.streets.attribution, /openstreetmap.org\/copyright/)
  assert.equal(style.layers[0].source, 'streets')
})
