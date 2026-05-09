'use client'

import type { GoogleCalendarEvent } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Shield, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CalendarContextProps {
  events: GoogleCalendarEvent[]
}

export function CalendarContext({ events }: CalendarContextProps) {
  if (events.length === 0) {
    return (
      <Card className="border-0 shadow-md bg-card/80 backdrop-blur-sm">
        <CardContent className="p-4 text-center">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 mx-auto mb-2">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            Your calendar is clear today. Full flexibility for focus blocks.
          </p>
        </CardContent>
      </Card>
    )
  }

  const totalProtectedMinutes = events.reduce((sum, e) => sum + e.duration, 0)
  const hours = Math.floor(totalProtectedMinutes / 60)
  const minutes = totalProtectedMinutes % 60
  const timeStr = hours > 0 
    ? `${hours}h ${minutes > 0 ? `${minutes}m` : ''}` 
    : `${minutes}m`

  return (
    <Card className="border-0 shadow-md bg-card/80 backdrop-blur-sm">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-medium text-sm">Today&apos;s Calendar</h3>
              <p className="text-xs text-muted-foreground">
                {events.length} {events.length === 1 ? 'event' : 'events'} &middot; {timeStr} protected
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            <Shield className="h-3 w-3 mr-1" />
            Protected
          </Badge>
        </div>

        {/* Events list */}
        <div className="space-y-2">
          {events.map((event) => (
            <div
              key={event.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg',
                'bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30'
              )}
            >
              <div className="flex-shrink-0 w-1 h-10 rounded-full bg-amber-400 dark:bg-amber-500" />
              
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{event.title}</p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{event.startTime} - {event.endTime}</span>
                  <span className="text-muted-foreground/50">&middot;</span>
                  <span>{event.duration}m</span>
                </div>
              </div>
              
              <Shield className="h-4 w-4 text-amber-500 dark:text-amber-400 flex-shrink-0" />
            </div>
          ))}
        </div>

        {/* Explanation */}
        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          These events won&apos;t be moved or replaced. 
          OneBlock will schedule focus blocks around them.
        </p>
      </CardContent>
    </Card>
  )
}
