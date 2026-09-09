export type GoogleReadOnlyService = 'calendar' | 'gmail' | 'drive'

const SCOPES: Record<GoogleReadOnlyService, string> = {
  calendar: 'https://www.googleapis.com/auth/calendar.readonly',
  gmail: 'https://www.googleapis.com/auth/gmail.readonly',
  // Drive lane 은 읽기만 한다. Unit 34 의 계획은 read-then-classify 이고 이 lane 의 어느 유닛도
  // Drive 에 쓰지 않는다 — 쓰지 않을 권한을 받아두면 그것이 상시 권한이 된다.
  drive: 'https://www.googleapis.com/auth/drive.readonly',
}

/** 지원 여부는 scope 표 자신에게 묻는다. 서비스를 늘릴 때 고칠 곳이 한 군데여야 한다. */
function isSupportedService(service: string): service is GoogleReadOnlyService {
  return Object.prototype.hasOwnProperty.call(SCOPES, service)
}

export function resolveGoogleReadOnlyScopes(services: string[]): string[] {
  const unique: GoogleReadOnlyService[] = []
  for (const raw of services) {
    const service = raw.trim().toLowerCase()
    if (!service) continue
    if (!isSupportedService(service)) {
      throw new Error(`GOOGLE_SOURCE_SERVICE_UNSUPPORTED:${service}`)
    }
    if (!unique.includes(service)) unique.push(service)
  }
  if (unique.length === 0) throw new Error('GOOGLE_SOURCE_SERVICE_REQUIRED')
  return unique.map((service) => SCOPES[service])
}
