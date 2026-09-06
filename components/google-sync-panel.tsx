'use client'

import { useState } from 'react'
import type { TimeBlock } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  syncToGoogleCalendar, 
  createGoogleDoc, 
  appendToGoogleSheet 
} from '@/lib/mock-google'
import { cn } from '@/lib/utils'
import { 
  Calendar, 
  FileText, 
  Table2, 
  Check, 
  Loader2, 
  Sparkles,
  Cloud
} from 'lucide-react'

interface GoogleSyncPanelProps {
  blocks: TimeBlock[]
}

type SyncAction = 'calendar' | 'docs' | 'sheets'

interface SyncState {
  loading: SyncAction | null
  completed: SyncAction[]
  messages: Record<SyncAction, string>
}

const syncActions = [
  {
    key: 'calendar' as const,
    label: 'Sync to Calendar',
    description: 'Add focus blocks to Google Calendar',
    successReceipt: 'Focus blocks added',
    icon: Calendar,
    color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  },
  {
    key: 'docs' as const,
    label: 'Create Doc Plan',
    description: 'Generate a Google Doc with your plan',
    successReceipt: 'Daily plan created',
    icon: FileText,
    color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  },
  {
    key: 'sheets' as const,
    label: 'Log to Sheets',
    description: 'Track completed tasks in a spreadsheet',
    successReceipt: 'Task log updated',
    icon: Table2,
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
]

export function GoogleSyncPanel({ blocks }: GoogleSyncPanelProps) {
  const [state, setState] = useState<SyncState>({
    loading: null,
    completed: [],
    messages: { calendar: '', docs: '', sheets: '' },
  })

  const handleSync = async (action: SyncAction) => {
    setState(prev => ({ ...prev, loading: action }))
    
    let result: { success: boolean; message: string }
    
    switch (action) {
      case 'calendar':
        result = await syncToGoogleCalendar(blocks)
        break
      case 'docs':
        result = await createGoogleDoc(blocks)
        break
      case 'sheets':
        result = await appendToGoogleSheet(blocks)
        break
    }
    
    setState(prev => ({
      loading: null,
      completed: [...prev.completed, action],
      messages: { ...prev.messages, [action]: result.message },
    }))
  }

  const allSynced = state.completed.length === 3
  const focusBlockCount = blocks.filter(b => b.source !== 'google_calendar').length

  return (
    <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
              <Cloud className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-sm">Sync to Google Workspace</h3>
              <p className="text-xs text-muted-foreground">
                {focusBlockCount} focus {focusBlockCount === 1 ? 'block' : 'blocks'} ready to sync
              </p>
            </div>
          </div>
          {allSynced && (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <Sparkles className="h-3 w-3 mr-1" />
              All synced
            </Badge>
          )}
        </div>

        {/* Sync actions */}
        <div className="space-y-2">
          {syncActions.map((action) => {
            const isLoading = state.loading === action.key
            const isCompleted = state.completed.includes(action.key)
            const Icon = action.icon
            
            return (
              <div
                key={action.key}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg transition-all',
                  isCompleted 
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30'
                    : 'bg-muted/30 border border-transparent hover:bg-muted/50'
                )}
              >
                <div className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0',
                  isCompleted ? 'bg-emerald-100 dark:bg-emerald-900/40' : action.color
                )}>
                  {isCompleted ? (
                    <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">
                    {isCompleted ? action.successReceipt : action.label}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {isCompleted ? 'Synced successfully' : action.description}
                  </p>
                </div>
                
                {!isCompleted && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleSync(action.key)}
                    disabled={state.loading !== null}
                    className="flex-shrink-0"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Sync'
                    )}
                  </Button>
                )}
              </div>
            )
          })}
        </div>

        {/* Calm messaging */}
        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          Sync your focus blocks when the plan feels right. 
          You can always adjust later.
        </p>
      </CardContent>
    </Card>
  )
}
