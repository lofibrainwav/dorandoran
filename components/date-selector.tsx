'use client'

import { cn } from '@/lib/utils'
import type { SelectedDate } from '@/lib/types'
import { Calendar, ChevronRight } from 'lucide-react'

interface DateSelectorProps {
  selectedDate: SelectedDate
  onDateChange: (date: SelectedDate) => void
  disabled?: boolean
}

export function DateSelector({ selectedDate, onDateChange, disabled }: DateSelectorProps) {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={() => onDateChange('today')}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
          selectedDate === 'today'
            ? 'bg-primary text-primary-foreground shadow-md'
            : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <Calendar className="h-3.5 w-3.5" />
        <span>Today</span>
        <span className="text-xs opacity-70">{formatDate(today)}</span>
      </button>
      
      <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
      
      <button
        onClick={() => onDateChange('tomorrow')}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
          selectedDate === 'tomorrow'
            ? 'bg-primary text-primary-foreground shadow-md'
            : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <Calendar className="h-3.5 w-3.5" />
        <span>Tomorrow</span>
        <span className="text-xs opacity-70">{formatDate(tomorrow)}</span>
      </button>
    </div>
  )
}
