'use client'

import { useState, useEffect, useCallback } from 'react'
import type { TimeBlock } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { GentleReplanButton } from '@/components/gentle-replan-button'
import { CheckCircle2, Pause, Play, X, SkipForward, Zap, Battery, BatteryLow } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FocusModeProps {
  block: TimeBlock
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
  high: 'High energy task - give it your best!',
  medium: 'Steady pace - you got this.',
  low: 'Easy does it - gentle focus.',
}

export function FocusMode({ block, onComplete, onSkip, onReplan, onExit }: FocusModeProps) {
  const [timeRemaining, setTimeRemaining] = useState(block.duration * 60) // seconds
  const [isRunning, setIsRunning] = useState(true)
  const [showComplete, setShowComplete] = useState(false)

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }, [])

  useEffect(() => {
    if (!isRunning || timeRemaining <= 0) return

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setShowComplete(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isRunning, timeRemaining])

  const progress = ((block.duration * 60 - timeRemaining) / (block.duration * 60)) * 100
  const EnergyIcon = energyIcons[block.energy]

  const handleComplete = () => {
    onComplete()
  }

  return (
    <div className="w-full max-w-xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onExit} className="gap-2">
          <X className="h-4 w-4" />
          Exit Focus
        </Button>
        <GentleReplanButton onReplan={onReplan} variant="ghost" />
      </div>

      <div className="text-center space-y-4">
        <div className={cn(
          'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm',
          block.energy === 'high' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
          block.energy === 'medium' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
          block.energy === 'low' && 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
        )}>
          <EnergyIcon className="h-4 w-4" />
          {energyMessages[block.energy]}
        </div>

        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-balance px-4">
          {block.title}
        </h1>
      </div>

      <Card className="border-0 shadow-xl bg-card/90 backdrop-blur-sm">
        <CardContent className="p-8 md:p-12">
          <div className="text-center space-y-6">
            {/* Timer Circle */}
            <div className="relative w-48 h-48 mx-auto">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-muted/30"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${progress * 2.83} 283`}
                  className="text-primary transition-all duration-1000 ease-linear"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl md:text-5xl font-mono font-semibold tabular-nums">
                  {formatTime(timeRemaining)}
                </span>
              </div>
            </div>

            {/* Timer Controls */}
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setIsRunning(!isRunning)}
                className="h-12 w-12 rounded-full p-0"
              >
                {isRunning ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              {block.startTime} - {block.endTime} ({block.duration} min)
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button 
          onClick={handleComplete}
          className="flex-1 h-14 text-base font-medium gap-2"
          size="lg"
        >
          <CheckCircle2 className="h-5 w-5" />
          {showComplete ? 'Time\'s Up! Complete Task' : 'Mark Complete'}
        </Button>
        
        <Button 
          variant="outline"
          onClick={onSkip}
          className="h-14 gap-2"
        >
          <SkipForward className="h-5 w-5" />
          Skip
        </Button>
      </div>

      {block.bufferAfter > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          After this, you have a {block.bufferAfter}-minute buffer to breathe.
        </p>
      )}
    </div>
  )
}
