export type EnergyLevel = 'high' | 'medium' | 'low'
export type Priority = 'high' | 'medium' | 'low'

export interface TimeBlock {
  id: string
  title: string
  startTime: string
  endTime: string
  duration: number // in minutes
  priority: Priority
  energy: EnergyLevel
  bufferAfter: number // in minutes
  isCompleted: boolean
  isCurrent: boolean
}

export type AppView = 'inbox' | 'timeline' | 'focus'
