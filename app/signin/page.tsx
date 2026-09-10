import Script from 'next/script'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

function signInMessage(error: string | undefined) {
  if (error === 'denied') return '이 구글 계정은 이 가족 공간에 승인되어 있지 않습니다.'
  if (error === 'google') return '구글 로그인을 확인하지 못했습니다. 다시 시도해 주세요.'
  if (error === 'csrf') return '로그인 요청이 만료되었습니다. 다시 시도해 주세요.'
  return null
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const requestHeaders = await headers()
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'https'
  const origin = host ? `${protocol}://${host}` : 'https://dorandoran.link'
  const clientId = process.env.GOOGLE_WEB_CLIENT_ID?.trim()
  const message = signInMessage(params.error)

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="text-5xl leading-none text-[#efaa55]">✺</span>
          <span>
            <span className="block text-2xl font-extrabold tracking-tight">도란도란</span>
            <span className="mt-1 block text-[8px] font-semibold uppercase tracking-[0.2em] text-white/45">
              Our family, a little closer
            </span>
          </span>
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">구글 계정으로 들어오세요</h1>
        <p className="mt-3 text-sm leading-6 text-white/60">
          승인된 가족만 같은 사적 공간에 들어옵니다. 따로 사이트 비밀번호를 두지 않습니다.
        </p>

        {message ? (
          <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
            {message}
          </div>
        ) : null}

        {clientId ? (
          <div className="mt-8 min-h-11">
            <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
            <div
              id="g_id_onload"
              data-client_id={clientId}
              data-login_uri={`${origin}/api/auth/google`}
              data-ux_mode="redirect"
              data-auto_prompt="false"
              data-itp_support="true"
            />
            <div
              className="g_id_signin"
              data-type="standard"
              data-theme="outline"
              data-size="large"
              data-text="signin_with"
              data-shape="rectangular"
              data-logo_alignment="left"
              data-width="320"
            />
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-white/55">
            이 배포에는 아직 구글 로그인이 설정되지 않았습니다.
          </div>
        )}

      </section>
    </main>
  )
}
