'use client'

import { useMemo } from 'react'
import type { TimeBlock } from '@/lib/types'
import { TaskCard } from '@/components/task-card'
import { GentleReplanButton } from '@/components/gentle-replan-button'
import { TopThree } from '@/components/top-three'
import { EnergyMeter } from '@/components/energy-meter'
import { CalmEmptyState } from '@/components/calm-empty-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Play, CheckCircle2, ListChecks, Sparkles, Shield, Calendar, CheckCheck } from 'lucide-react'
import { calculateDayEnergy, getTopThree, getEncouragement } from '@/lib/mock-planner'
import { cn } from '@/lib/utils'

interface TodayTimelineProps {
  blocks: TimeBlock[]
  onToggleComplete: (id: string) => void
  onReplan: () => void
  onStartFocus: () => void
  onBack: () => void
}

export function TodayTimeline({ 
  blocks, 
  onToggleComplete, 
  onReplan, 
  onStartFocus,
  onBack 
}: TodayTimelineProps) {
  // Filter out protected Google Calendar events for progress tracking
  const oneBlockTasks = blocks.filter(b => !b.isProtected && b.source !== 'google_calendar')
  const completedCount = oneBlockTasks.filter(b => b.isCompleted).length
  const totalCount = oneBlockTasks.length
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0
  const currentBlock = blocks.find(b => b.isCurrent && !b.isCompleted && !b.isProtected)
  const allDone = completedCount === totalCount && totalCount > 0
  
  const energyData = useMemo(() => calculateDayEnergy(oneBlockTasks), [oneBlockTasks])
  const topThree = useMemo(() => getTopThree(oneBlockTasks), [oneBlockTasks])
  const encouragement = useMemo(
    () => getEncouragement(completedCount, totalCount), 
    [completedCount, totalCount]
  )

  // Calculate estimated end time
  const lastBlock = blocks[blocks.length - 1]
  const estimatedEnd = lastBlock?.endTime || ''

  // Proof strip counts
  const googleEventsCount = blocks.filter(b => b.source === 'google_calendar').length
  const focusBlocksCount = oneBlockTasks.length
  const conflictCount = 0 // Always 0 since we schedule around protected events

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Proof strip */}
      <div className="flex items-center justify-center gap-4 py-2 px-4 rounded-lg bg-muted/30 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Shield className="h-3 w-3 text-amber-500" />
          <span>{googleEventsCount} protected</span>
        </div>
        <div className="w-px h-3 bg-border" />
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3 w-3 text-primary" />
          <span>{focusBlocksCount} focus blocks</span>
        </div>
        <div className="w-px h-3 bg-border" />
        <div className="flex items-center gap-1.5">
          <CheckCheck className="h-3 w-3 text-emerald-500" />
          <span>{conflictCount} conflicts</span>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Start Over
        </Button>
        <GentleReplanButton onReplan={onReplan} disabled={allDone} />
      </div>

      {/* Title with encouragement */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm">
          <Sparkles className="h-3.5 w-3.5" />
          <span>{encouragement}</span>
        </div>
        
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-balance">
          {allDone ? 'You did it!' : 'Your Day, Organized'}
        </h1>
        
        {!allDone && estimatedEnd && (
          <p className="text-muted-foreground">
            {totalCount} tasks planned &middot; Done by ~{estimatedEnd}
          </p>
        )}
      </div>

      {/* Progress bar */}
      <Card className="border-0 shadow-md bg-card/80 backdrop-blur-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              <span className="font-medium">Progress</span>
            </div>
            <span className="text-muted-foreground">
              {completedCount} of {totalCount} complete
            </span>
          </div>
          <Progress value={progress} className="h-2.5" />
        </CardContent>
      </Card>

      {/* All done state */}
      {allDone && (
        <CalmEmptyState variant="complete" />
      )}

      {/* Focus mode CTA */}
      {currentBlock && !allDone && (
        <Button 
          onClick={onStartFocus} 
          className={cn(
            'w-full h-16 text-lg font-medium gap-3',
            'shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30',
            'transition-all duration-300'
          )}
          size="lg"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-foreground/20">
            <Play className="h-4 w-4" />
          </div>
          Enter Focus Mode
        </Button>
      )}

      {/* Top 3 section */}
      {topThree.length > 0 && !allDone && (
        <Card className="border-0 shadow-md bg-card/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <TopThree blocks={topThree} onStartFocus={onStartFocus} />
          </CardContent>
        </Card>
      )}

      {/* Energy meter */}
      {!allDone && (
        <Card className="border-0 shadow-md bg-card/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <EnergyMeter 
              total={energyData.total} 
              used={energyData.used} 
              breakdown={energyData.breakdown} 
            />
          </CardContent>
        </Card>
      )}

      {/* Full timeline */}
      {!allDone && (
        <div className="space-y-3">
          <Separator />
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Full Timeline</h3>
            <span className="text-xs text-muted-foreground">
              {totalCount - completedCount} remaining
            </span>
          </div>
          
          <div className="space-y-2">
            {blocks.map((block) => (
              <TaskCard
                key={block.id}
                block={block}
                onToggleComplete={onToggleComplete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed tasks when all done */}
      {allDone && (
        <div className="space-y-3">
          <Separator />
          <h3 className="text-sm font-medium text-muted-foreground text-center">
            What you accomplished today
          </h3>
          
          <div className="space-y-2">
            {blocks.map((block) => (
              <TaskCard
                key={block.id}
                block={block}
                onToggleComplete={onToggleComplete}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
