'use client'

import { cn } from '@/lib/utils'

interface AnalogFocusClockProps {
  durationSeconds: number
  timeRemaining: number
  isRunning: boolean
  className?: string
}

export function AnalogFocusClock({
  durationSeconds,
  timeRemaining,
  isRunning,
  className,
}: AnalogFocusClockProps) {
  // Calculate progress (0 to 1)
  const elapsed = durationSeconds - timeRemaining
  const progress = durationSeconds > 0 ? elapsed / durationSeconds : 0
  
  // Hand rotation: 0% = 12 o'clock, 100% = full rotation back to 12
  const handRotation = progress * 360
  
  // Progress arc: starts at 12 o'clock (-90deg offset), sweeps clockwise
  const progressArcLength = progress * 283 // circumference for r=45
  
  // Format time for center display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className={cn('relative', className)}>
      {/* Soft outer glow */}
      <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl scale-110" />
      
      <svg 
        viewBox="0 0 100 100" 
        className="w-full h-full relative z-10"
      >
        {/* Outer ring - subtle shadow effect */}
        <circle
          cx="50"
          cy="50"
          r="48"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          className="text-border"
        />
        
        {/* Clock face background */}
        <circle
          cx="50"
          cy="50"
          r="46"
          className="fill-card"
        />
        
        {/* Inner subtle ring */}
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className="text-muted/30"
        />
        
        {/* 12 tick marks */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 - 90) * (Math.PI / 180)
          const isMainTick = i % 3 === 0
          const innerRadius = isMainTick ? 38 : 40
          const outerRadius = 43
          const x1 = 50 + innerRadius * Math.cos(angle)
          const y1 = 50 + innerRadius * Math.sin(angle)
          const x2 = 50 + outerRadius * Math.cos(angle)
          const y2 = 50 + outerRadius * Math.sin(angle)
          
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              strokeWidth={isMainTick ? 1.5 : 0.75}
              strokeLinecap="round"
              className={isMainTick ? 'text-muted-foreground/60' : 'text-muted-foreground/30'}
            />
          )
        })}
        
        {/* Progress arc - soft sweep showing elapsed time */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${progressArcLength} 283`}
          transform="rotate(-90 50 50)"
          className="text-primary/40 transition-all duration-1000 ease-linear"
        />
        
        {/* Main hand */}
        <g 
          transform={`rotate(${handRotation} 50 50)`}
          className="transition-transform duration-1000 ease-linear"
        >
          {/* Hand shadow */}
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="14"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="text-primary/20"
            transform="translate(0.5, 0.5)"
          />
          {/* Hand */}
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="14"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="text-primary"
          />
          {/* Hand tail */}
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="56"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-primary/70"
          />
        </g>
        
        {/* Center dot - outer ring */}
        <circle
          cx="50"
          cy="50"
          r="5"
          className="fill-card stroke-primary/30"
          strokeWidth="1"
        />
        
        {/* Center dot - inner */}
        <circle
          cx="50"
          cy="50"
          r="3"
          className="fill-primary"
        />
        
        {/* Subtle pulsing indicator when running */}
        {isRunning && (
          <circle
            cx="50"
            cy="50"
            r="3"
            className="fill-primary animate-pulse"
          />
        )}
      </svg>
      
      {/* Digital time in center - positioned below the clock hands area */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none">
        <div className="mt-12">
          <span className="text-2xl md:text-3xl font-mono font-semibold tabular-nums tracking-tight text-foreground/90">
            {formatTime(timeRemaining)}
          </span>
        </div>
      </div>
    </div>
  )
}
