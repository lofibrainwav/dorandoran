export type EmailSendRequest = {
  kind: 'email_send'
  actionId: string
  recipientFingerprint: string
  contentFingerprint: string
}

export type EmailDraftRequest = {
  kind: 'email_draft'
  actionId: string
}

export type ExternalActionRequest = EmailSendRequest | EmailDraftRequest

export type HumanApproval = {
  kind: 'human_approval'
  actionKind: 'email_send'
  actionId: string
  recipientFingerprint: string
  contentFingerprint: string
  approvedByType: 'human' | 'agent' | 'system'
  approvedByPersonId: string
  expiresAtEpochMs: number
  consumed: boolean
}

export type ExternalActionDecision =
  | { kind: 'allow'; approvedByPersonId?: string }
  | {
      kind: 'deny'
      reason:
        | 'HUMAN_APPROVAL_REQUIRED'
        | 'APPROVAL_MISMATCH'
        | 'APPROVAL_EXPIRED'
        | 'APPROVAL_CONSUMED'
    }

export function decideExternalAction({
  request,
  approval,
  nowEpochMs,
}: {
  request: ExternalActionRequest
  approval: HumanApproval | null
  nowEpochMs: number
}): ExternalActionDecision {
  if (request.kind !== 'email_send') return { kind: 'allow' }

  if (!approval || approval.approvedByType !== 'human' || !approval.approvedByPersonId) {
    return { kind: 'deny', reason: 'HUMAN_APPROVAL_REQUIRED' }
  }

  if (
    approval.kind !== 'human_approval' ||
    approval.actionKind !== request.kind ||
    approval.actionId !== request.actionId ||
    approval.recipientFingerprint !== request.recipientFingerprint ||
    approval.contentFingerprint !== request.contentFingerprint
  ) {
    return { kind: 'deny', reason: 'APPROVAL_MISMATCH' }
  }

  if (approval.consumed) return { kind: 'deny', reason: 'APPROVAL_CONSUMED' }
  if (approval.expiresAtEpochMs < nowEpochMs) return { kind: 'deny', reason: 'APPROVAL_EXPIRED' }

  return { kind: 'allow', approvedByPersonId: approval.approvedByPersonId }
}
