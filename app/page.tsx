'use client'

import { useState, useCallback, useMemo } from 'react'
import type { TimeBlock, AppView, SelectedDate } from '@/lib/types'
import { buildCalendarAwareTimeline, sortTasksOptimally, parseTask, mergeWithCalendarEvents, replanCalendarAwareBlocks } from '@/lib/planner'
import { mockGoogleConnection, mockGoogleCalendarEvents, mockTomorrowCalendarEvents } from '@/lib/mock-google'
import { BrainDumpInbox } from '@/components/brain-dump-inbox'
import { TodayTimeline } from '@/components/today-timeline'
import { FocusMode } from '@/components/focus-mode'
import { GoogleConnectionPanel } from '@/components/google-connection-panel'
import { CalendarContext } from '@/components/calendar-context'
import { GoogleSyncPanel } from '@/components/google-sync-panel'
import { DateSelector } from '@/components/date-selector'
import { CarryoverPreview } from '@/components/carryover-preview'
import { WeeklyInsightGarden } from '@/components/weekly-insight-garden'
import { MonthlyMemoryMap } from '@/components/monthly-memory-map'
import { ValuePropositionCard } from '@/components/value-proposition-card'
import { AIPlanningReceipt } from '@/components/ai-planning-receipt'
import { cn } from '@/lib/utils'

export default function Home() {
  const [view, setView] = useState<AppView>('inbox')
  const [blocks, setBlocks] = useState<TimeBlock[]>([])
  const [isPlanning, setIsPlanning] = useState(false)
  const [replanMessage, setReplanMessage] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<SelectedDate>('today')
  
  // Get calendar events based on selected date
  const currentCalendarEvents = useMemo(() => 
    selectedDate === 'today' ? mockGoogleCalendarEvents : mockTomorrowCalendarEvents
  , [selectedDate])
  
  // Get unfinished tasks that could carry over to tomorrow
  const unfinishedTasks = useMemo(() => 
    blocks.filter(b => !b.isCompleted && !b.isProtected && b.source === 'oneblock')
  , [blocks])

  const handlePlanDay = useCallback(async (input: string) => {
    setIsPlanning(true)
    
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    // Parse tasks from brain dump
    const lines = input.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    const parsedTasks = lines.map(parseTask)
    const sortedTasks = sortTasksOptimally(parsedTasks)
    
    // Build calendar-aware timeline (schedules around current day's Google Calendar events)
    const timeline = buildCalendarAwareTimeline(sortedTasks, currentCalendarEvents)
    
    // Merge with Google Calendar events for unified view
    const mergedBlocks = mergeWithCalendarEvents(sortedTasks, timeline, currentCalendarEvents)
    
    // Add date to each block
    const blocksWithDate = mergedBlocks.map(block => ({
      ...block,
      date: selectedDate,
    }))
    
    setBlocks(blocksWithDate)
    setIsPlanning(false)
    setView('timeline')
  }, [currentCalendarEvents, selectedDate])

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

  const handlePlanTomorrowWithCarryover = useCallback(async () => {
    setIsPlanning(true)
    
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    // Get unfinished OneBlock tasks and mark them as carried over
    const tasksToCarry = unfinishedTasks.map(task => ({
      title: task.title,
      durationMinutes: task.duration,
      priority: task.priority,
      energy: task.energy,
      category: task.category || 'work' as const,
      reasoning: task.reasoning || '',
    }))
    
    const sortedTasks = sortTasksOptimally(tasksToCarry)
    
    // Build timeline around tomorrow's calendar
    const timeline = buildCalendarAwareTimeline(sortedTasks, mockTomorrowCalendarEvents)
    
    // Merge with tomorrow's calendar events
    const mergedBlocks = mergeWithCalendarEvents(sortedTasks, timeline, mockTomorrowCalendarEvents)
    
    // Mark blocks as carried over and set date
    const blocksWithCarryover = mergedBlocks.map(block => ({
      ...block,
      date: 'tomorrow' as const,
      ...(block.source === 'oneblock' ? {
        carriedFromDate: 'yesterday' as const,
        rolloverCount: 1,
      } : {})
    }))
    
    setSelectedDate('tomorrow')
    setBlocks(blocksWithCarryover)
    setIsPlanning(false)
    setView('timeline')
  }, [unfinishedTasks])

  const handleReplan = useCallback(() => {
    setBlocks(prev => {
      // Use calendar-aware replan to keep Google Calendar events protected
      const replanned = replanCalendarAwareBlocks(prev, currentCalendarEvents)
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
  }, [currentCalendarEvents])

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
            {/* Before/After value proposition */}
            <ValuePropositionCard />
            
            {/* Date selector */}
            <DateSelector 
              selectedDate={selectedDate} 
              onDateChange={setSelectedDate}
              disabled={isPlanning}
            />
            
            {/* Google Workspace connection */}
            <GoogleConnectionPanel connection={mockGoogleConnection} />
            
            {/* Calendar context */}
            <CalendarContext events={currentCalendarEvents} />
            
            {/* Brain dump inbox */}
            <BrainDumpInbox 
              onPlanDay={handlePlanDay} 
              isPlanning={isPlanning} 
            />
          </div>
        )}

        {view === 'timeline' && (
          <div className="w-full max-w-2xl mx-auto space-y-6">
            {/* AI Planning Receipt */}
            <AIPlanningReceipt blocks={blocks} />
            
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
              selectedDate={selectedDate}
            />
            
            {/* Carryover preview - show when on Today view with unfinished tasks */}
            {selectedDate === 'today' && unfinishedTasks.length > 0 && (
              <CarryoverPreview
                unfinishedTasks={unfinishedTasks}
                onPlanTomorrow={handlePlanTomorrowWithCarryover}
                isPlanning={isPlanning}
              />
            )}
            
            {/* Weekly Insight Garden */}
            <WeeklyInsightGarden />
            
            {/* Monthly Memory Map */}
            <MonthlyMemoryMap />
            
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
