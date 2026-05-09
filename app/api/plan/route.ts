import { NextRequest, NextResponse } from 'next/server'
import { planFromBrainDump } from '@/lib/planner'
import type { PlanResponse } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { brainDump } = body
    
    if (!brainDump || typeof brainDump !== 'string') {
      return NextResponse.json(
        { error: 'brainDump string is required' },
        { status: 400 }
      )
    }
    
    if (brainDump.trim().length === 0) {
      return NextResponse.json(
        { error: 'brainDump cannot be empty' },
        { status: 400 }
      )
    }
    
    // Use the planner logic
    const plan: PlanResponse = planFromBrainDump(brainDump)
    
    return NextResponse.json(plan)
  } catch (error) {
    console.error('[API /api/plan] Error:', error)
    
    // Return a fallback empty response on error
    return NextResponse.json(
      { 
        error: 'Failed to plan tasks',
        tasks: [],
        topThree: [],
        timeline: [],
      },
      { status: 500 }
    )
  }
}

// Health check / info endpoint
export async function GET() {
  return NextResponse.json({
    name: 'One-Box Planner API',
    version: '1.0.0',
    endpoints: {
      POST: {
        description: 'Plan tasks from brain dump',
        body: {
          brainDump: 'string - newline-separated list of tasks',
        },
        response: {
          tasks: 'PlannedTask[] - parsed and sorted tasks',
          topThree: 'number[] - indices of top 3 priority tasks',
          timeline: 'TimelineSlot[] - scheduled time blocks',
        },
      },
    },
  })
}
