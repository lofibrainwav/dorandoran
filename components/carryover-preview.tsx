'use client'

import { cn } from '@/lib/utils'
import type { TimeBlock } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight, Sunrise, Clock } from 'lucide-react'

interface CarryoverPreviewProps {
  unfinishedTasks: TimeBlock[]
  onPlanTomorrow: () => void
  isPlanning?: boolean
}

export function CarryoverPreview({ unfinishedTasks, onPlanTomorrow, isPlanning }: CarryoverPreviewProps) {
  if (unfinishedTasks.length === 0) return null
  
  const totalMinutes = unfinishedTasks.reduce((sum, t) => sum + t.duration, 0)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const timeString = hours > 0 
    ? `${hours}h ${minutes > 0 ? `${minutes}m` : ''}` 
    : `${minutes}m`

  return (
    <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50/80 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
            <Sunrise className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground">
              Unfinished tasks can gently roll into tomorrow.
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {unfinishedTasks.length} {unfinishedTasks.length === 1 ? 'task' : 'tasks'} remaining 
              <span className="mx-1.5">·</span>
              <Clock className="h-3 w-3 inline-block mr-0.5" />
              {timeString} of focus time
            </p>
          </div>
        </div>
        
        {/* Preview of tasks */}
        <div className="flex flex-wrap gap-1.5">
          {unfinishedTasks.slice(0, 4).map((task) => (
            <span 
              key={task.id} 
              className="px-2 py-0.5 rounded-full bg-amber-100/80 dark:bg-amber-900/30 text-xs text-amber-700 dark:text-amber-300 truncate max-w-[150px]"
            >
              {task.title}
            </span>
          ))}
          {unfinishedTasks.length > 4 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-100/80 dark:bg-amber-900/30 text-xs text-amber-700 dark:text-amber-300">
              +{unfinishedTasks.length - 4} more
            </span>
          )}
        </div>
        
        <Button 
          onClick={onPlanTomorrow}
          disabled={isPlanning}
          className={cn(
            'w-full gap-2',
            'bg-amber-600 hover:bg-amber-700 text-white',
            'shadow-md shadow-amber-600/20'
          )}
        >
          {isPlanning ? (
            'Planning...'
          ) : (
            <>
              Plan Tomorrow with Carryover
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
