import test from 'node:test'
import assert from 'node:assert/strict'

import { createDriveOutboxPorts, DRIVE_OUTBOX_MAX_PAGES } from '../../lib/server/drive-outbox-ports.ts'

const FOLDER = 'folder-jay-outbox'
const DOC_MIME = 'application/vnd.google-apps.document'

function client({ pages = [{ files: [{ id: 'f1' }] }], bodies = {}, exports = {} } = {}) {
  const calls = { list: [], get: [], export: [] }
  let pageIndex = 0
  return {
    calls,
    list: async (params) => {
      calls.list.push(params)
      const page = pages[Math.min(pageIndex, pages.length - 1)]
      pageIndex += 1
      return { data: page }
    },
    get: async (params) => {
      calls.get.push(params)
      const body = bodies[params.fileId]
      if (body instanceof Error) throw body
      return { data: body === undefined ? 'plain body' : body }
    },
    export: async (params) => {
      calls.export.push(params)
      const body = exports[params.fileId]
      if (body instanceof Error) throw body
      return { data: body === undefined ? 'doc body' : body }
    },
  }
}

// ---- listFiles ----

test('the listing is folder-scoped and excludes trashed files', async () => {
  const c = client()
  const ports = createDriveOutboxPorts({ client: c, folderId: FOLDER })
  await ports.listFiles()
  assert.equal(c.calls.list.length, 1)
  assert.match(c.calls.list[0].q, new RegExp(`'${FOLDER}' in parents`))
  assert.match(c.calls.list[0].q, /trashed = false/)
})

test('pages are followed and concatenated', async () => {
  const c = client({
    pages: [
      { files: [{ id: 'f1' }], nextPageToken: 'p2' },
      { files: [{ id: 'f2' }], nextPageToken: 'p3' },
      { files: [{ id: 'f3' }] },
    ],
  })
  const ports = createDriveOutboxPorts({ client: c, folderId: FOLDER })
  const files = await ports.listFiles()
  assert.deepEqual(files.map((f) => f.id), ['f1', 'f2', 'f3'])
  assert.equal(c.calls.list[1].pageToken, 'p2')
  assert.equal(c.calls.list[2].pageToken, 'p3')
})

test('a truncated listing stops loudly instead of pretending the folder is smaller', async () => {
  // 매번 다른 토큰을 준다 — 같은 토큰이면 반복 검사에 먼저 걸려 상한까지 가지 않는다.
  let page = 0
  let listCalls = 0
  const c = {
    list: async () => {
      listCalls += 1
      page += 1
      return { data: { files: [{ id: `f${page}` }], nextPageToken: `page-${page}` } }
    },
    get: async () => ({ data: '' }),
    export: async () => ({ data: '' }),
  }
  const ports = createDriveOutboxPorts({ client: c, folderId: FOLDER })
  await assert.rejects(() => ports.listFiles(), /DRIVE_OUTBOX_LISTING_TRUNCATED/)
  assert.equal(listCalls, DRIVE_OUTBOX_MAX_PAGES)
})

test('a repeated page token is refused rather than looped forever', async () => {
  let calls = 0
  const c = {
    list: async () => {
      calls += 1
      return { data: { files: [{ id: `f${calls}` }], nextPageToken: 'same-token' } }
    },
    get: async () => ({ data: '' }),
    export: async () => ({ data: '' }),
  }
  const ports = createDriveOutboxPorts({ client: c, folderId: FOLDER, pageSize: 100 })
  await assert.rejects(() => ports.listFiles(), /DRIVE_OUTBOX_LISTING_TRUNCATED/)
  assert.ok(calls <= DRIVE_OUTBOX_MAX_PAGES)
})

test('an empty folder lists nothing without error', async () => {
  const ports = createDriveOutboxPorts({ client: client({ pages: [{}] }), folderId: FOLDER })
  assert.deepEqual(await ports.listFiles(), [])
})

// ---- readFile ----

test('a Google Doc is exported as text, not downloaded as media', async () => {
  const c = client({
    pages: [{ files: [{ id: 'doc-1', mimeType: DOC_MIME }] }],
    exports: { 'doc-1': 'person: jay' },
  })
  const ports = createDriveOutboxPorts({ client: c, folderId: FOLDER })
  await ports.listFiles()
  const body = await ports.readFile('doc-1')
  assert.deepEqual(body, { text: 'person: jay', mimeType: DOC_MIME })
  assert.equal(c.calls.export.length, 1)
  assert.equal(c.calls.export[0].mimeType, 'text/plain')
  assert.equal(c.calls.get.length, 0)
})

test('a plain file is downloaded as media', async () => {
  const c = client({
    pages: [{ files: [{ id: 'md-1', mimeType: 'text/markdown' }] }],
    bodies: { 'md-1': 'person: jay' },
  })
  const ports = createDriveOutboxPorts({ client: c, folderId: FOLDER })
  await ports.listFiles()
  const body = await ports.readFile('md-1')
  assert.deepEqual(body, { text: 'person: jay', mimeType: 'text/markdown' })
  assert.equal(c.calls.get.length, 1)
  assert.equal(c.calls.export.length, 0)
})

test('a non-string body is refused rather than coerced into plausible nonsense', async () => {
  const c = client({
    pages: [{ files: [{ id: 'bin-1', mimeType: 'application/octet-stream' }] }],
    bodies: { 'bin-1': { buffer: true } },
  })
  const ports = createDriveOutboxPorts({ client: c, folderId: FOLDER })
  await ports.listFiles()
  await assert.rejects(() => ports.readFile('bin-1'), /DRIVE_OUTBOX_UNREADABLE_BODY/)
})

test('reading a file the listing never saw is refused', async () => {
  const ports = createDriveOutboxPorts({ client: client(), folderId: FOLDER })
  await assert.rejects(() => ports.readFile('never-listed'), /DRIVE_OUTBOX_UNKNOWN_FILE/)
})

test('a blank folder id fails closed', () => {
  assert.throws(() => createDriveOutboxPorts({ client: client(), folderId: '  ' }), /DRIVE_OUTBOX_FOLDER_REQUIRED/)
})
