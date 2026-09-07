import type { LanguageBridgeState } from './contracts.ts'

export interface LanguageBridgeInput {
  sourceLanguage: string
  preferredLanguage: string
  sourceTextRef: string
  translatedMeaning?: string
  extractedActions?: string[]
  extractedDeadlines?: string[]
  uncertainties?: string[]
  communicationProfileRef?: string
  generatedReply?: string
  sourceText?: unknown
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function cleanList(values: string[] | undefined): string[] | undefined {
  if (!values) return undefined
  const cleaned = values.map((value) => value.trim()).filter(Boolean)
  return cleaned.length ? cleaned : undefined
}

export function createLanguageBridge(input: LanguageBridgeInput): LanguageBridgeState {
  const sourceTextRef = clean(input.sourceTextRef)
  if (!sourceTextRef) throw new Error('SOURCE_TEXT_REF_REQUIRED')
  return {
    sourceLanguage: clean(input.sourceLanguage) ?? 'unknown',
    preferredLanguage: clean(input.preferredLanguage) ?? 'unknown',
    sourceTextRef,
    translatedMeaning: clean(input.translatedMeaning),
    extractedActions: cleanList(input.extractedActions),
    extractedDeadlines: cleanList(input.extractedDeadlines),
    uncertainties: cleanList(input.uncertainties),
    communicationProfileRef: clean(input.communicationProfileRef),
    generatedReply: clean(input.generatedReply),
  }
}
