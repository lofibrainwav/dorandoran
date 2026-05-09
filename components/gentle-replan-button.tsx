'use client'

import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface GentleReplanButtonProps {
  onReplan: () => void
  disabled?: boolean
  variant?: 'default' | 'ghost' | 'outline'
}

export function GentleReplanButton({ 
  onReplan, 
  disabled = false,
  variant = 'outline' 
}: GentleReplanButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size="sm"
            onClick={onReplan}
            disabled={disabled}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Gentle Replan
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[200px] text-center">
          <p>Life happens. This will reorganize your remaining tasks from now - no guilt attached.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
