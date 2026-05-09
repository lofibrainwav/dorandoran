'use client'

import type { TimeBlock } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Star, Zap, Battery, BatteryLow } from 'lucide-react'

interface TopThreeProps {
  blocks: TimeBlock[]
  onStartFocus: () => void
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

export function TopThree({ blocks, onStartFocus }: TopThreeProps) {
  if (blocks.length === 0) return null
  
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Star className="h-4 w-4 text-primary fill-primary" />
        <h3 className="text-sm font-medium">Your Top 3 Today</h3>
      </div>
      
      <div className="grid gap-2">
        {blocks.map((block, index) => {
          const EnergyIcon = energyIcons[block.energy]
          const isFirst = index === 0
          
          return (
            <Card 
              key={block.id}
              className={cn(
                'transition-all duration-200 cursor-pointer hover:shadow-md border-0',
                isFirst && 'bg-primary/5 ring-1 ring-primary/20'
              )}
              onClick={isFirst ? onStartFocus : undefined}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <div className={cn(
                  'flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold',
                  isFirst ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}>
                  {index + 1}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm font-medium truncate',
                    block.isCompleted && 'line-through text-muted-foreground'
                  )}>
                    {block.title}
                  </p>
                </div>
                
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-muted-foreground">{block.duration}m</span>
                  <EnergyIcon className={cn('h-3.5 w-3.5', energyColors[block.energy])} />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      
      <p className="text-xs text-muted-foreground text-center">
        Focus on these first. Everything else can wait.
      </p>
    </div>
  )
}
