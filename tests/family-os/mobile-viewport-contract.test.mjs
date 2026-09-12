import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('root layout declares a device-width mobile viewport', async () => {
  const source = await readFile(new URL('../../app/layout.tsx', import.meta.url), 'utf8')
  assert.match(source, /import type \{ Metadata, Viewport \} from 'next'/)
  assert.match(source, /export const viewport: Viewport = \{[\s\S]*width: 'device-width',[\s\S]*initialScale: 1,[\s\S]*\}/)
})

test('mobile planner keeps outer layout bounded while preserving inner calendar scroll', async () => {
  const source = await readFile(new URL('../../app/planner.css', import.meta.url), 'utf8')
  assert.match(source, /\.family-planner\{width:100%;max-width:100vw;min-width:0;overflow-x:hidden\}/)
  assert.match(source, /\.week-scroll\{touch-action:pan-y\}/)
})
