import type { DriveOutboxPorts } from '../family-os/drive-outbox-run.ts'

/**
 * Unit 40 — the Drive API ports Unit 37 takes by injection.
 *
 * Every test here uses an injected fake, so the tests prove shape only. The real round trip was
 * verified separately on 2026-09-09 (spec 45): a live `drive.files.list` against the household's
 * `10_JAY` outbox returned the two files that were actually there. The earlier caveat on this
 * module — "shape-verified, round-trip unverified" — no longer holds.
 *
 * Read-only. No OAuth, no token refresh, no credential reading, no write of any kind.
 */

/** Shaped after `googleapis`' `drive.files` so the real client drops in unchanged. */
export interface DriveFilesClient {
  list(params: {
    q: string
    fields: string
    pageSize: number
    pageToken?: string
  }): Promise<{ data: { files?: unknown[]; nextPageToken?: string } }>
  get(params: { fileId: string; alt: 'media' }): Promise<{ data: unknown }>
  export(params: { fileId: string; mimeType: string }): Promise<{ data: unknown }>
}

/**
 * 10 페이지 × 100 = 1,000 파일. 가정 outbox 가 담을 만한 수를 한참 넘는다 —
 * 여기 닿았다는 것은 폴더가 바쁜 게 아니라 뭔가 잘못됐다는 뜻이다.
 */
export const DRIVE_OUTBOX_MAX_PAGES = 10

const DEFAULT_PAGE_SIZE = 100
const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document'
const LIST_FIELDS = 'nextPageToken, files(id, name, mimeType, modifiedTime)'

function fileIdOf(file: unknown): string | null {
  if (typeof file !== 'object' || file === null) return null
  const id = (file as { id?: unknown }).id
  return typeof id === 'string' && id.trim() !== '' ? id.trim() : null
}

function mimeTypeOf(file: unknown): string | null {
  if (typeof file !== 'object' || file === null) return null
  const mimeType = (file as { mimeType?: unknown }).mimeType
  return typeof mimeType === 'string' && mimeType.trim() !== '' ? mimeType.trim() : null
}

export function createDriveOutboxPorts(input: {
  client: DriveFilesClient
  folderId: string
  pageSize?: number
}): DriveOutboxPorts {
  const folderId = typeof input.folderId === 'string' ? input.folderId.trim() : ''
  if (folderId === '') throw new Error('DRIVE_OUTBOX_FOLDER_REQUIRED')
  const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE

  // 목록에서 본 파일의 실제 타입. Unit 36 은 export 타입이 아니라 파일이 무엇인지로 갈라야 한다.
  const mimeTypeByFileId = new Map<string, string>()

  return {
    async listFiles(): Promise<readonly unknown[]> {
      const collected: unknown[] = []
      const seenTokens = new Set<string>()
      let pageToken: string | undefined

      for (let page = 0; page < DRIVE_OUTBOX_MAX_PAGES; page += 1) {
        const response = await input.client.list({
          // 휴지통 파일은 삭제된 파일이 아니다. 읽으면 주인이 이미 거둬들인 레코드를 다시 넣는 것이 된다.
          q: `'${folderId}' in parents and trashed = false`,
          fields: LIST_FIELDS,
          pageSize,
          ...(pageToken === undefined ? {} : { pageToken }),
        })

        for (const file of response.data.files ?? []) {
          collected.push(file)
          const id = fileIdOf(file)
          const mimeType = mimeTypeOf(file)
          if (id !== null && mimeType !== null) mimeTypeByFileId.set(id, mimeType)
        }

        const next = response.data.nextPageToken
        if (typeof next !== 'string' || next.trim() === '') return collected

        // 같은 커서를 계속 돌려주는 서버에 무한히 끌려다니지 않는다.
        if (seenTokens.has(next)) throw new Error('DRIVE_OUTBOX_LISTING_TRUNCATED')
        seenTokens.add(next)
        pageToken = next
      }

      // 잘린 페이지는 더 작은 폴더가 아니다. 조용히 일부만 처리하지 않는다.
      throw new Error('DRIVE_OUTBOX_LISTING_TRUNCATED')
    },

    async readFile(fileId: string): Promise<{ text: string; mimeType: string }> {
      const mimeType = mimeTypeByFileId.get(fileId)
      if (mimeType === undefined) throw new Error('DRIVE_OUTBOX_UNKNOWN_FILE')

      // Google Docs 에는 내려받을 바이트가 없다 — alt: 'media' 는 실패한다.
      const response = mimeType === GOOGLE_DOC_MIME
        ? await input.client.export({ fileId, mimeType: 'text/plain' })
        : await input.client.get({ fileId, alt: 'media' })

      // String(buffer) 는 Unit 36 에게 그럴듯한 "[object Object]" 를 건넨다. 강제 변환하지 않는다.
      if (typeof response.data !== 'string') throw new Error('DRIVE_OUTBOX_UNREADABLE_BODY')
      return { text: response.data, mimeType }
    },
  }
}
