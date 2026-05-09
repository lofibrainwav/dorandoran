'use client'

import { useState, useCallback } from 'react'
import type { TimeBlock, AppView } from '@/lib/types'
import { buildCalendarAwareTimeline, sortTasksOptimally, parseTask, mergeWithCalendarEvents, replanCalendarAwareBlocks } from '@/lib/planner'
import { mockGoogleConnection, mockGoogleCalendarEvents } from '@/lib/mock-google'
import { BrainDumpInbox } from '@/components/brain-dump-inbox'
import { TodayTimeline } from '@/components/today-timeline'
import { FocusMode } from '@/components/focus-mode'
import { GoogleConnectionPanel } from '@/components/google-connection-panel'
import { CalendarContext } from '@/components/calendar-context'
import { GoogleSyncPanel } from '@/components/google-sync-panel'
import { cn } from '@/lib/utils'

export default function Home() {
  const [view, setView] = useState<AppView>('inbox')
  const [blocks, setBlocks] = useState<TimeBlock[]>([])
  const [isPlanning, setIsPlanning] = useState(false)
  const [replanMessage, setReplanMessage] = useState<string | null>(null)

  const handlePlanDay = useCallback(async (input: string) => {
    setIsPlanning(true)
    
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    // Parse tasks from brain dump
    const lines = input.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    const parsedTasks = lines.map(parseTask)
    const sortedTasks = sortTasksOptimally(parsedTasks)
    
    // Build calendar-aware timeline (schedules around Google Calendar events)
    const timeline = buildCalendarAwareTimeline(sortedTasks, mockGoogleCalendarEvents)
    
    // Merge with Google Calendar events for unified view
    const mergedBlocks = mergeWithCalendarEvents(sortedTasks, timeline, mockGoogleCalendarEvents)
    
    setBlocks(mergedBlocks)
    setIsPlanning(false)
    setView('timeline')
  }, [])

  const handleToggleComplete = useCallback((id: string) => {
    setBlocks(prev => {
      // Don't allow toggling protected events
      const block = prev.find(b => b.id === id)
      if (block?.isProtected) return prev
      
      const updated = prev.map(block => 
        block.id === id ? { ...block, isCompleted: !block.isCompleted } : block
      )
      
      // If the current block is completed, move current to next incomplete non-protected
      const justCompleted = updated.find(b => b.id === id)
      if (justCompleted?.isCompleted) {
        const nextIncomplete = updated.find(b => !b.isCompleted && !b.isProtected)
        return updated.map(block => ({
          ...block,
          isCurrent: block.id === nextIncomplete?.id
        }))
      }
      
      return updated
    })
  }, [])

  const handleReplan = useCallback(() => {
    setBlocks(prev => {
      // Use calendar-aware replan to keep Google Calendar events protected
      const replanned = replanCalendarAwareBlocks(prev, mockGoogleCalendarEvents)
      return replanned
    })
    
    // Return to timeline so user can see the updated schedule
    setView('timeline')
    
    // Show replan confirmation message
    setReplanMessage('Your remaining focus blocks were gently rescheduled around your calendar.')
    
    // Clear message after 4 seconds
    setTimeout(() => {
      setReplanMessage(null)
    }, 4000)
  }, [])

  const handleStartFocus = useCallback(() => {
    setView('focus')
  }, [])

  const handleCompleteCurrent = useCallback(() => {
    const currentBlock = blocks.find(b => b.isCurrent && !b.isCompleted && !b.isProtected)
    if (currentBlock) {
      handleToggleComplete(currentBlock.id)
    }
    
    // Check if there are more non-protected tasks
    const remainingAfter = blocks.filter(b => !b.isCompleted && b.id !== currentBlock?.id && !b.isProtected)
    if (remainingAfter.length === 0) {
      setView('timeline')
    }
  }, [blocks, handleToggleComplete])

  const handleSkipCurrent = useCallback(() => {
    setBlocks(prev => {
      const currentIndex = prev.findIndex(b => b.isCurrent)
      if (currentIndex === -1) return prev
      
      // Find next incomplete non-protected task
      const nextIncomplete = prev.find((b, i) => i > currentIndex && !b.isCompleted && !b.isProtected)
      if (!nextIncomplete) {
        // No more tasks, go back to timeline
        setView('timeline')
        return prev
      }
      
      return prev.map(block => ({
        ...block,
        isCurrent: block.id === nextIncomplete.id
      }))
    })
  }, [])

  const handleExitFocus = useCallback(() => {
    setView('timeline')
  }, [])

  const handleBackToInbox = useCallback(() => {
    setView('inbox')
    setBlocks([])
  }, [])

  const currentBlock = blocks.find(b => b.isCurrent && !b.isCompleted && !b.isProtected)
  const remainingCount = blocks.filter(b => !b.isCompleted && !b.isProtected).length

  return (
    <main className={cn(
      'min-h-screen flex flex-col',
      'px-4 py-6 md:py-10',
      // Subtle gradient background
      view === 'inbox' && 'bg-gradient-to-b from-background via-background to-muted/30',
      view === 'timeline' && 'bg-gradient-to-b from-background to-primary/5',
      view === 'focus' && 'bg-gradient-to-b from-background via-card/50 to-background'
    )}>
      {/* Logo */}
      <header className="text-center mb-6">
        <h2 className="text-sm font-semibold tracking-[0.2em] text-primary/80 uppercase">
          OneBlock
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {view === 'inbox' && 'for Google Workspace'}
          {view === 'timeline' && 'Your organized day'}
          {view === 'focus' && 'Deep focus mode'}
        </p>
      </header>

      {/* Main content */}
      <div className="flex-1 flex items-start justify-center">
        {view === 'inbox' && (
          <div className="w-full max-w-2xl mx-auto space-y-6">
            {/* Google Workspace connection */}
            <GoogleConnectionPanel connection={mockGoogleConnection} />
            
            {/* Calendar context */}
            <CalendarContext events={mockGoogleCalendarEvents} />
            
            {/* Brain dump inbox */}
            <BrainDumpInbox 
              onPlanDay={handlePlanDay} 
              isPlanning={isPlanning} 
            />
          </div>
        )}

        {view === 'timeline' && (
          <div className="w-full max-w-2xl mx-auto space-y-6">
            {/* Replan confirmation message */}
            {replanMessage && (
              <div className="animate-fade-in bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 text-center">
                <p className="text-sm text-primary font-medium">{replanMessage}</p>
                <p className="text-xs text-primary/70 mt-1">Your existing calendar is protected.</p>
              </div>
            )}
            
            <TodayTimeline
              blocks={blocks}
              onToggleComplete={handleToggleComplete}
              onReplan={handleReplan}
              onStartFocus={handleStartFocus}
              onBack={handleBackToInbox}
            />
            
            {/* Google Sync Panel */}
            <GoogleSyncPanel blocks={blocks} />
          </div>
        )}

        {view === 'focus' && currentBlock && (
          <FocusMode
            block={currentBlock}
            totalRemaining={remainingCount}
            onComplete={handleCompleteCurrent}
            onSkip={handleSkipCurrent}
            onReplan={handleReplan}
            onExit={handleExitFocus}
          />
        )}
      </div>

      {/* Footer */}
      {view !== 'focus' && (
        <footer className="text-center mt-8 space-y-1">
          <p className="text-xs text-muted-foreground">
            {view === 'inbox' 
              ? 'Plans change. We\'ll gently adjust.' 
              : 'Take it one block at a time.'}
          </p>
          <p className="text-[10px] text-muted-foreground/50">
            {view === 'inbox' 
              ? 'Your existing calendar is protected.' 
              : 'Sync your focus blocks when the plan feels right.'}
          </p>
        </footer>
      )}
    </main>
  )
}
