'use client'

import { useState, useCallback } from 'react'
import type { TimeBlock, AppView } from '@/lib/types'
import { planDay, replanRemaining } from '@/lib/mock-planner'
import { BrainDumpInbox } from '@/components/brain-dump-inbox'
import { TodayTimeline } from '@/components/today-timeline'
import { FocusMode } from '@/components/focus-mode'
import { cn } from '@/lib/utils'

export default function Home() {
  const [view, setView] = useState<AppView>('inbox')
  const [blocks, setBlocks] = useState<TimeBlock[]>([])
  const [isPlanning, setIsPlanning] = useState(false)

  const handlePlanDay = useCallback(async (input: string) => {
    setIsPlanning(true)
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 1500))
    const plannedBlocks = planDay(input)
    setBlocks(plannedBlocks)
    setIsPlanning(false)
    setView('timeline')
  }, [])

  const handleToggleComplete = useCallback((id: string) => {
    setBlocks(prev => {
      const updated = prev.map(block => 
        block.id === id ? { ...block, isCompleted: !block.isCompleted } : block
      )
      
      // If the current block is completed, move current to next incomplete
      const justCompleted = updated.find(b => b.id === id)
      if (justCompleted?.isCompleted) {
        const nextIncomplete = updated.find(b => !b.isCompleted)
        return updated.map(block => ({
          ...block,
          isCurrent: block.id === nextIncomplete?.id
        }))
      }
      
      return updated
    })
  }, [])

  const handleReplan = useCallback(() => {
    setBlocks(prev => replanRemaining(prev))
  }, [])

  const handleStartFocus = useCallback(() => {
    setView('focus')
  }, [])

  const handleCompleteCurrent = useCallback(() => {
    const currentBlock = blocks.find(b => b.isCurrent && !b.isCompleted)
    if (currentBlock) {
      handleToggleComplete(currentBlock.id)
    }
    
    // Check if there are more tasks
    const remainingAfter = blocks.filter(b => !b.isCompleted && b.id !== currentBlock?.id)
    if (remainingAfter.length === 0) {
      setView('timeline')
    }
  }, [blocks, handleToggleComplete])

  const handleSkipCurrent = useCallback(() => {
    setBlocks(prev => {
      const currentIndex = prev.findIndex(b => b.isCurrent)
      if (currentIndex === -1) return prev
      
      // Find next incomplete task
      const nextIncomplete = prev.find((b, i) => i > currentIndex && !b.isCompleted)
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
  }, [])

  const currentBlock = blocks.find(b => b.isCurrent && !b.isCompleted)

  return (
    <main className={cn(
      'min-h-screen flex flex-col',
      'px-4 py-8 md:py-12',
      view === 'focus' && 'bg-background/95'
    )}>
      <header className="text-center mb-8">
        <h2 className="text-sm font-medium tracking-widest text-muted-foreground uppercase">
          OneBlock Lite
        </h2>
      </header>

      <div className="flex-1 flex items-start justify-center">
        {view === 'inbox' && (
          <BrainDumpInbox 
            onPlanDay={handlePlanDay} 
            isPlanning={isPlanning} 
          />
        )}

        {view === 'timeline' && (
          <TodayTimeline
            blocks={blocks}
            onToggleComplete={handleToggleComplete}
            onReplan={handleReplan}
            onStartFocus={handleStartFocus}
            onBack={handleBackToInbox}
          />
        )}

        {view === 'focus' && currentBlock && (
          <FocusMode
            block={currentBlock}
            onComplete={handleCompleteCurrent}
            onSkip={handleSkipCurrent}
            onReplan={handleReplan}
            onExit={handleExitFocus}
          />
        )}
      </div>

      <footer className="text-center mt-8">
        <p className="text-xs text-muted-foreground">
          Take it one block at a time.
        </p>
      </footer>
    </main>
  )
}
