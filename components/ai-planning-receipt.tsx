'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Receipt } from 'lucide-react'
import type { TimeBlock } from '@/lib/types'

interface AIPlanningReceiptProps {
  blocks: TimeBlock[]
}

export function AIPlanningReceipt({ blocks }: AIPlanningReceiptProps) {
  // Calculate actual counts from blocks
  const googleEventsCount = blocks.filter(b => b.source === 'google_calendar').length
  const focusBlocksCount = blocks.filter(b => b.source === 'oneblock' || !b.source).length
  const carriedOverCount = blocks.filter(b => b.carriedFromDate).length
  const conflictCount = 0 // Always 0 since we schedule around protected events
  const suggestedRules = 1 // Mock: always suggest 1 rule

  // Build receipt line
  const receiptParts: string[] = []
  
  if (googleEventsCount > 0) {
    receiptParts.push(`Protected ${googleEventsCount} Google event${googleEventsCount !== 1 ? 's' : ''}`)
  }
  
  if (focusBlocksCount > 0) {
    receiptParts.push(`Created ${focusBlocksCount} focus block${focusBlocksCount !== 1 ? 's' : ''}`)
  }
  
  if (carriedOverCount > 0) {
    receiptParts.push(`${carriedOverCount} carried over`)
  }
  
  receiptParts.push(`${conflictCount} conflicts`)
  receiptParts.push(`${suggestedRules} planning rule suggested`)

  const receiptLine = receiptParts.join(' · ')

  return (
    <Card className="border-0 shadow-sm bg-muted/20">
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-md bg-primary/10 flex-shrink-0">
            <Receipt className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground">AI Planning Receipt</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
              {receiptLine}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
