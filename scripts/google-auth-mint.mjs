#!/usr/bin/env node
/**
 * Unit 44 — Google read-only refresh token 발급 (local loopback OAuth).
 *
 * 이 저장소에는 refresh token 을 **쓰는** 것만 있었고 **만드는** 것이 없었다
 * (google-calendar-web-transport, drive-outbox-run 은 전부 소비자다).
 * 그래서 Drive lane 은 완성돼 있는데 아무도 그것을 돌릴 자격증명을 얻을 수 없었다.
 *
 * 원본은 feature/chad-family-os-core-v0.1 의 scripts/google-calendar-auth.mjs 다.
 * 그대로 옮기지 않고 두 가지를 바꿨다:
 *   1. 원본에는 `state` 가 없었다 — loopback CSRF 가 열려 있었다 (lib/server/google-auth-callback.ts 참고)
 *   2. 원본은 client 자격을 파일 경로로 받았다. main 은 env 를 쓴다 (Unit 41 에서 이미 교정한 어긋남)
 *
 * 2026-09-09 실제 왕복 검증 완료(spec 45): drive.readonly 토큰이 발급됐고,
 * 그 토큰으로 실제 files.list 가 돌았다. 발급된 토큰의 계정은 about.get 으로 직접 확인했다 —
 * 잘못된 계정의 토큰은 빈 폴더를 돌려주고, 그것은 성공처럼 보이는 실패이기 때문이다.
 *
 * Usage:
 *   node --env-file=.env.local scripts/google-auth-mint.mjs --services=drive
 *
 * 읽기 전용 scope 만 요청한다. 이 도구는 Google 의 어떤 내용도 읽지 않는다 — 권한만 받는다.
 */
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { randomBytes, createHash } from 'node:crypto'
import { writeFile, chmod } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { google } from 'googleapis'

import { resolveGoogleReadOnlyScopes } from '../lib/family-os/google-source-scopes.ts'
import { decideGoogleAuthCallback, assertSecretOutPath } from '../lib/server/google-auth-callback.ts'

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const CALLBACK_PATH = '/oauth2callback'
const DEFAULT_OUT = '.env.drive-outbox'

function flag(name, fallback) {
  const found = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  const value = found?.split('=').slice(1).join('=').trim()
  return value || fallback
}

const services = flag('services', 'drive').split(',').map((s) => s.trim()).filter(Boolean)
// 지원하지 않는 서비스는 여기서 죽는다 — 브라우저를 열고 나서 알게 되는 것보다 낫다.
const scopes = resolveGoogleReadOnlyScopes(services)

// 기본 출력은 `.env*` 이름이라 .gitignore 가 이미 덮는다. 다른 경로를 주면 검사한다.
const outPath = assertSecretOutPath({
  outPath: path.resolve(REPO_ROOT, flag('out', DEFAULT_OUT)),
  repoRoot: REPO_ROOT,
})

const clientId = process.env.DRIVE_OUTBOX_CLIENT_ID?.trim()
const clientSecret = process.env.DRIVE_OUTBOX_CLIENT_SECRET?.trim()
if (!clientId || !clientSecret) {
  throw new Error(
    'GOOGLE_AUTH_CLIENT_REQUIRED — set DRIVE_OUTBOX_CLIENT_ID and DRIVE_OUTBOX_CLIENT_SECRET (Google Cloud Console → OAuth client, type "Desktop app")',
  )
}

// 우리가 시작한 흐름이라는 유일한 증거. 256비트.
const state = randomBytes(32).toString('base64url')
const browser = flag('browser', '')

function mintRefreshToken() {
  const client = new google.auth.OAuth2(clientId, clientSecret)
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (fn, value) => {
      if (settled) return
      settled = true
      server.close()
      fn(value)
    }

    const server = createServer(async (req, res) => {
      const decision = decideGoogleAuthCallback({
        url: req.url ?? '/',
        expectedPath: CALLBACK_PATH,
        expectedState: state,
      })

      // 우리 콜백이 아니다(favicon 등). 흐름을 죽이지 않는다.
      if (decision.kind === 'ignore') {
        res.statusCode = 404
        return res.end('Not found')
      }
      if (decision.kind === 'reject') {
        res.statusCode = 400
        res.end('Authentication failed. Return to the console.')
        return finish(reject, new Error(`GOOGLE_AUTH_CALLBACK_REJECTED:${decision.reason}`))
      }

      try {
        const redirectUri = redirectUriFor(server)
        const { tokens } = await client.getToken({ code: decision.code, redirect_uri: redirectUri })
        res.end('Authorized. You can close this tab.')
        finish(resolve, tokens)
      } catch (error) {
        res.statusCode = 400
        res.end('Token exchange failed. Return to the console.')
        finish(reject, error)
      }
    })

    server.listen(0, '127.0.0.1', () => {
      const authorizeUrl = client.generateAuthUrl({
        // refresh token 은 offline + consent 를 함께 줘야 확실히 발급된다.
        // 이미 승인한 클라이언트라면 consent 없이는 access token 만 온다.
        access_type: 'offline',
        prompt: 'consent',
        scope: scopes,
        state,
        redirect_uri: redirectUriFor(server),
      })
      const args = browser ? ['-a', browser, authorizeUrl] : [authorizeUrl]
      spawn('open', args, { detached: true, stdio: 'ignore' }).unref()
      // URL 도 함께 찍는다. `open` 은 detached + stdio ignore 라 실패해도 조용하고,
      // 그러면 주인은 아무 링크도 없는 터미널을 보며 기다리게 된다. 이 URL 은 비밀이 아니다 —
      // state 는 1회용이고 흐름을 끝내려면 이 로컬 포트를 가지고 있어야 한다.
      process.stdout.write([
        '브라우저에서 Google 승인 화면을 여는 중입니다. 승인 후 이 창으로 돌아오십시오.',
        '창이 열리지 않으면 아래 주소를 직접 붙여넣으십시오:',
        '',
        authorizeUrl,
        '',
      ].join('\n'))
    })

    server.on('error', (error) => finish(reject, error))
  })
}

function redirectUriFor(server) {
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('GOOGLE_AUTH_SERVER_ADDRESS_MISSING')
  return `http://127.0.0.1:${address.port}${CALLBACK_PATH}`
}

const tokens = await mintRefreshToken()
const refreshToken = typeof tokens?.refresh_token === 'string' ? tokens.refresh_token.trim() : ''
if (!refreshToken) {
  // access token 만 온 경우다. 이미 승인된 클라이언트에 consent 를 다시 받지 못하면 이렇게 된다.
  throw new Error('GOOGLE_AUTH_NO_REFRESH_TOKEN — revoke this app at myaccount.google.com/permissions and run again')
}

await writeFile(outPath, `DRIVE_OUTBOX_REFRESH_TOKEN=${refreshToken}\n`, { mode: 0o600 })
await chmod(outPath, 0o600)

// 토큰 값은 절대 찍지 않는다. 터미널 스크롤백·CI 로그·스크린샷은 아무도 장기 자격증명을
// 두기로 결정한 적 없는 곳이다. 확인은 지문으로 한다 — 값이 아니라 값이 무엇인지의 표식.
const fingerprint = createHash('sha256').update(refreshToken).digest('hex').slice(0, 12)
process.stdout.write([
  'AUTH_OK',
  `services      ${services.join(', ')}`,
  `scopes        ${scopes.join(' ')}`,
  `written       ${path.relative(REPO_ROOT, outPath) || outPath} (mode 0600)`,
  `fingerprint   sha256:${fingerprint}… (토큰 자체가 아닙니다)`,
  '',
  '다음: 그 파일의 한 줄을 .env.local 에 붙이면 outbox:run 이 돕니다.',
  '',
].join('\n'))
