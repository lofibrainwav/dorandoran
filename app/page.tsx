import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-dvh px-6 py-10 md:px-10">
      <section className="mx-auto flex min-h-[70dvh] max-w-6xl flex-col justify-center gap-6">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Chad Family OS</p>
        <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.04em] md:text-7xl">
          Your family, in sync.
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-[var(--muted)]">
          A Jayden-centered family coordination system. The WebGPU hero will live here,
          while the real family week stays fast, readable, and independent.
        </p>
        <Link className="w-fit rounded-full border border-[var(--line)] px-5 py-3" href="/family">
          Open Family Week
        </Link>
      </section>
    </main>
  )
}
