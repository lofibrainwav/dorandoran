import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { normalizeResearchObservation, type ResearchContentKind, type ResearchObservation } from '../family-os/research-observation.ts'

const execFileAsync = promisify(execFile)
const MAX_OUTPUT_CHARS = 12_000

export type OpenCliUnavailableReason = 'timeout' | 'bridge_unavailable' | 'command_failed'
export type OpenCliResearchResult =
  | { state: 'ready'; observation: ResearchObservation }
  | { state: 'empty' }
  | { state: 'unavailable'; reason: OpenCliUnavailableReason }

export type OpenCliRunner = (args: string[], options: { timeout: number; maxBuffer: number }) => Promise<{ stdout: string }>

export function openCliWebReadArgs(url: string): string[] {
  let parsed: URL
  try { parsed = new URL(url) } catch { throw new Error('OPENCLI_RESEARCH_URL_INVALID') }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('OPENCLI_RESEARCH_URL_INVALID')
  return ['web', 'read', '--url', parsed.toString(), '--stdout']
}

async function runOpenCli(args: string[], options: { timeout: number; maxBuffer: number }): Promise<{ stdout: string }> {
  const result = await execFileAsync('opencli', args, options)
  return { stdout: result.stdout }
}

function classifyUnavailable(error: unknown): OpenCliUnavailableReason {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : ''
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  if (code === 'ETIMEDOUT' || message.includes('timeout')) return 'timeout'
  if (message.includes('bridge') || message.includes('daemon') || message.includes('profile')) return 'bridge_unavailable'
  return 'command_failed'
}

function safeSummary(stdout: string): string {
  return stdout.replace(/\s+/g, ' ').trim().slice(0, MAX_OUTPUT_CHARS)
}

function fingerprintFor(sourceUrl: string, contentKind: ResearchContentKind, summary: string): string {
  return createHash('sha256').update(`${contentKind}|${sourceUrl}|${summary}`).digest('hex')
}

export async function readOpenCliWeb(input: {
  url: string
  observedAt: string
  title?: string
  observer?: string
  runner?: OpenCliRunner
}): Promise<OpenCliResearchResult> {
  const args = openCliWebReadArgs(input.url)
  try {
    const { stdout } = await (input.runner ?? runOpenCli)(args, { timeout: 20_000, maxBuffer: 1024 * 1024 })
    const summary = safeSummary(stdout)
    if (!summary) return { state: 'empty' }
    const title = input.title?.trim() || new URL(input.url).hostname
    const fingerprint = fingerprintFor(input.url, 'web', summary)
    const observation = normalizeResearchObservation({
      id: `research:${fingerprint.slice(0, 24)}`,
      fingerprint,
      sourceUrl: input.url,
      title,
      summary,
      observedAt: input.observedAt,
      observer: input.observer?.trim() || 'Chad · OpenCLI',
      contentKind: 'web',
      evidenceState: 'confirmed',
      evidenceRefs: [`opencli-observation:${fingerprint.slice(0, 24)}`],
    })
    return { state: 'ready', observation }
  } catch (error) {
    return { state: 'unavailable', reason: classifyUnavailable(error) }
  }
}
