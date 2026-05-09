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

// More realistic, messy brain dump for demo purposes
export const demoBrainDump = `ugh that quarterly report is due TODAY
call mom back, been putting this off for days
sarah's email about the redesign project - urgent
need groceries... milk eggs bread maybe some snacks
that PR from jake has been sitting there forever
deep work: finally write that blog post I've been avoiding
team standup at 11 don't be late this time
clean up desktop files maybe? low priority
dentist appointment - need to reschedule
reply to slack messages piling up
prepare slides for thursday presentation
quick workout if there's time`

export interface DayEnergy {
  total: number
  used: number
  breakdown: {
    high: number
    medium: number
    low: number
  }
}

export function calculateDayEnergy(blocks: TimeBlock[]): DayEnergy {
  // Calculate total energy points (weighted by energy level)
  const total = blocks.reduce((sum, b) => {
    const energyValue = b.energy === 'high' ? 3 : b.energy === 'medium' ? 2 : 1
    return sum + energyValue * (b.duration / 30)
  }, 0)
  
  // Calculate used energy (from completed tasks)
  const used = blocks
    .filter(b => b.isCompleted)
    .reduce((sum, b) => {
      const energyValue = b.energy === 'high' ? 3 : b.energy === 'medium' ? 2 : 1
      return sum + energyValue * (b.duration / 30)
    }, 0)
  
  // Calculate breakdown by energy level (in minutes)
  const high = blocks.filter(b => b.energy === 'high').reduce((sum, b) => sum + b.duration, 0)
  const medium = blocks.filter(b => b.energy === 'medium').reduce((sum, b) => sum + b.duration, 0)
  const low = blocks.filter(b => b.energy === 'low').reduce((sum, b) => sum + b.duration, 0)
  
  return {
    total: Math.round(total),
    used: Math.round(used),
    breakdown: { high, medium, low },
  }
}

export function getTopThree(blocks: TimeBlock[]): TimeBlock[] {
  const incomplete = blocks.filter(b => !b.isCompleted)
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  
  return [...incomplete]
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, 3)
}

const encouragementsStart = [
  "Fresh start. You've got this.",
  "Ready to conquer the day.",
  "One thing at a time.",
]

const encouragementsMid = [
  "You're making progress. Keep going.",
  "Nice work! Stay focused.",
  "You're doing great. One block at a time.",
  "Progress, not perfection.",
]

const encouragementsNearEnd = [
  "Almost there! You can do this.",
  "The finish line is in sight.",
  "Just a few more to go.",
]

const encouragementsDone = [
  "You did it! Time to rest.",
  "All done. Well deserved break!",
  "Mission accomplished.",
]

export function getEncouragement(completed: number, total: number): string {
  if (total === 0) return "Let's plan your day."
  
  const progress = completed / total
  
  if (progress === 0) {
    return encouragementsStart[Math.floor(Math.random() * encouragementsStart.length)]
  } else if (progress >= 1) {
    return encouragementsDone[Math.floor(Math.random() * encouragementsDone.length)]
  } else if (progress >= 0.7) {
    return encouragementsNearEnd[Math.floor(Math.random() * encouragementsNearEnd.length)]
  } else {
    return encouragementsMid[Math.floor(Math.random() * encouragementsMid.length)]
  }
}
