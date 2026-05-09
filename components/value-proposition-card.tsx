'use client'

import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight, AlertCircle, CalendarX, ListX, Shield, Calendar, RotateCcw, Lightbulb } from 'lucide-react'

const beforeItems = [
  { icon: ListX, label: 'Messy tasks' },
  { icon: CalendarX, label: 'Calendar conflicts' },
  { icon: AlertCircle, label: 'Unfinished work' },
]

const afterItems = [
  { icon: Shield, label: 'Protected Google Calendar' },
  { icon: Calendar, label: 'Focus blocks' },
  { icon: RotateCcw, label: 'Gentle carryover' },
  { icon: Lightbulb, label: 'Weekly insight' },
]

export function ValuePropositionCard() {
  return (
    <Card className="border-0 shadow-md bg-gradient-to-r from-muted/30 via-card to-primary/5">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 md:gap-6">
          {/* Before */}
          <div className="flex-1 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Before
            </p>
            <div className="space-y-1.5">
              {beforeItems.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <item.icon className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
                  <span className="text-xs text-muted-foreground line-through decoration-muted-foreground/30">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Arrow */}
          <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
            <ArrowRight className="h-4 w-4 text-primary" />
          </div>

          {/* After */}
          <div className="flex-1 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/70">
              After
            </p>
            <div className="space-y-1.5">
              {afterItems.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <item.icon className="h-3 w-3 text-primary flex-shrink-0" />
                  <span className="text-xs text-foreground font-medium">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
