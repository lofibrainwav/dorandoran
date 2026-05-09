'use client'

import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Sparkles, Lightbulb } from 'lucide-react'
import { sampleBrainDump } from '@/lib/mock-planner'

interface BrainDumpInboxProps {
  onPlanDay: (input: string) => void
  isPlanning: boolean
}

export function BrainDumpInbox({ onPlanDay, isPlanning }: BrainDumpInboxProps) {
  const [input, setInput] = useState('')

  const handleSubmit = () => {
    if (input.trim()) {
      onPlanDay(input)
    }
  }

  const loadSample = () => {
    setInput(sampleBrainDump)
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">
          What&apos;s on your mind today?
        </h1>
        <p className="text-muted-foreground text-lg">
          Dump everything here. I&apos;ll help you make sense of it.
        </p>
      </div>

      <Card className="shadow-lg border-0 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Brain Dump
          </CardTitle>
          <CardDescription>
            One task per line. Don&apos;t worry about order or details yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Call dentist for appointment
Finish project proposal
Buy groceries for dinner
Reply to Alex's email
30 min workout..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[200px] resize-none text-base leading-relaxed bg-background/50 border-muted"
            autoFocus
          />
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleSubmit}
              disabled={!input.trim() || isPlanning}
              className="flex-1 h-12 text-base font-medium"
              size="lg"
            >
              {isPlanning ? (
                <>
                  <Sparkles className="mr-2 h-5 w-5 animate-pulse" />
                  Planning your day...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Plan My Day
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={loadSample}
              className="h-12"
              disabled={isPlanning}
            >
              Try Sample
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        Your tasks stay private. No judgment, just help.
      </p>
    </div>
  )
}
