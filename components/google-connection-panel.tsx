'use client'

import type { GoogleWorkspaceConnection } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Calendar, FileText, Table2, FolderOpen, Check, Cloud } from 'lucide-react'

interface GoogleConnectionPanelProps {
  connection: GoogleWorkspaceConnection
}

const services = [
  { 
    key: 'calendar' as const, 
    label: 'Calendar', 
    icon: Calendar,
    description: 'Syncs your schedule'
  },
  { 
    key: 'docs' as const, 
    label: 'Docs', 
    icon: FileText,
    description: 'Creates daily plans'
  },
  { 
    key: 'sheets' as const, 
    label: 'Sheets', 
    icon: Table2,
    description: 'Tracks progress'
  },
  { 
    key: 'drive' as const, 
    label: 'Drive', 
    icon: FolderOpen,
    description: 'Stores backups'
  },
]

export function GoogleConnectionPanel({ connection }: GoogleConnectionPanelProps) {
  const allConnected = Object.values(connection).every(Boolean)
  const connectedCount = Object.values(connection).filter(Boolean).length

  return (
    <Card className="border-0 shadow-md bg-card/80 backdrop-blur-sm">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
              <Cloud className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-sm">Google Workspace</h3>
              <p className="text-xs text-muted-foreground">
                {allConnected ? 'All services connected' : `${connectedCount}/4 connected`}
              </p>
            </div>
          </div>
          {allConnected && (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <Check className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
        </div>

        {/* Service grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {services.map((service) => {
            const isConnected = connection[service.key]
            const Icon = service.icon
            
            return (
              <div
                key={service.key}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-lg transition-colors',
                  isConnected 
                    ? 'bg-primary/5 border border-primary/20' 
                    : 'bg-muted/50 border border-transparent opacity-50'
                )}
              >
                <div className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full',
                  isConnected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-xs font-medium">{service.label}</span>
                {isConnected && (
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">
                    {service.description}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Calm messaging */}
        <p className="text-xs text-muted-foreground text-center">
          Your existing calendar is protected. OneBlock only schedules into open space.
        </p>
      </CardContent>
    </Card>
  )
}
