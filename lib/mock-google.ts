import type { GoogleCalendarEvent, GoogleWorkspaceConnection, TimeBlock } from './types'

// Mock Google Workspace connection status
export const mockGoogleConnection: GoogleWorkspaceConnection = {
  calendar: true,
  docs: true,
  sheets: true,
  drive: true,
}

// Mock today's Google Calendar events (protected blocks)
export const mockGoogleCalendarEvents: GoogleCalendarEvent[] = [
  {
    id: 'gcal-1',
    title: 'Team sync',
    startTime: '10:00 AM',
    endTime: '10:30 AM',
    duration: 30,
    isProtected: true,
  },
  {
    id: 'gcal-2',
    title: 'Lunch',
    startTime: '12:30 PM',
    endTime: '1:30 PM',
    duration: 60,
    isProtected: true,
  },
  {
    id: 'gcal-3',
    title: 'Family pickup',
    startTime: '3:00 PM',
    endTime: '3:30 PM',
    duration: 30,
    isProtected: true,
  },
]

// Convert Google Calendar events to TimeBlock format
export function googleEventsToTimeBlocks(events: GoogleCalendarEvent[]): TimeBlock[] {
  return events.map(event => ({
    id: event.id,
    title: event.title,
    startTime: event.startTime,
    endTime: event.endTime,
    duration: event.duration,
    priority: 'medium' as const,
    energy: 'medium' as const,
    category: 'personal' as const,
    bufferAfter: 0,
    isCompleted: false,
    isCurrent: false,
    source: 'google_calendar' as const,
    isProtected: true,
  }))
}

// Parse time string to minutes since midnight
export function parseTimeToMinutes(timeStr: string): number {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!match) return 0
  
  let hours = parseInt(match[1])
  const minutes = parseInt(match[2])
  const period = match[3].toUpperCase()
  
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0
  
  return hours * 60 + minutes
}

// Format minutes since midnight to time string
export function formatMinutesToTime(minutes: number): string {
  const hours24 = Math.floor(minutes / 60)
  const mins = minutes % 60
  const period = hours24 >= 12 ? 'PM' : 'AM'
  const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24
  return `${hours12}:${mins.toString().padStart(2, '0')} ${period}`
}

// Get busy time slots from Google Calendar
export function getBusySlots(events: GoogleCalendarEvent[]): Array<{ start: number; end: number }> {
  return events.map(event => ({
    start: parseTimeToMinutes(event.startTime),
    end: parseTimeToMinutes(event.endTime),
  }))
}

// Check if a time slot conflicts with busy slots
export function isSlotAvailable(
  startMinutes: number, 
  endMinutes: number, 
  busySlots: Array<{ start: number; end: number }>
): boolean {
  return !busySlots.some(slot => 
    (startMinutes < slot.end && endMinutes > slot.start)
  )
}

// Find next available time slot (includes buffer time in conflict checking)
export function findNextAvailableSlot(
  desiredStart: number,
  duration: number,
  busySlots: Array<{ start: number; end: number }>,
  endOfDay: number = 18 * 60, // 6 PM
  bufferAfter: number = 0 // Include buffer in slot calculation
): number {
  let currentStart = desiredStart
  const totalDuration = duration + bufferAfter // Check task + buffer fits
  
  while (currentStart + duration + bufferAfter <= endOfDay) {
    const currentEnd = currentStart + totalDuration
    
    // Check if task + buffer would overlap with any busy slot
    if (isSlotAvailable(currentStart, currentEnd, busySlots)) {
      return currentStart
    }
    
    // Find the next slot after a busy period
    const conflictingSlot = busySlots.find(slot => 
      currentStart < slot.end && currentEnd > slot.start
    )
    
    if (conflictingSlot) {
      currentStart = conflictingSlot.end
    } else {
      currentStart += 15 // Move 15 minutes forward
    }
  }
  
  return currentStart // Return last attempted start even if past end of day
}

// Mock sync functions with simulated delays
export async function syncToGoogleCalendar(blocks: TimeBlock[]): Promise<{ success: boolean; message: string }> {
  await new Promise(resolve => setTimeout(resolve, 1200))
  const focusBlocks = blocks.filter(b => b.source !== 'google_calendar')
  return {
    success: true,
    message: `${focusBlocks.length} focus blocks synced to Google Calendar`
  }
}

export async function createGoogleDoc(blocks: TimeBlock[]): Promise<{ success: boolean; message: string }> {
  await new Promise(resolve => setTimeout(resolve, 1000))
  return {
    success: true,
    message: 'Daily plan created in Google Docs'
  }
}

export async function appendToGoogleSheet(blocks: TimeBlock[]): Promise<{ success: boolean; message: string }> {
  await new Promise(resolve => setTimeout(resolve, 800))
  const completed = blocks.filter(b => b.isCompleted).length
  return {
    success: true,
    message: `${completed} completed tasks logged to Google Sheets`
  }
}
