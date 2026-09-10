export function isCronAuthorized(input: { authorization: string | null; secret: string | undefined }): boolean {
  const secret = input.secret?.trim()
  return Boolean(secret && input.authorization === `Bearer ${secret}`)
}
