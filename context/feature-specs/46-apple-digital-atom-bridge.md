# Unit 46 — Apple Digital Atom Bridge

## 상태

운영 코드·production 배포 완료, 실기기 readback 대기. 서버 계약·metadata-only ingest·Calendar/Reminders companion transport·Shortcuts App Intent·HomeKit `home.state` read projection과 foreground 동기화까지 `main`에 반영됐다. iPhoneOS 빌드와 앱 설치는 성공했지만, 현재 기기 잠금 상태로 앱 실행이 거부되어 실제 권한 승인·Calendar/Reminders/Shortcuts/HomeKit ingest readback은 아직 미검증이다.

현재 production 기준:

- `main`: `6f909993` (PR #93 병합 후)
- Apple HomeKit 계약: PR #91에서 `home.state`로 정합화
- foreground 자동 동기화: PR #92에서 승인된 권한이 있을 때만 실행
- 원본 사진·바이트·Reminder 본문·Calendar private notes·HomeKit 제어: 계속 비범위

## 목표

기존 iPhone companion을 Apple 생태계의 메타데이터 관찰 브리지로 확장한다.

```text
Apple source
  → iPhone companion adapter
  → authenticated metadata batch
  → DoranDoran ingest
  → ContextObservation
  → Family Operating Read Model
```

DoranDoran은 Apple Calendar, Reminders, Shortcuts, HomeKit의 정본을 대체하지 않는다. 각 원천의 의미 있는 변화만 관찰하고, 기존 `ContextAdapter`와 `ContextObservation` 계약으로 투영한다.

## 범위

### 1단계 — 공통 계약과 상태

- Apple connection을 `photos`, `calendar`, `reminders`, `shortcuts`, `home` capability로 구분한다.
- 계정/기기별 상태를 `unconnected | permission_required | connected | stale | revoked | failed`로 표현한다.
- 모든 수신 batch에 `protocolVersion`, `deviceId`, `source`, `cursor`, `sentAt`, `events`를 요구한다.
- 이벤트는 원본 payload가 아니라 허용된 메타데이터만 담는다.
- 동일 source·device·cursor·event identity는 idempotent하게 처리한다.

현재 증거: `0008_apple_digital_atoms.sql`, `apple-digital-atom-store.ts`, `apple-digital-atom-read.ts`, `723/723` web tests.

### 2단계 — Apple Calendar

- EventKit full access를 명시적으로 요청한다. Apple은 Calendar 읽기 전용 권한을 제공하지 않으므로, 앱이 읽을 때는 full access가 필요하다.
- 읽기 우선이다. Calendar 쓰기는 기존 사람 승인 게이트를 거친 별도 작업으로 남긴다.
- 허용 필드: event id, calendar id, title, start, end, time zone, location label, all-day, status, last modified.
- 설명 전문, 초대 본문, 민감한 메모는 observation에 넣지 않는다.
- canonical observation `kind`는 `schedule`로 투영한다.

현재 증거: `AppleEventKitBridge.swift`의 full-access 요청과 metadata-only batch 생성, Calendar adapter 테스트.

### 3단계 — Apple Reminders

- EventKit Reminders full access를 별도로 요청한다.
- 허용 필드: reminder id, list id, title, due date, completion state, modified date, priority.
- 읽은 Reminder는 즉시 확정 Task가 아니다. `Capture → Candidate`로만 연결한다.
- 사람 승인 후에만 DoranDoran Task 또는 Calendar draft가 된다.

현재 증거: `AppleEventKitBridge.swift`의 Reminders read path와 `reminder` metadata atom. 실기기 권한 readback은 미검증.

### 4단계 — Shortcuts / App Intents

- 사용자의 모든 개인 Shortcut 내부를 읽는 connector로 만들지 않는다.
- DoranDoran이 제공하는 명시적 App Intent만 Shortcuts에 노출한다.
- 초기 액션: `capture.create`, `schedule.candidate`, `jayden.learning.record`, `family.dashboard.open`.
- 실행 결과는 `action.completed` metadata atom으로 수신한다.
- 외부 쓰기·실행은 action별 authority policy와 인간 승인 여부를 확인한다.

현재 증거: `DoranDoranAppIntents.swift`의 metadata-only `action.completed` intent. Xcode 27 unsigned build와 App Shortcuts metadata export는 통과했지만, iPhone 설치/Shortcuts 실행은 서명 계정 blocker로 미검증.

### 5단계 — HomeKit

- HomeKit entitlement와 사용자 승인을 별도로 요청한다.
- 1차는 읽기 전용 context만 허용한다: home, room, accessory label, state, observedAt.
- 조명·잠금·차고·온도 변경 등 제어 액션은 이 단위에서 구현하지 않는다.
- Home 상태로 사람의 실제 위치를 추론하거나 `confirmed_live`로 승격하지 않는다.

### 보류 범위

- HealthKit: 건강 타입과 별도 권한 모델이 필요하므로 가족 운영판 요구사항이 확정될 때까지 보류한다.
- Apple Mail, Find My, 개인 Shortcut 내부 열람: 이번 단위의 공개 API/권한 계약으로 가정하지 않는다.
- 서버가 Apple 정본을 직접 조회하는 구조: iPhone companion 경계를 유지한다.

## 공통 Atom 형태

provider payload는 UI 계약이 되지 않으며, 다음 정보만 canonical observation으로 정규화한다.

```text
sourceRef
deviceId / accountRef
kind
Who / What / When / Where / Why / How
observedAt
evidenceState
evidenceRefs
authorityRef
continuity cursor
privacyScope
```

원본 토큰, 사진 바이트, 파일 경로, raw EXIF, Reminder 본문 전문, Calendar private notes는 저장하거나 client projection으로 내보내지 않는다.

## 순차·병렬 실행 계획

### 직렬 게이트

1. 현재 dirty WIP와 기준선 보존
2. Apple Atom 계약 및 capability 상태 추가
3. iPhone companion batch transport 공통화
4. Calendar adapter + 권한 readback
5. Reminders adapter + 권한 readback
6. 서버 ingest와 `ContextObservation` 투영
7. Family read model 및 UI 상태 표시
8. Node 24, HyoDo, 실기기, production readback

### 병렬 레인

- 공식 API·권한·App Review 제약 조사
- Calendar/Reminders 순수 정규화 테스트
- Shortcuts App Intents 설계 및 HomeKit capability 조사
- UI connection status와 progressive disclosure 설계

단, 같은 파일·같은 migration·같은 iPhone 설치 대상은 병렬 수정하지 않는다.

## 성공 기준

- [x] Photos 기존 동기화가 회귀하지 않는다. (웹 회귀 테스트와 unsigned compile 통과)
- [ ] Calendar와 Reminders 권한 상태가 `connected`로 관측된다. (iPhone 서명 설치 후 검증 필요)
- [ ] 실제 iPhone에서 metadata-only batch가 서버에 도착한다. (production readback 필요)
- [x] 중복 batch 재전송이 중복 observation을 만들지 않는다. (receipt/store 테스트 통과)
- [x] private/raw 필드가 서버 projection과 client JSON에 나타나지 않는다. (read model 테스트 통과)
- [x] Reminder가 사람 승인 없이 Task가 되지 않는다. (adapter는 observation만 생성)
- [ ] Shortcut 액션 성공 결과가 evidence를 가진 observation으로 보인다. (iPhone Shortcuts 실행 필요)
- [x] HomeKit 계약은 초기 단계에서 읽기 전용 상태만 제공한다. (서버 parser·`home.state` projection·production 배포 완료)
- [ ] 실제 iPhone에서 HomeKit 권한 승인과 metadata ingest readback을 확인한다. (기기 잠금 해제 필요)
- [x] `pnpm test`, `pnpm typecheck`, `pnpm lint`가 통과한다. (`723/723`; Node 22 경고는 환경 차이)
- [ ] `pnpm verify`와 Node 24, 연결된 실제 iPhone readback을 남긴다.

## 권한·위험 경계

- OAuth나 Apple permission 허용은 구현 완료가 아니라 사용자 동의 상태다.
- 앱 설치·권한 요청·HomeKit 제어·Calendar/Reminder 쓰기·배포는 각각 별도 실행 증거가 필요하다.
- 동기화 실패는 빈 데이터로 축약하지 않고 `stale` 또는 `failed`로 표시한다.
- AI는 Candidate까지만 제안하며, Task 확정과 외부 실행은 인간 승인 및 기존 HyoDo 경계를 따른다.
