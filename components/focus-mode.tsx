'use client'

import { useState, useEffect } from 'react'
import type { TimeBlock } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { GentleReplanButton } from '@/components/gentle-replan-button'
import { CheckCircle2, Pause, Play, X, SkipForward, Zap, Battery, BatteryLow, Sparkles, Coffee } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AnalogFocusClock } from '@/components/analog-focus-clock'

interface FocusModeProps {
  block: TimeBlock
  totalRemaining: number
  onComplete: () => void
  onSkip: () => void
  onReplan: () => void
  onExit: () => void
}

const energyIcons = {
  high: Zap,
  medium: Battery,
  low: BatteryLow,
}

const energyMessages = {
  high: 'High energy - give it your all!',
  medium: 'Steady pace - you got this.',
  low: 'Easy mode - gentle focus.',
}

const energyColors = {
  high: 'from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400',
  medium: 'from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400',
  low: 'from-sky-500/20 to-sky-500/5 text-sky-600 dark:text-sky-400',
}

const focusQuotes = [
  "One thing at a time. That's your only job right now.",
  "The world can wait. This moment is yours.",
  "Progress over perfection. Just keep going.",
  "You're exactly where you need to be.",
  "Small steps still move you forward.",
  "This task deserves your attention. Give it space.",
]

export function FocusMode({ 
  block, 
  totalRemaining,
  onComplete, 
  onSkip, 
  onReplan, 
  onExit 
}: FocusModeProps) {
  const [timeRemaining, setTimeRemaining] = useState(block.duration * 60)
  const [isRunning, setIsRunning] = useState(true)
  const [showComplete, setShowComplete] = useState(false)
  const [pulseRing, setPulseRing] = useState(false)

  const quoteIndex = [...block.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % focusQuotes.length
  const quote = focusQuotes[quoteIndex]



  useEffect(() => {
    if (!isRunning || timeRemaining <= 0) return

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setShowComplete(true)
          setPulseRing(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isRunning, timeRemaining])

  const EnergyIcon = energyIcons[block.energy]

  return (
    <div className="w-full max-w-xl mx-auto min-h-[80vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={onExit} className="gap-2 text-muted-foreground">
          <X className="h-4 w-4" />
          Exit
        </Button>
        <span className="text-sm text-muted-foreground">
          {totalRemaining} {totalRemaining === 1 ? 'task' : 'tasks'} remaining
        </span>
        <GentleReplanButton onReplan={onReplan} variant="ghost" />
      </div>

      {/* Main focus area */}
      <div className="flex-1 flex flex-col items-center justify-center py-8 space-y-8">
        
        {/* Energy badge */}
        <div className={cn(
          'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium',
          'bg-gradient-to-r',
          energyColors[block.energy]
        )}>
          <EnergyIcon className="h-4 w-4" />
          {energyMessages[block.energy]}
        </div>

        {/* Task title */}
        <h1 className="text-2xl md:text-4xl font-semibold tracking-tight text-center text-balance px-4 leading-snug">
          {block.title}
        </h1>

        {/* Giant timer */}
        <Card className={cn(
          'border-0 shadow-2xl bg-card/95 backdrop-blur-sm',
          pulseRing && 'animate-pulse ring-4 ring-primary/50'
        )}>
          <CardContent className="p-8 md:p-12">
            <div className="text-center space-y-6">
              {/* Analog Focus Clock */}
              <div className="relative w-56 h-56 md:w-72 md:h-72 mx-auto">
                {/* Background glow based on energy */}
                <div className={cn(
                  'absolute inset-0 rounded-full blur-2xl opacity-20',
                  block.energy === 'high' && 'bg-emerald-500',
                  block.energy === 'medium' && 'bg-amber-500',
                  block.energy === 'low' && 'bg-sky-500',
                )} />
                
                <AnalogFocusClock
                  durationSeconds={block.duration * 60}
                  timeRemaining={timeRemaining}
                  isRunning={isRunning}
                  className="w-full h-full"
                />
              </div>
              
              {/* Focus clock label */}
              <div className="text-center">
                <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
                  Focus Clock
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {block.startTime} - {block.endTime}
                </p>
              </div>

              {/* Play/Pause */}
              <div className="flex items-center justify-center">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setIsRunning(!isRunning)}
                  className="h-14 w-14 rounded-full p-0 shadow-md hover:shadow-lg transition-shadow"
                >
                  {isRunning ? (
                    <Pause className="h-6 w-6" />
                  ) : (
                    <Play className="h-6 w-6 ml-0.5" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inspirational quote */}
        <div className="flex items-start gap-3 max-w-md px-6">
          <Sparkles className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground italic text-balance">
            {quote}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="space-y-4 pb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            onClick={onComplete}
            className={cn(
              'flex-1 h-16 text-lg font-medium gap-3',
              'shadow-lg shadow-primary/25 hover:shadow-xl',
              'transition-all duration-300',
              showComplete && 'animate-pulse'
            )}
            size="lg"
          >
            <CheckCircle2 className="h-6 w-6" />
            {showComplete ? "Time's Up! Mark Complete" : 'Done with this'}
          </Button>
          
          <Button 
            variant="outline"
            onClick={onSkip}
            className="h-16 gap-2 px-6"
          >
            <SkipForward className="h-5 w-5" />
            Skip
          </Button>
        </div>

        {/* Buffer message */}
        {block.bufferAfter > 0 && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Coffee className="h-4 w-4" />
            <span>{block.bufferAfter}-minute break after this</span>
          </div>
        )}
      </div>
    </div>
  )
}
