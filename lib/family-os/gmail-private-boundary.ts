import type { EvidenceRef } from './contracts.ts'

type GmailHeader = { name?: unknown; value?: unknown }
type GmailPayload = {
  headers?: GmailHeader[]
  body?: { data?: unknown }
}
type RawGmailMessage = {
  id?: unknown
  threadId?: unknown
  snippet?: unknown
  internalDate?: unknown
  payload?: GmailPayload
}

export interface PrivateGmailEnvelope {
  accountId: string
  messageId: string
  threadId?: string
  observedAt: string
  headers: { from?: string; subject?: string }
  privateSnippet?: string
  privateBodyText?: string
  evidenceRef: EvidenceRef
}

function cleanString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
function headerValue(headers: GmailHeader[] | undefined, name: string): string | undefined {
  const target = name.toLowerCase()
  const match = headers?.find((header) => cleanString(header.name)?.toLowerCase() === target)
  return cleanString(match?.value)
}

function decodeBase64Url(value: unknown): string | undefined {
  const encoded = cleanString(value)
  if (!encoded) return undefined
  const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  try {
    return Buffer.from(padded, 'base64').toString('utf8')
  } catch {
    return undefined
  }
}

function senderDomain(from: string | undefined): string | undefined {
  if (!from) return undefined
  return from.match(/[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/i)?.[1]?.toLowerCase()
}

export function normalizePrivateGmailMessage(input: {
  accountId: string
  raw: RawGmailMessage
  observedAt: string
}): PrivateGmailEnvelope {
  const messageId = cleanString(input.raw.id)
  if (!messageId) throw new Error('GMAIL_MESSAGE_ID_MISSING')
  const accountId = cleanString(input.accountId)
  if (!accountId) throw new Error('GMAIL_ACCOUNT_ID_MISSING')
  const headers = input.raw.payload?.headers
  const evidenceRef: EvidenceRef = {
    id: `gmail:${accountId}:${messageId}`,
    sourceType: 'email',
    sourceId: `${accountId}:${messageId}`,
    observedAt: input.observedAt,
    state: 'confirmed',
  }
  return {
    accountId,
    messageId,
    threadId: cleanString(input.raw.threadId),
    observedAt: input.observedAt,
    headers: {
      from: headerValue(headers, 'from'),
      subject: headerValue(headers, 'subject'),
    },
    privateSnippet: cleanString(input.raw.snippet),
    privateBodyText: decodeBase64Url(input.raw.payload?.body?.data),
    evidenceRef,
  }
}

export interface SafeGmailEvidenceProjection {
  messageId: string
  observedAt: string
  evidenceRef: EvidenceRef
  senderDomain?: string
}

export function projectPrivateGmailEvidence(
  envelope: PrivateGmailEnvelope,
  options: { includeSenderDomain?: boolean } = {},
): SafeGmailEvidenceProjection {
  const projection: SafeGmailEvidenceProjection = {
    messageId: envelope.messageId,
    observedAt: envelope.observedAt,
    evidenceRef: { ...envelope.evidenceRef },
  }
  if (options.includeSenderDomain) {
    const domain = senderDomain(envelope.headers.from)
    if (domain) projection.senderDomain = domain
  }
  return projection
}
