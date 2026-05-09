'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Lightbulb, TrendingUp, RotateCcw, CheckCircle2 } from 'lucide-react'

interface InsightCard {
  id: string
  title: string
  insight: string
  evidence: string
  tags: string[]
  suggestedRule: string
  icon: typeof Lightbulb
}

const mockInsights: InsightCard[] = [
  {
    id: 'insight-1',
    title: 'Admin tasks need a protected window',
    insight: 'Communication and admin work were delayed when placed after deep work.',
    evidence: 'Email and paperwork tasks moved 3 times this week.',
    tags: ['admin', 'carryover', 'energy'],
    suggestedRule: 'Batch admin tasks into a 25-minute block after lunch.',
    icon: Lightbulb,
  },
  {
    id: 'insight-2',
    title: 'Creative work needs morning space',
    insight: 'High-energy creative tasks were completed more often before calendar-heavy afternoons.',
    evidence: '2 deep work blocks finished before noon.',
    tags: ['creative', 'deepwork', 'morning'],
    suggestedRule: 'Protect one creative block before meetings.',
    icon: TrendingUp,
  },
  {
    id: 'insight-3',
    title: 'Carryover is a signal, not a failure',
    insight: 'Tasks that roll over twice may need smaller blocks or clearer next actions.',
    evidence: 'Two tasks carried forward more than once.',
    tags: ['carryover', 'friction', 'planning'],
    suggestedRule: 'Break repeated carryover tasks into 15-minute starter blocks.',
    icon: RotateCcw,
  },
]

export function WeeklyInsightGarden() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center space-y-1">
        <h3 className="text-sm font-medium text-foreground">Weekly Insight Garden</h3>
        <p className="text-xs text-muted-foreground">
          Daily blocks become weekly insight. Weekly insight becomes better planning.
        </p>
      </div>

      {/* Insight Cards */}
      <div className="grid gap-3">
        {mockInsights.map((item) => {
          const IconComponent = item.icon
          return (
            <Card 
              key={item.id} 
              className="border-0 shadow-sm bg-card/50 hover:bg-card/80 transition-colors"
            >
              <CardContent className="p-4 space-y-3">
                {/* Title with icon */}
                <div className="flex items-start gap-2">
                  <div className="p-1.5 rounded-md bg-primary/10 flex-shrink-0">
                    <IconComponent className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <h4 className="text-sm font-medium text-foreground leading-tight">
                    {item.title}
                  </h4>
                </div>

                {/* Insight */}
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {item.insight}
                </p>

                {/* Evidence */}
                <div className="text-xs text-muted-foreground/80 italic">
                  Evidence: {item.evidence}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5">
                  {item.tags.map((tag) => (
                    <Badge 
                      key={tag} 
                      variant="secondary" 
                      className="text-[10px] px-1.5 py-0 h-4 bg-muted/50"
                    >
                      #{tag}
                    </Badge>
                  ))}
                </div>

                {/* Suggested Rule */}
                <div className="pt-2 border-t border-border/50">
                  <p className="text-xs text-primary/80">
                    <span className="font-medium">Suggested rule:</span> {item.suggestedRule}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Applied to Next Plan section */}
      <Card className="border-0 shadow-sm bg-emerald-50/50 dark:bg-emerald-950/20">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Applied to next plan
            </h4>
          </div>
          <ul className="space-y-2 text-xs text-emerald-700/80 dark:text-emerald-300/80">
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">•</span>
              <span>Admin work will be batched after lunch.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">•</span>
              <span>Creative work will be protected before meetings.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">•</span>
              <span>Repeated carryover will be split into starter blocks.</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
