import type { FamilyBlock } from '@/lib/family-os/contracts'
import { projectAllDayWeekBlocks, projectWeekBlocks, weekDayLabels } from '@/lib/family-os/week-projection'

interface FamilyWeekGridProps {
  blocks: FamilyBlock[]
  weekStartDate: string
}

const START_MINUTE = 6 * 60
const END_MINUTE = 21 * 60
const HOUR_HEIGHT = 64

function clockLabel(totalMinutes: number) {
  const hour24 = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  const period = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 % 12 || 12
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`
}

export function FamilyWeekGrid({ blocks, weekStartDate }: FamilyWeekGridProps) {
  const projected = projectWeekBlocks(blocks, weekStartDate)
  const allDayProjected = projectAllDayWeekBlocks(blocks, weekStartDate)
  const byId = new Map(blocks.map((block) => [block.id, block]))
  const hours = Array.from({ length: (END_MINUTE - START_MINUTE) / 60 + 1 }, (_, i) => START_MINUTE + i * 60)
  const canvasHeight = ((END_MINUTE - START_MINUTE) / 60) * HOUR_HEIGHT

  return (
    <section className="h-[78dvh] w-full min-w-0 min-h-[560px] overflow-auto rounded-2xl border bg-card shadow-sm">
      <div className="min-w-[920px]">
        <div className="sticky top-0 z-20 grid grid-cols-[4.5rem_repeat(7,minmax(7rem,1fr))] border-b bg-background/95 backdrop-blur">
          <div className="p-3 text-xs font-medium text-muted-foreground">Time</div>
          {weekDayLabels.map((day, index) => (
            <div key={day} className="border-l p-3 text-center">
              <div className="text-sm font-semibold">{day}</div>
              {index === 0 && <div className="mt-0.5 text-[10px] text-primary">Week starts here</div>}
            </div>
          ))}
        </div>

        {allDayProjected.length > 0 && (
          <div className="grid grid-cols-[4.5rem_1fr] border-b bg-muted/10">
            <div className="border-r p-2 text-[10px] font-medium text-muted-foreground">All day</div>
            <div className="grid grid-cols-7 gap-y-1 p-1">
              {allDayProjected.map((item) => {
                const block = byId.get(item.blockId)
                if (!block) return null
                return (
                  <article
                    key={block.id}
                    className="rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-[10px] font-medium"
                    style={{ gridColumn: `${item.startDayIndex + 1} / ${item.endDayIndexExclusive + 1}` }}
                  >
                    <div className="truncate">{block.reality.title}</div>
                  </article>
                )
              })}
            </div>
          </div>
        )}

        <div
          className="relative grid grid-cols-[4.5rem_repeat(7,minmax(7rem,1fr))]"
          style={{
            height: canvasHeight,
            backgroundImage: 'linear-gradient(to bottom, var(--border) 1px, transparent 1px)',
            backgroundSize: `100% ${HOUR_HEIGHT}px`,
          }}
        >
          <div className="relative border-r bg-muted/15">
            {hours.map((minute) => (
              <div
                key={minute}
                className="absolute right-2 -translate-y-2 text-[10px] text-muted-foreground"
                style={{ top: ((minute - START_MINUTE) / 60) * HOUR_HEIGHT }}
              >
                {clockLabel(minute)}
              </div>
            ))}
          </div>
          {weekDayLabels.map((day, dayIndex) => (
            <div key={day} className="relative border-l">
              {projected
                .filter((item) => item.dayIndex === dayIndex && item.endMinute > START_MINUTE && item.startMinute < END_MINUTE)
                .map((item) => {
                  const block = byId.get(item.blockId)
                  if (!block) return null
                  const visibleStart = Math.max(item.startMinute, START_MINUTE)
                  const visibleEnd = Math.min(item.endMinute, END_MINUTE)
                  const top = ((visibleStart - START_MINUTE) / 60) * HOUR_HEIGHT
                  const height = Math.max(28, ((visibleEnd - visibleStart) / 60) * HOUR_HEIGHT)
                  const confirmed = block.evidenceState === 'confirmed'
                  return (
                    <article
                      key={block.id}
                      className={confirmed
                        ? 'absolute left-1 right-1 overflow-hidden rounded-lg border border-primary/30 bg-primary/10 p-2 text-xs shadow-sm'
                        : 'absolute left-1 right-1 overflow-hidden rounded-lg border border-dashed bg-muted/70 p-2 text-xs'}
                      style={{ top, height }}
                    >
                      <div className="truncate font-semibold">{block.reality.title}</div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {clockLabel(item.startMinute)}–{clockLabel(item.endMinute)}
                      </div>
                      {block.timeEngine.protected && <div className="mt-1 text-[9px] font-medium text-primary">Protected</div>}
                    </article>
                  )
                })}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
