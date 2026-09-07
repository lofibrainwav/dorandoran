export function privateFamilySurfaceEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.VERCEL === '1') return false
  return env.CHAD_PRIVATE_LOCAL_UI === '1'
}
