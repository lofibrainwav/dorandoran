import type { PlannedTask, TimelineSlot, PlanResponse, Priority, EnergyLevel, TaskCategory, GoogleCalendarEvent, TimeBlock } from './types'
import { getBusySlots, findNextAvailableSlot, formatMinutesToTime, parseTimeToMinutes } from './mock-google'

// Keywords for classification
const CATEGORY_KEYWORDS: Record<TaskCategory, string[]> = {
  work: ['report', 'presentation', 'meeting', 'project', 'deadline', 'client', 'pr', 'review', 'slides', 'standup'],
  personal: ['mom', 'dad', 'family', 'friend', 'call back', 'birthday'],
  health: ['workout', 'gym', 'doctor', 'dentist', 'exercise', 'walk', 'meditation', 'yoga'],
  communication: ['email', 'slack', 'reply', 'respond', 'message', 'call'],
  admin: ['organize', 'clean', 'files', 'schedule', 'reschedule', 'appointment'],
  creative: ['write', 'blog', 'design', 'create', 'brainstorm', 'draft'],
  errands: ['grocery', 'shopping', 'pick up', 'drop off', 'errands', 'store'],
}

const PRIORITY_KEYWORDS = {
  high: ['urgent', 'important', 'asap', 'deadline', 'today', 'due', 'critical'],
  low: ['later', 'optional', 'maybe', 'if time', 'low priority', 'eventually'],
}

const ENERGY_KEYWORDS = {
  high: ['deep work', 'creative', 'write', 'design', 'presentation', 'important meeting', 'brainstorm'],
  low: ['email', 'organize', 'clean', 'admin', 'file', 'schedule', 'routine'],
}

const DURATION_KEYWORDS = {
  short: ['quick', 'brief', '5 min', '10 min', 'fast'],
  long: ['deep', 'project', 'write', 'create', 'presentation', 'meeting'],
}

function detectCategory(text: string): TaskCategory {
  const lower = text.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return category as TaskCategory
    }
  }
  return 'work' // default
}

function detectPriority(text: string): Priority {
  const lower = text.toLowerCase()
  if (PRIORITY_KEYWORDS.high.some(kw => lower.includes(kw))) return 'high'
  if (PRIORITY_KEYWORDS.low.some(kw => lower.includes(kw))) return 'low'
  return 'medium'
}

function detectEnergy(text: string): EnergyLevel {
  const lower = text.toLowerCase()
  if (ENERGY_KEYWORDS.high.some(kw => lower.includes(kw))) return 'high'
  if (ENERGY_KEYWORDS.low.some(kw => lower.includes(kw))) return 'low'
  return 'medium'
}

function estimateDuration(text: string): number {
  const lower = text.toLowerCase()
  
  // Check for explicit time mentions
  const timeMatch = lower.match(/(\d+)\s*(min|minute|hour|hr)/i)
  if (timeMatch) {
    const num = parseInt(timeMatch[1])
    const unit = timeMatch[2].toLowerCase()
    if (unit.startsWith('hour') || unit === 'hr') return num * 60
    return num
  }
  
  if (DURATION_KEYWORDS.short.some(kw => lower.includes(kw))) return 15
  if (DURATION_KEYWORDS.long.some(kw => lower.includes(kw))) return 60
  if (lower.includes('meeting') || lower.includes('call')) return 30
  
  return 25 // default pomodoro-ish
}

function generateReasoning(task: PlannedTask): string {
  const reasons: string[] = []
  
  if (task.priority === 'high') {
    reasons.push('Marked as high priority due to urgency keywords')
  }
  if (task.energy === 'high') {
    reasons.push('requires focused attention')
  }
  if (task.category === 'communication') {
    reasons.push('quick communication task')
  }
  if (task.durationMinutes <= 15) {
    reasons.push('short task, good for momentum')
  }
  if (task.durationMinutes >= 60) {
    reasons.push('deep work block scheduled')
  }
  
  return reasons.length > 0 
    ? reasons.join('; ') 
    : 'Standard task with moderate complexity'
}

export function parseTask(rawText: string): PlannedTask {
  const title = rawText.trim()
    .replace(/^[-*•]\s*/, '') // remove bullet points
    .replace(/^\d+\.\s*/, '') // remove numbering
    .trim()
  
  const category = detectCategory(title)
  const priority = detectPriority(title)
  const energy = detectEnergy(title)
  const durationMinutes = estimateDuration(title)
  
  const task: PlannedTask = {
    title,
    durationMinutes,
    priority,
    energy,
    category,
    reasoning: '',
  }
  
  task.reasoning = generateReasoning(task)
  
  return task
}

export function sortTasksOptimally(tasks: PlannedTask[]): PlannedTask[] {
  return [...tasks].sort((a, b) => {
    // Priority first
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    }
    
    // Then by energy (high energy early in day)
    const energyOrder = { high: 0, medium: 1, low: 2 }
    return energyOrder[a.energy] - energyOrder[b.energy]
  })
}

export function getTopThreeIndices(tasks: PlannedTask[]): number[] {
  const indexed = tasks.map((task, index) => ({ task, index }))
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  
  indexed.sort((a, b) => {
    if (priorityOrder[a.task.priority] !== priorityOrder[b.task.priority]) {
      return priorityOrder[a.task.priority] - priorityOrder[b.task.priority]
    }
    // Secondary sort by energy (high energy = more important)
    const energyOrder = { high: 0, medium: 1, low: 2 }
    return energyOrder[a.task.energy] - energyOrder[b.task.energy]
  })
  
  return indexed.slice(0, 3).map(item => item.index)
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  })
}

function getBufferMinutes(energy: EnergyLevel): number {
  switch (energy) {
    case 'high': return 15
    case 'medium': return 10
    case 'low': return 5
  }
}

export function buildTimeline(tasks: PlannedTask[], startHour = 9): TimelineSlot[] {
  const timeline: TimelineSlot[] = []
  
  let currentTime = new Date()
  currentTime.setHours(startHour, 0, 0, 0)
  
  tasks.forEach((task, index) => {
    const startTime = formatTime(currentTime)
    
    currentTime = new Date(currentTime.getTime() + task.durationMinutes * 60000)
    const endTime = formatTime(currentTime)
    
    const bufferAfter = getBufferMinutes(task.energy)
    currentTime = new Date(currentTime.getTime() + bufferAfter * 60000)
    
    timeline.push({
      startTime,
      endTime,
      taskIndex: index,
      bufferAfter,
    })
  })
  
  return timeline
}

// Calendar-aware timeline building - schedules tasks around Google Calendar events
export function buildCalendarAwareTimeline(
  tasks: PlannedTask[], 
  googleEvents: GoogleCalendarEvent[],
  startHour = 9
): TimelineSlot[] {
  const timeline: TimelineSlot[] = []
  const busySlots = getBusySlots(googleEvents)
  const endOfDay = 18 * 60 // 6 PM in minutes
  
  let currentMinutes = startHour * 60
  
  tasks.forEach((task, index) => {
    const duration = task.durationMinutes
    const bufferAfter = getBufferMinutes(task.energy)
    
    // Find next available slot that fits this task + buffer (prevent buffer from overlapping protected events)
    const startMinutes = findNextAvailableSlot(currentMinutes, duration, busySlots, endOfDay, bufferAfter)
    const endMinutes = startMinutes + duration
    
    const startTime = formatMinutesToTime(startMinutes)
    const endTime = formatMinutesToTime(endMinutes)
    
    timeline.push({
      startTime,
      endTime,
      taskIndex: index,
      bufferAfter,
    })
    
    // Move current time past this task + buffer
    currentMinutes = endMinutes + bufferAfter
  })
  
  return timeline
}

// Merge Google Calendar events with OneBlock tasks into a unified timeline
export function mergeWithCalendarEvents(
  tasks: PlannedTask[],
  timeline: TimelineSlot[],
  googleEvents: GoogleCalendarEvent[]
): TimeBlock[] {
  const blocks: TimeBlock[] = []
  
  // First, add all Google Calendar events as protected blocks
  googleEvents.forEach(event => {
    blocks.push({
      id: event.id,
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      duration: event.duration,
      priority: 'medium',
      energy: 'medium',
      category: 'personal',
      bufferAfter: 0,
      isCompleted: false,
      isCurrent: false,
      source: 'google_calendar',
      isProtected: true,
    })
  })
  
  // Then add OneBlock tasks
  timeline.forEach((slot, index) => {
    const task = tasks[slot.taskIndex]
    if (!task) return
    
    blocks.push({
      id: Math.random().toString(36).substring(2, 9),
      title: task.title,
      startTime: slot.startTime,
      endTime: slot.endTime,
      duration: task.durationMinutes,
      priority: task.priority,
      energy: task.energy,
      category: task.category,
      reasoning: task.reasoning,
      bufferAfter: slot.bufferAfter,
      isCompleted: false,
      isCurrent: index === 0,
      source: 'oneblock',
      isProtected: false,
    })
  })
  
  // Sort all blocks by start time
  blocks.sort((a, b) => {
    const aMinutes = parseTimeToMinutes(a.startTime)
    const bMinutes = parseTimeToMinutes(b.startTime)
    return aMinutes - bMinutes
  })
  
  // Set the first non-protected block as current
  let foundCurrent = false
  blocks.forEach(block => {
    if (!block.isProtected && !foundCurrent) {
      block.isCurrent = true
      foundCurrent = true
    } else {
      block.isCurrent = false
    }
  })
  
  return blocks
}

// Calendar-aware replan: reschedules remaining OneBlock tasks around protected Google Calendar events
export function replanCalendarAwareBlocks(
  blocks: TimeBlock[],
  googleEvents: GoogleCalendarEvent[]
): TimeBlock[] {
  // Separate completed tasks, incomplete OneBlock tasks, and Google Calendar events
  const completedBlocks = blocks.filter(b => b.isCompleted && b.source === 'oneblock')
  const incompleteOneBlockBlocks = blocks.filter(b => !b.isCompleted && b.source === 'oneblock')
  const googleBlocks = blocks.filter(b => b.source === 'google_calendar')
  
  if (incompleteOneBlockBlocks.length === 0) {
    // Nothing to replan
    return blocks
  }
  
  // Convert incomplete blocks back to PlannedTask format for replanning
  const tasksToReplan: PlannedTask[] = incompleteOneBlockBlocks.map(block => ({
    title: block.title,
    durationMinutes: block.duration,
    priority: block.priority,
    energy: block.energy,
    category: block.category || 'work',
    reasoning: block.reasoning || '',
  }))
  
  // Sort tasks optimally before replanning
  const sortedTasks = sortTasksOptimally(tasksToReplan)
  
  // Use deterministic demo-friendly start time:
  // 1. If there's an active (current) OneBlock task, start after it ends
  // 2. Otherwise, default to 9:00 AM for predictable demo behavior
  const activeBlock = blocks.find(
    b => b.isCurrent && b.source === 'oneblock' && !b.isCompleted
  )
  
  let startMinutes: number
  
  if (activeBlock) {
    const activeEndMinutes = parseTimeToMinutes(activeBlock.endTime)
    startMinutes = activeEndMinutes + (activeBlock.bufferAfter || 0)
  } else {
    startMinutes = 9 * 60
  }
  
  // Build calendar-aware timeline starting from now
  const busySlots = getBusySlots(googleEvents)
  const endOfDay = 18 * 60 // 6 PM in minutes
  
  const newTimeline: TimelineSlot[] = []
  let currentTime = startMinutes
  
  sortedTasks.forEach((task, index) => {
    const duration = task.durationMinutes
    const bufferAfter = getBufferMinutes(task.energy)
    
    // Find next available slot that fits task + buffer
    const slotStart = findNextAvailableSlot(currentTime, duration, busySlots, endOfDay, bufferAfter)
    const slotEnd = slotStart + duration
    
    newTimeline.push({
      startTime: formatMinutesToTime(slotStart),
      endTime: formatMinutesToTime(slotEnd),
      taskIndex: index,
      bufferAfter,
    })
    
    currentTime = slotEnd + bufferAfter
  })
  
  // Create new TimeBlock array from replanned tasks
  const replannedBlocks: TimeBlock[] = newTimeline.map((slot, index) => {
    const task = sortedTasks[slot.taskIndex]
    return {
      id: Math.random().toString(36).substring(2, 9),
      title: task.title,
      startTime: slot.startTime,
      endTime: slot.endTime,
      duration: task.durationMinutes,
      priority: task.priority,
      energy: task.energy,
      category: task.category,
      reasoning: task.reasoning,
      bufferAfter: slot.bufferAfter,
      isCompleted: false,
      isCurrent: false,
      source: 'oneblock' as const,
      isProtected: false,
    }
  })
  
  // Merge all blocks: completed OneBlock + Google Calendar + replanned
  const allBlocks = [...completedBlocks, ...googleBlocks, ...replannedBlocks]
  
  // Sort by start time using parseTimeToMinutes for accurate sorting
  allBlocks.sort((a, b) => {
    const aMinutes = parseTimeToMinutes(a.startTime)
    const bMinutes = parseTimeToMinutes(b.startTime)
    return aMinutes - bMinutes
  })
  
  // Set the first incomplete non-protected block as current
  let foundCurrent = false
  allBlocks.forEach(block => {
    if (!block.isProtected && !block.isCompleted && !foundCurrent) {
      block.isCurrent = true
      foundCurrent = true
    } else {
      block.isCurrent = false
    }
  })
  
  return allBlocks
}

export function planFromBrainDump(brainDump: string): PlanResponse {
  const lines = brainDump
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
  
  if (lines.length === 0) {
    return { tasks: [], topThree: [], timeline: [] }
  }
  
  // Parse all tasks
  const parsedTasks = lines.map(parseTask)
  
  // Sort optimally
  const sortedTasks = sortTasksOptimally(parsedTasks)
  
  // Get top 3 indices (based on sorted order)
  const topThree = [0, 1, 2].filter(i => i < sortedTasks.length)
  
  // Build timeline
  const timeline = buildTimeline(sortedTasks)
  
  return {
    tasks: sortedTasks,
    topThree,
    timeline,
  }
}
