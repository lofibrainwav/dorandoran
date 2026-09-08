import type { Metadata } from 'next'
import { safeNextPath } from '@/lib/server/site-password-gate'

export const metadata: Metadata = {
  title: 'DoranDoran · Private Access',
  robots: { index: false, follow: false },
}

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const params = await searchParams
  const next = safeNextPath(params.next)
  const failed = params.error === '1'

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10">
      <section className="w-full max-w-sm rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">DoranDoran</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Private family space</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Enter the site password to continue.</p>
        <form action="/api/site-unlock" method="post" className="mt-5 space-y-3">
          <input type="hidden" name="next" value={next} />
          <label className="block text-sm font-medium" htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            autoFocus
            required
            className="w-full rounded-2xl border border-[var(--line)] bg-transparent px-4 py-3 text-base outline-none"
          />
          {failed ? <p className="text-sm" role="alert">That password is not correct.</p> : null}
          <button type="submit" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3 text-sm font-semibold">
            Enter DoranDoran
          </button>
        </form>
      </section>
    </main>
  )
}
