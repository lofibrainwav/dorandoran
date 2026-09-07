const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function FamilyWeekPage() {
  return (
    <main className="min-h-dvh px-4 py-6 md:px-8">
      <header className="mx-auto mb-6 max-w-7xl">
        <p className="text-sm uppercase tracking-[0.22em] text-[var(--muted)]">Family Week</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Jayden-centered coordination</h1>
      </header>
      <section className="mx-auto max-w-7xl overflow-x-auto rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <div className="grid min-w-[840px] grid-cols-7 gap-px overflow-hidden rounded-2xl bg-[var(--line)]">
          {days.map((day) => (
            <div key={day} className="min-h-[420px] bg-[var(--surface)] p-4">
              <h2 className="text-sm font-medium text-[var(--muted)]">{day}</h2>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
