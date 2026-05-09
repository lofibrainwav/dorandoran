'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, Sparkles } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface GentleReplanButtonProps {
  onReplan: () => void
  disabled?: boolean
  variant?: 'default' | 'ghost' | 'outline'
}

const replanMessages = [
  "Plans change. That's okay.",
  "Adjusting to your rhythm.",
  "Flexibility is a superpower.",
  "Let's reorganize from now.",
]

export function GentleReplanButton({ 
  onReplan, 
  disabled = false,
  variant = 'outline' 
}: GentleReplanButtonProps) {
  const [isReplanning, setIsReplanning] = useState(false)
  const [message] = useState(() => 
    replanMessages[Math.floor(Math.random() * replanMessages.length)]
  )

  const handleReplan = async () => {
    setIsReplanning(true)
    
    // Brief animation delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    onReplan()
    setIsReplanning(false)
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size="sm"
            onClick={handleReplan}
            disabled={disabled || isReplanning}
            className={cn(
              'gap-2 transition-all',
              isReplanning && 'text-primary'
            )}
          >
            <RefreshCw className={cn(
              'h-4 w-4',
              isReplanning && 'animate-spin'
            )} />
            <span className="hidden sm:inline">
              {isReplanning ? 'Adjusting...' : 'Replan'}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[200px] text-center">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3 w-3 text-primary flex-shrink-0" />
            <p className="text-xs">{message}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
