'use client'

import { cn } from '@/lib/utils'
import type { TimeBlock } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Circle, Clock, Zap, Battery, BatteryLow, Sparkles } from 'lucide-react'

interface TaskCardProps {
  block: TimeBlock
  onToggleComplete?: (id: string) => void
  onClick?: () => void
  variant?: 'default' | 'compact'
}

const energyIcons = {
  high: Zap,
  medium: Battery,
  low: BatteryLow,
}

const energyColors = {
  high: 'text-emerald-600 dark:text-emerald-400',
  medium: 'text-amber-600 dark:text-amber-400',
  low: 'text-sky-600 dark:text-sky-400',
}

const energyBgColors = {
  high: 'bg-emerald-50 dark:bg-emerald-950/30',
  medium: 'bg-amber-50 dark:bg-amber-950/30',
  low: 'bg-sky-50 dark:bg-sky-950/30',
}

const priorityConfig = {
  high: {
    bg: 'bg-rose-100 dark:bg-rose-900/30',
    text: 'text-rose-700 dark:text-rose-300',
    label: 'Important'
  },
  medium: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-300',
    label: 'Normal'
  },
  low: {
    bg: 'bg-sky-100 dark:bg-sky-900/30',
    text: 'text-sky-700 dark:text-sky-300',
    label: 'Flexible'
  },
}

export function TaskCard({ block, onToggleComplete, onClick, variant = 'default' }: TaskCardProps) {
  const EnergyIcon = energyIcons[block.energy]
  const priorityStyle = priorityConfig[block.priority]
  
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleComplete?.(block.id)
  }

  return (
    <Card 
      className={cn(
        'transition-all duration-300 border-0 shadow-sm hover:shadow-md',
        block.isCompleted && 'opacity-50 bg-muted/50',
        block.isCurrent && !block.isCompleted && 'ring-2 ring-primary/40 shadow-lg bg-primary/5',
        variant === 'compact' && 'shadow-none'
      )}
      onClick={onClick}
    >
      <CardContent className={cn('p-4', variant === 'compact' && 'p-3')}>
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <button 
            onClick={handleToggle}
            className={cn(
              'mt-0.5 flex-shrink-0 transition-all duration-200',
              'hover:scale-110 active:scale-95',
              block.isCompleted ? 'text-primary' : 'text-muted-foreground hover:text-primary'
            )}
          >
            {block.isCompleted ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <Circle className="h-5 w-5" />
            )}
          </button>
          
          <div className="flex-1 min-w-0">
            {/* Current task indicator */}
            {block.isCurrent && !block.isCompleted && (
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="h-3 w-3 text-primary" />
                <span className="text-xs font-medium text-primary">Up next</span>
              </div>
            )}
            
            {/* Title */}
            <p className={cn(
              'font-medium leading-snug text-balance',
              block.isCompleted && 'line-through text-muted-foreground'
            )}>
              {block.title}
            </p>
            
            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {/* Time */}
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>{block.startTime}</span>
                <span className="text-muted-foreground/50">·</span>
                <span>{block.duration}m</span>
              </div>
              
              {/* Energy */}
              <div className={cn(
                'flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs',
                energyBgColors[block.energy]
              )}>
                <EnergyIcon className={cn('h-3 w-3', energyColors[block.energy])} />
                <span className={energyColors[block.energy]}>
                  {block.energy}
                </span>
              </div>
              
              {/* Priority */}
              {block.priority === 'high' && (
                <Badge variant="secondary" className={cn('text-xs', priorityStyle.bg, priorityStyle.text)}>
                  {priorityStyle.label}
                </Badge>
              )}
            </div>
            
            {/* Buffer */}
            {block.bufferAfter > 0 && !block.isCompleted && (
              <p className="text-xs text-muted-foreground/70 mt-2">
                +{block.bufferAfter}min break after
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
