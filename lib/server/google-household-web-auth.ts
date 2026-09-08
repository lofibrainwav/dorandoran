import { google } from 'googleapis'
import {
  resolveHouseholdMember,
  type GoogleIdentityClaims,
  type HouseholdMember,
} from '../family-os/google-household-identity.ts'

export type GoogleIdTokenVerifier = (input: {
  credential: string
  clientId: string
}) => Promise<GoogleIdentityClaims>

async function defaultVerifyIdToken(input: {
  credential: string
  clientId: string
}): Promise<GoogleIdentityClaims> {
  const client = new google.auth.OAuth2()
  const ticket = await client.verifyIdToken({
    idToken: input.credential,
    audience: input.clientId,
  })
  const payload = ticket.getPayload()
  return { sub: payload?.sub, email: payload?.email }
}

export async function verifyGoogleHouseholdCredential(input: {
  credential: string
  clientId: string
  membership: HouseholdMember[]
  verifyIdToken?: GoogleIdTokenVerifier
}): Promise<{ googleSub: string; member: HouseholdMember } | null> {
  const credential = input.credential.trim()
  const clientId = input.clientId.trim()
  if (!credential || !clientId) return null

  const claims = await (input.verifyIdToken ?? defaultVerifyIdToken)({ credential, clientId })
  const member = resolveHouseholdMember(claims, input.membership)
  if (!member || !member.canSignIn) return null

  return { googleSub: member.googleSub, member }
}
