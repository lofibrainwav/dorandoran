import Script from 'next/script'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

function signInMessage(error: string | undefined) {
  if (error === 'denied') return 'This Google account is not approved for this family space.'
  if (error === 'google') return 'Google sign-in could not be verified. Please try again.'
  if (error === 'csrf') return 'The sign-in request expired. Please try again.'
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
  const legacyFallback = Boolean(process.env.DORANDORAN_ACCESS_CODE?.trim())
  const message = signInMessage(params.error)

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-white/45">DoranDoran Family OS</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Sign in with Google</h1>
        <p className="mt-3 text-sm leading-6 text-white/60">
          Approved family adults enter the same private household space. No separate site password is needed.
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
            Google sign-in is not configured for this deployment yet.
          </div>
        )}

        {legacyFallback ? (
          <a
            href="/unlock"
            className="mt-7 inline-flex text-sm text-white/45 underline decoration-white/20 underline-offset-4 hover:text-white/70"
          >
            Temporary access-code fallback
          </a>
        ) : null}
      </section>
    </main>
  )
}
