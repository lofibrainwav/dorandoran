'use client'

import type { TimeBlock } from '@/lib/types'
import { TaskCard } from '@/components/task-card'
import { GentleReplanButton } from '@/components/gentle-replan-button'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, Play, CheckCircle2 } from 'lucide-react'

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
  const completedCount = blocks.filter(b => b.isCompleted).length
  const totalCount = blocks.length
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0
  const currentBlock = blocks.find(b => b.isCurrent && !b.isCompleted)
  const allDone = completedCount === totalCount && totalCount > 0

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <GentleReplanButton onReplan={onReplan} disabled={allDone} />
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          {allDone ? 'Amazing work today!' : 'Your Day, Planned'}
        </h1>
        <p className="text-muted-foreground">
          {allDone 
            ? 'You completed everything. Time to rest.'
            : `${completedCount} of ${totalCount} tasks complete`
          }
        </p>
      </div>

      <div className="space-y-2">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{Math.round(progress)}% done</span>
          <span>{totalCount - completedCount} remaining</span>
        </div>
      </div>

      {currentBlock && !allDone && (
        <Button 
          onClick={onStartFocus} 
          className="w-full h-14 text-base font-medium gap-2"
          size="lg"
        >
          <Play className="h-5 w-5" />
          Start Focus Mode
        </Button>
      )}

      {allDone && (
        <div className="flex items-center justify-center gap-2 p-6 bg-primary/10 rounded-xl">
          <CheckCircle2 className="h-6 w-6 text-primary" />
          <span className="text-lg font-medium text-primary">All tasks completed!</span>
        </div>
      )}

      <div className="space-y-3">
        {blocks.map((block) => (
          <TaskCard
            key={block.id}
            block={block}
            onToggleComplete={onToggleComplete}
          />
        ))}
      </div>
    </div>
  )
}
