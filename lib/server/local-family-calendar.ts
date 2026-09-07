import { readFile } from 'node:fs/promises'
import { google } from 'googleapis'
import type { FamilyBlock } from '@/lib/family-os/contracts'
import type { WeekEventInsight } from '@/lib/family-os/week-insight'
import type { LocalCalendarSourceConfig } from '@/lib/family-os/live-family-week-source'
import {
  calendarSourceHealth,
  decomposeCalendarEvent,
  mergeCalendarSourceBlocks,
  normalizeGoogleCalendarApiEvent,
  resolveLocalCalendarSourceRegistry,
  weekWindowFromLocalDate,
} from '@/lib/family-os'

export interface LocalFamilyWeekResult {
  source: 'live-local'
  blocks: FamilyBlock[]
  weekStartDate: string
  eventCount: number
  sourceHealth: 'green' | 'partial' | 'failure'
  loadedSourceKeys: string[]
  failedSourceKeys: string[]
  insights: WeekEventInsight[]
}

async function loadSource(
  config: LocalCalendarSourceConfig,
  window: ReturnType<typeof weekWindowFromLocalDate>,
): Promise<{ blocks: FamilyBlock[]; eventCount: number }> {
  const rawClient = JSON.parse(await readFile(config.clientPath, 'utf8'))
  const clientMeta = rawClient.installed ?? rawClient.web
  const tokenRecord = JSON.parse(await readFile(config.tokenPath, 'utf8'))
  if (!clientMeta?.client_id || !clientMeta?.client_secret) {
    throw new Error('INVALID_GOOGLE_CALENDAR_CLIENT_FILE')
  }
  if (tokenRecord.clientId !== clientMeta.client_id) {
    throw new Error('GOOGLE_CALENDAR_TOKEN_CLIENT_MISMATCH')
  }

  const auth = new google.auth.OAuth2(clientMeta.client_id, clientMeta.client_secret)
  auth.setCredentials(tokenRecord.credentials)
  const calendar = google.calendar({ version: 'v3', auth })
  const response = await calendar.events.list({
    calendarId: config.calendarId,
    timeMin: window.start.toISOString(),
    timeMax: window.end.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 100,
  })

  const observedAt = new Date().toISOString()
  const blocks: FamilyBlock[] = []
  let eventCount = 0
  for (const item of response.data.items ?? []) {
    const isTimed = Boolean(item.start?.dateTime && item.end?.dateTime)
    const isAllDay = Boolean(item.start?.date && item.end?.date)
    if (!isTimed && !isAllDay) continue

    const normalized = normalizeGoogleCalendarApiEvent(item, {
      calendarId: config.calendarId,
      observedAt,
    })
    blocks.push(...decomposeCalendarEvent(normalized))
    eventCount += 1
  }

  return { blocks, eventCount }
}

export async function loadLocalFamilyWeek(
  env: Record<string, string | undefined> = process.env,
): Promise<LocalFamilyWeekResult | null> {
  const registry = resolveLocalCalendarSourceRegistry(env)
  if (registry.mode === 'none') return null

  const window = weekWindowFromLocalDate(new Date())
  const loadedSourceKeys: string[] = []
  const failedSourceKeys = [...registry.incompleteSourceKeys]
  const blockGroups: FamilyBlock[][] = []
  let eventCount = 0

  for (const config of registry.sources) {
    try {
      const result = await loadSource(config, window)
      loadedSourceKeys.push(config.sourceKey)
      blockGroups.push(result.blocks)
      eventCount += result.eventCount
    } catch {
      failedSourceKeys.push(config.sourceKey)
    }
  }

  const expectedCount = registry.sources.length + registry.incompleteSourceKeys.length
  const sourceHealth = calendarSourceHealth(
    expectedCount,
    loadedSourceKeys.length,
    failedSourceKeys.length,
  )
  return {
    source: 'live-local',
    blocks: mergeCalendarSourceBlocks(blockGroups),
    weekStartDate: window.weekStartDate,
    eventCount,
    sourceHealth,
    loadedSourceKeys,
    failedSourceKeys,
    insights: [],
  }
}
