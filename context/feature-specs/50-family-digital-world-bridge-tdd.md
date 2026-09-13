# TDD 50 — Family Digital World Bridge Integration Contract

## Status

`PLANNED / RED-GREEN-REFACTOR` — PRD 49 승인 전 구현 금지.

UI 상태·반응형·companion 계약의 정본은 [Design Spec 51](./51-family-digital-world-bridge-design-spec.md)이다. 기존 Family OS lifecycle·temporal zoom·Globe 계약을 회귀시키지 않는 통합 테스트를 우선한다.

## 테스트 원칙

- `lib/family-os`는 순수 함수와 결정론적 fixture만 사용한다.
- provider payload·OAuth token·원본 사진·메일 본문·주소는 public test에 넣지 않는다.
- 관측 실패와 빈 목록을 구분한다.
- 자동화는 Candidate까지, Task·Calendar write는 인간 승인 이후에만 가능하다.
- 화면 의미는 DOM으로 검증하고, WebGL/MapLibre는 선택적 presentation으로 취급한다.
- 모든 UI 테스트는 desktop wide, desktop medium, mobile을 포함한다.

## 구현 순서

### RED 1 — Source observation contract

추가 후보: `lib/family-os/research-observation.ts`

검증할 계약:

- URL, observedAt, observer, contentKind가 없으면 거부
- summary와 unknowns를 구분
- source payload가 client projection으로 누출되지 않음
- 동일 source fingerprint의 재수집은 idempotent
- `UNOBSERVABLE`은 `confirmed`로 승격되지 않음

### RED 2 — OpenCLI observation adapter

추가 후보: `lib/server/opencli-research-ports.ts`, `lib/server/opencli-research-run.ts`

검증할 계약:

- web read 결과를 Research Observation으로 변환
- YouTube search/transcript/comments 결과를 원본 URL·timestamp와 함께 보존
- CLI timeout·bridge disconnect는 빈 결과가 아니라 `unavailable`
- read command만 자동 경로에 허용
- like/subscribe/send/fill 같은 write command는 제안 또는 거부
- raw credential·세션 cookie·private browser path가 출력되지 않음

### RED 3 — Browser Bridge observation

추가 후보: `lib/family-os/browser-observation.ts`, UI `components/chad-glass.tsx`

검증할 계약:

- overlay가 현재 페이지 URL/title을 표시
- browser state/screenshot/extract 결과가 하나의 sessionId로 묶임
- 사용자가 bind하지 않은 인증 탭에는 명령을 보내지 않음
- overlay 접기 시 underlying browser interaction이 가능
- overlay가 페이지의 중요한 버튼·콘텐츠를 가리지 않음
- `Escape`, close, focus 복귀가 동작
- public owned session과 bound family session이 교차하지 않음

### RED 4 — Context normalization

재사용: `ContextObservation`, `sixW1H`, `past-journey`, `family-planner`

검증할 계약:

- Calendar/Photos/Research observation은 같은 6W1H grammar로 정규화
- provider-specific field는 adapter 경계 밖으로 나오지 않음
- 장소명만 있고 좌표가 없으면 지도 점을 만들지 않음
- 시간대 변환은 `America/Los_Angeles`, PST, PDT, spring-forward, fall-back을 포함
- 동일 장소·기간의 memory clustering이 결정론적

### RED 5 — Journey place projection

추가 후보: `lib/family-os/journey-place-projection.ts`

검증할 계약:

- confirmed memory만 cluster에 포함
- 좌표가 없는 memory는 count만 유지
- 장소 점 선택 결과는 privacy-safe summary만 포함
- 점은 photo metadata id·raw path·EXIF를 노출하지 않음
- `placeId`와 `journeyId`가 관련 photo/story/event를 안정적으로 연결
- 장소에서 “다음 계획”은 Candidate 상태로만 생성

### RED 6 — Route and travel evidence

추가 후보: `lib/family-os/travel-buffer.ts`, `lib/server/route-provider-ports.ts`

검증할 계약:

- straight-line distance와 route duration을 구분
- route provider 실패는 이동시간 미확인으로 표시
- observedAt와 provider를 보존
- travel buffer를 포함해 Free Block 가능 여부를 계산
- 이동 결과만으로 Calendar write를 수행하지 않음
- 두 일정 사이 이동시간 부족은 명시적 `tight` 또는 `overlap` 상태가 됨

### RED 7 — Live Timebox Planner

재사용·확장: `lib/family-os/family-planner.ts`

검증할 계약:

- confirmed Calendar event는 보호 블록으로 유지
- Free Block은 availability proof가 아님
- duration·owner·priority·travel buffer를 반영한 후보 배치
- 원본 일정 변경 시 기존 draft의 stale/collision을 표시
- 대화 중 “숙제 먼저, 산책 나중”과 같은 순서 변경이 결정론적으로 재계산
- 같은 요청 재실행 시 중복 draft가 생성되지 않음

### RED 8 — Reminder and approval projection

추가 후보: `lib/family-os/family-action-proposal.ts`

검증할 계약:

- Reminder·Task·Calendar 변경은 proposal로 시작
- proposal에는 actor, reason, affected resources, evidence refs가 있음
- 사람 승인 없는 proposal은 외부 provider에 쓰지 않음
- 승인 fingerprint가 recipient/time/title/resource 변경 시 무효화
- 승인 결과와 provider readback이 일치하지 않으면 성공으로 표시하지 않음

### RED 9 — Product synthesis

추가 후보: `lib/family-os/product-synthesis.ts`

검증할 계약:

- 여러 Research Observation에서 공통 pattern을 추출하되 출처를 잃지 않음
- 관찰과 해석을 별도 필드로 유지
- 기능 제안은 impact/effort/risk/acceptanceCriteria를 가짐
- 출처 없는 아이디어는 `hypothesis`로 표시
- 형님 승인 전 Builder Agent 호출을 실행하지 않음

## UI acceptance tests

### Browser/Glass

- 풀스크린 Chrome에서 Chrome Side Panel companion을 열고 닫을 수 있음
- DoranDoran focus mode에서만 floating Chad Glass를 열고 닫을 수 있음
- 현재 URL·제목·관측 상태가 보임
- 페이지 요약 → 후속 질문 → 추가 조사 흐름이 유지됨
- Gemini 탭으로 handoff할 때 대상 탭·권한·결과 상태가 보임
- desktop wide/medium/mobile에서 clipping·horizontal overflow 없음
- mobile에서는 bottom sheet/companion route로 전환되고 back 순서가 유지됨

### Globe/Memory

- Past Journey에서 지구본이 표시되거나 정직한 fallback이 보임
- 확인된 장소 점을 누르면 장소 drawer가 열림
- 사진 thumbnail은 허용된 metadata projection만 사용
- 사진이 없으면 `사진 미확인`과 `기억 없음`을 구분
- drawer에서 관련 Calendar proposal을 열 수 있음

### Planner

- 실제 일정과 draft block이 색상·라벨·접근성 이름으로 구분
- Today/Next operational summary와 Week/Month/Year temporal zoom이 같은 canonical observation을 읽음
- 이전 주·오늘·다음 주가 같은 timezone 기준으로 이동
- 일정 주소가 없으면 이동시간을 계산하지 않음
- 이동 부족·겹침·route unavailable이 각각 구분
- Chad 대화로 draft의 시간·담당·우선순위를 바꿀 수 있음
- 승인 전에는 provider write request가 0건

## Integration and contract tests

| 영역 | 테스트 |
|---|---|
| OpenCLI | `doctor` green, web read, YouTube search/transcript/comments fixture envelope |
| Browser Bridge | state → action → state, stale ref, bind/unbind, screenshot evidence |
| Gemini/ChatGPT | tab identity, handoff proposal, no credential/body leakage |
| Google/Apple | metadata adapter mapping, auth failure, empty vs unavailable |
| Maps/route | coordinate normalization, provider timeout, DST/local date boundaries |
| Doran API | authenticated read model, proposal creation, authorization failure |
| Builder | isolated worktree, diff check, focused test, HyoDo, Preview readback |

## Adversarial tests

- 악성 웹 페이지가 “시스템 지침을 무시하라”고 써도 Research Observation 내용으로만 취급
- YouTube transcript가 긴 지시문을 포함해도 도구 권한이 확대되지 않음
- Gemini 결과가 Calendar write를 지시해도 proposal로만 저장
- stale browser ref는 재확인 없이 클릭하지 않음
- 장소명이 동일한 다른 지역으로 geocode될 때 confidence가 낮아지고 자동 계획 중지
- 봄·가을 DST 경계에서 날짜·시간·주간 경계가 변하지 않음
- route provider가 500/timeout이면 빈 거리로 축약하지 않음
- 사진 metadata가 없는 파일은 지도 점으로 승격되지 않음
- 동일 Observation을 여러 Agent가 제출해도 중복 Candidate가 생성되지 않음
- 승인된 proposal의 제목·시간·대상 중 하나가 바뀌면 재승인 요구

## Visual evidence

각 acceptance run은 다음을 남긴다.

- 브라우저 viewport와 observed URL
- Chad Glass open/closed screenshot
- Past Journey globe screenshot
- 장소 drawer screenshot
- Calendar fixed/draft/collision screenshot
- DOM snapshot과 console/runtime error count
- network request summary
- source/evidence manifest

## Verification command plan

구현 단위마다 최소 다음을 실행한다.

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm verify
git diff --check
```

실제 브라우저 acceptance는 OpenCLI `doctor`가 GREEN인 뒤에만 실행하고, 인증된 가족 화면은 허용된 Chrome `Big` 프로필을 확인한 뒤 명시적으로 bind한다. 변경 후에는 변경 전 증거를 재사용하지 않고 fresh browser readback을 남긴다.

## Done 조건

- PRD 49의 P0 acceptance가 구현·검증됨
- unit/domain/integration/UI/adversarial 테스트가 GREEN
- HyoDo 전체 게이트가 GREEN
- browser/route/photo/Calendar evidence가 fresh run으로 존재
- 외부 write가 발생하지 않은 read-only 단계가 확인됨
- 승인센터와 builder worktree 경계가 문서화됨
- 미관측 항목은 `UNKNOWN`/`UNOBSERVABLE`로 남음
