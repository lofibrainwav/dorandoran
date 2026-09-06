'use client'

import { Zap, Battery, BatteryLow, Sparkles } from 'lucide-react'

interface EnergyMeterProps {
  total: number
  used: number
  breakdown: { high: number; medium: number; low: number }
}

export function EnergyMeter({ total, used, breakdown }: EnergyMeterProps) {
  const percentage = total > 0 ? Math.round((used / total) * 100) : 0
  const remaining = total - used
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Energy Budget</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {percentage}% spent
        </span>
      </div>
      
      {/* Main energy bar */}
      <div className="relative h-3 bg-muted rounded-full overflow-hidden">
        <div 
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      {/* Breakdown */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex items-center gap-1.5 text-xs">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <Zap className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          </div>
          <span className="text-muted-foreground">{breakdown.high}m</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Battery className="h-3 w-3 text-amber-600 dark:text-amber-400" />
          </div>
          <span className="text-muted-foreground">{breakdown.medium}m</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-900/30">
            <BatteryLow className="h-3 w-3 text-sky-600 dark:text-sky-400" />
          </div>
          <span className="text-muted-foreground">{breakdown.low}m</span>
        </div>
      </div>
      
      {/* Gentle message */}
      <p className="text-xs text-muted-foreground text-center">
        {remaining > total * 0.7 
          ? "Plenty of energy left. Take your time."
          : remaining > total * 0.3 
            ? "Good pace. Remember to take breaks."
            : remaining > 0 
              ? "Almost there. You're doing great."
              : "All done! Time to recharge."
        }
      </p>
    </div>
  )
}
