'use client'

import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles, Shuffle, ArrowRight } from 'lucide-react'
import { demoBrainDump } from '@/lib/mock-planner'
import { cn } from '@/lib/utils'

interface BrainDumpInboxProps {
  onPlanDay: (input: string) => void
  isPlanning: boolean
}

const placeholderExamples = [
  "finish that report... ugh",
  "call mom back",
  "buy groceries", 
  "reply to emails",
  "workout maybe?",
]

export function BrainDumpInbox({ onPlanDay, isPlanning }: BrainDumpInboxProps) {
  const [input, setInput] = useState('')
  const [typingDemo, setTypingDemo] = useState(false)

  const handleSubmit = () => {
    if (input.trim()) {
      onPlanDay(input)
    }
  }

  const loadDemo = () => {
    setTypingDemo(true)
    setInput('')
    
    let index = 0
    const typeInterval = setInterval(() => {
      if (index < demoBrainDump.length) {
        setInput(demoBrainDump.slice(0, index + 1))
        index++
      } else {
        clearInterval(typeInterval)
        setTypingDemo(false)
      }
    }, 15) // Fast typing effect
  }

  const hasInput = input.trim().length > 0
  const lineCount = input.split('\n').filter(l => l.trim()).length

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      {/* Hero section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm">
          <Sparkles className="h-3.5 w-3.5" />
          <span>AI-powered timeboxing</span>
        </div>
        
        <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-balance leading-tight">
          What&apos;s weighing on <br className="hidden sm:block" />
          <span className="text-primary">your mind</span> today?
        </h1>
        
        <p className="text-muted-foreground text-lg max-w-md mx-auto text-balance">
          Dump everything here. No judgment, no pressure. 
          I&apos;ll help organize the chaos into a calm plan.
        </p>
      </div>

      {/* Input card */}
      <Card className={cn(
        'shadow-xl border-0 bg-card/80 backdrop-blur-sm transition-all duration-300',
        hasInput && 'ring-2 ring-primary/20'
      )}>
        <CardContent className="p-6 space-y-4">
          <div className="relative">
            <Textarea
              placeholder={`One task per line. Be messy, be real...

${placeholderExamples.join('\n')}`}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
              }}
              className={cn(
                'min-h-[220px] resize-none text-base leading-relaxed',
                'bg-background/50 border-muted focus:border-primary/30',
                'placeholder:text-muted-foreground/50',
                typingDemo && 'animate-pulse'
              )}
              autoFocus
            />
            
            {/* Line counter */}
            {hasInput && (
              <div className="absolute bottom-3 right-3 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded-md">
                {lineCount} {lineCount === 1 ? 'task' : 'tasks'}
              </div>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleSubmit}
              disabled={!hasInput || isPlanning}
              className={cn(
                'flex-1 h-14 text-base font-medium gap-2 transition-all',
                hasInput && !isPlanning && 'shadow-lg shadow-primary/25'
              )}
              size="lg"
            >
              {isPlanning ? (
                <>
                  <div className="relative">
                    <Sparkles className="h-5 w-5 animate-spin" />
                  </div>
                  Organizing your thoughts...
                </>
              ) : (
                <>
                  Plan My Day
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={loadDemo}
              className="h-14 gap-2"
              disabled={isPlanning || typingDemo}
            >
              <Shuffle className="h-4 w-4" />
              Demo Brain Dump
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Trust message */}
      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          Your tasks stay private. No account needed.
        </p>
        <p className="text-xs text-muted-foreground/70">
          Built with care for overwhelmed humans.
        </p>
      </div>
    </div>
  )
}
