'use client'

import { Palette, Users, FileWarning, Heart } from 'lucide-react'

interface ThemeChip {
  id: string
  label: string
  icon: typeof Palette
  color: string
}

const mockThemes: ThemeChip[] = [
  {
    id: 'theme-1',
    label: 'Creative Work',
    icon: Palette,
    color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  },
  {
    id: 'theme-2',
    label: 'Family Logistics',
    icon: Users,
    color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  },
  {
    id: 'theme-3',
    label: 'Admin Friction',
    icon: FileWarning,
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  {
    id: 'theme-4',
    label: 'Health Consistency',
    icon: Heart,
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
]

export function MonthlyMemoryMap() {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="text-center">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Monthly Themes
        </h4>
      </div>

      {/* Theme chips */}
      <div className="flex flex-wrap justify-center gap-2">
        {mockThemes.map((theme) => {
          const IconComponent = theme.icon
          return (
            <div
              key={theme.id}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${theme.color}`}
            >
              <IconComponent className="h-3 w-3" />
              <span>{theme.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
