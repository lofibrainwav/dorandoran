'use client'

import { cn } from '@/lib/utils'
import type { TimeBlock } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Circle, Clock, Zap, Battery, BatteryLow } from 'lucide-react'

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

const priorityColors = {
  high: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  low: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
}

export function TaskCard({ block, onToggleComplete, onClick, variant = 'default' }: TaskCardProps) {
  const EnergyIcon = energyIcons[block.energy]
  
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleComplete?.(block.id)
  }

  return (
    <Card 
      className={cn(
        'transition-all duration-300 cursor-pointer hover:shadow-md',
        block.isCompleted && 'opacity-60',
        block.isCurrent && !block.isCompleted && 'ring-2 ring-primary/50 shadow-lg',
        variant === 'compact' && 'shadow-none'
      )}
      onClick={onClick}
    >
      <CardContent className={cn('p-4', variant === 'compact' && 'p-3')}>
        <div className="flex items-start gap-3">
          <button 
            onClick={handleToggle}
            className="mt-0.5 flex-shrink-0 transition-colors hover:text-primary"
          >
            {block.isCompleted ? (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
          
          <div className="flex-1 min-w-0">
            <p className={cn(
              'font-medium leading-snug text-balance',
              block.isCompleted && 'line-through text-muted-foreground'
            )}>
              {block.title}
            </p>
            
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>{block.startTime} - {block.endTime}</span>
              </div>
              
              <div className="flex items-center gap-1">
                <EnergyIcon className={cn('h-3.5 w-3.5', energyColors[block.energy])} />
                <span className={cn('text-xs', energyColors[block.energy])}>
                  {block.energy}
                </span>
              </div>
              
              <Badge variant="secondary" className={cn('text-xs', priorityColors[block.priority])}>
                {block.priority}
              </Badge>
            </div>
            
            {block.bufferAfter > 0 && !block.isCompleted && (
              <p className="text-xs text-muted-foreground mt-2">
                +{block.bufferAfter}min buffer after
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
