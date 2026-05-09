export type EnergyLevel = 'high' | 'medium' | 'low'
export type Priority = 'high' | 'medium' | 'low'
export type TaskCategory = 'work' | 'personal' | 'health' | 'communication' | 'admin' | 'creative' | 'errands'
export type BlockSource = 'oneblock' | 'google_calendar' | 'buffer'

export interface PlannedTask {
  title: string
  durationMinutes: number
  priority: Priority
  energy: EnergyLevel
  category: TaskCategory
  reasoning: string
}

export interface TimeBlock {
  id: string
  title: string
  startTime: string
  endTime: string
  duration: number // in minutes
  priority: Priority
  energy: EnergyLevel
  category?: TaskCategory
  reasoning?: string
  bufferAfter: number // in minutes
  isCompleted: boolean
  isCurrent: boolean
  source?: BlockSource
  isProtected?: boolean
}

// Google Calendar event type
export interface GoogleCalendarEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  duration: number
  isProtected: boolean
}

// Google Workspace connection status
export interface GoogleWorkspaceConnection {
  calendar: boolean
  docs: boolean
  sheets: boolean
  drive: boolean
}

export interface TimelineSlot {
  startTime: string
  endTime: string
  taskIndex: number
  bufferAfter: number
}

export interface PlanResponse {
  tasks: PlannedTask[]
  topThree: number[] // indices of top 3 tasks
  timeline: TimelineSlot[]
}

export type AppView = 'inbox' | 'timeline' | 'focus'
