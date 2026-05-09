'use client'

import { Cloud, Sparkles, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CalmEmptyStateProps {
  variant?: 'inbox' | 'complete'
  className?: string
}

export function CalmEmptyState({ variant = 'inbox', className }: CalmEmptyStateProps) {
  if (variant === 'complete') {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12 px-4', className)}>
        <div className="relative">
          <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl scale-150" />
          <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
            <Sun className="h-10 w-10 text-primary" />
          </div>
        </div>
        
        <div className="mt-6 text-center space-y-2">
          <h3 className="text-xl font-semibold text-balance">
            Your day is complete
          </h3>
          <p className="text-muted-foreground max-w-[280px] text-balance">
            Everything&apos;s done. You&apos;ve earned this moment of peace.
          </p>
        </div>
        
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          <span>Time to rest guilt-free</span>
        </div>
      </div>
    )
  }
  
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4', className)}>
      <div className="relative">
        <div className="absolute inset-0 bg-muted rounded-full blur-2xl scale-150 opacity-50" />
        <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-muted to-muted/50">
          <Cloud className="h-10 w-10 text-muted-foreground" />
        </div>
      </div>
      
      <div className="mt-6 text-center space-y-2">
        <h3 className="text-xl font-semibold text-balance">
          A quiet moment
        </h3>
        <p className="text-muted-foreground max-w-[280px] text-balance">
          Nothing here yet. When thoughts pile up, dump them above.
        </p>
      </div>
    </div>
  )
}
