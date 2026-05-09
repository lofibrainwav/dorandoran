import type { TimeBlock, EnergyLevel, Priority } from './types'

function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

function parseTaskFromText(text: string): { title: string; duration: number; priority: Priority; energy: EnergyLevel } {
  const lines = text.toLowerCase()
  
  // Determine priority based on keywords
  let priority: Priority = 'medium'
  if (lines.includes('urgent') || lines.includes('important') || lines.includes('asap') || lines.includes('deadline')) {
    priority = 'high'
  } else if (lines.includes('later') || lines.includes('optional') || lines.includes('maybe')) {
    priority = 'low'
  }

  // Determine energy level based on task type
  let energy: EnergyLevel = 'medium'
  if (lines.includes('meeting') || lines.includes('presentation') || lines.includes('call') || lines.includes('creative') || lines.includes('write') || lines.includes('design')) {
    energy = 'high'
  } else if (lines.includes('email') || lines.includes('organize') || lines.includes('clean') || lines.includes('review')) {
    energy = 'low'
  }

  // Estimate duration
  let duration = 30
  if (lines.includes('quick') || lines.includes('5 min') || lines.includes('brief')) {
    duration = 15
  } else if (lines.includes('meeting') || lines.includes('call')) {
    duration = 45
  } else if (lines.includes('deep') || lines.includes('project') || lines.includes('write') || lines.includes('create')) {
    duration = 60
  }

  return { title: text.trim(), duration, priority, energy }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function planDay(rawInput: string): TimeBlock[] {
  const lines = rawInput.split('\n').filter(line => line.trim().length > 0)
  
  if (lines.length === 0) return []

  const parsedTasks = lines.map(line => parseTaskFromText(line))
  
  // Sort by priority and energy for optimal scheduling
  // High priority first, then by energy (high energy tasks in morning)
  parsedTasks.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    }
    const energyOrder = { high: 0, medium: 1, low: 2 }
    return energyOrder[a.energy] - energyOrder[b.energy]
  })

  // Start at 9 AM
  let currentTime = new Date()
  currentTime.setHours(9, 0, 0, 0)

  const blocks: TimeBlock[] = parsedTasks.map((task, index) => {
    const startTime = formatTime(currentTime)
    
    // Add task duration
    currentTime = new Date(currentTime.getTime() + task.duration * 60000)
    const endTime = formatTime(currentTime)
    
    // Add buffer time based on energy level
    const bufferAfter = task.energy === 'high' ? 15 : task.energy === 'medium' ? 10 : 5
    currentTime = new Date(currentTime.getTime() + bufferAfter * 60000)

    return {
      id: generateId(),
      title: task.title,
      startTime,
      endTime,
      duration: task.duration,
      priority: task.priority,
      energy: task.energy,
      bufferAfter,
      isCompleted: false,
      isCurrent: index === 0,
    }
  })

  return blocks
}

export function replanRemaining(blocks: TimeBlock[]): TimeBlock[] {
  const remaining = blocks.filter(b => !b.isCompleted)
  
  if (remaining.length === 0) return []

  // Start from now
  let currentTime = new Date()
  // Round up to nearest 5 minutes
  const minutes = currentTime.getMinutes()
  const roundedMinutes = Math.ceil(minutes / 5) * 5
  currentTime.setMinutes(roundedMinutes, 0, 0)

  return remaining.map((block, index) => {
    const startTime = formatTime(currentTime)
    currentTime = new Date(currentTime.getTime() + block.duration * 60000)
    const endTime = formatTime(currentTime)
    currentTime = new Date(currentTime.getTime() + block.bufferAfter * 60000)

    return {
      ...block,
      startTime,
      endTime,
      isCurrent: index === 0,
    }
  })
}

export const sampleBrainDump = `Finish the quarterly report - deadline today
Call mom back
Reply to Sarah's email about the project
Quick grocery run for dinner ingredients
Review pull request from team
Deep work: write blog post outline
Team standup meeting at 11
Organize desktop files - optional`
