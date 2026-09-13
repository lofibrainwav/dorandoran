# PRD 49 — Family Digital World Bridge Integration Contract

## Status

`DRAFT / RESEARCH-BACKED` — 2026-09-12 조사 기준. 구현·배포·외부 계정 변경은 이 문서 승인 후에만 시작한다.

이 문서는 기존 Family OS의 Calendar, temporal zoom, Globe, Memory, Lifecycle, Chad, Google/Apple bridge를 대체하지 않는 통합 계약이다. 화면 구조와 responsive/interaction 계약은 [Design Spec 51](./51-family-digital-world-bridge-design-spec.md)을 따른다. `origin/main`의 기존 46번 Apple bridge 문서와 번호가 충돌하지 않도록 새 계약은 49번부터 관리한다.

## 한 문장 정의

Family Digital World Bridge는 가족과 Chad가 실제 브라우저 화면을 함께 보면서 웹·YouTube·Gemini·DoranDoran의 정보를 가족 일정, 장소, 기억, 다음 행동으로 연결하는 시각적 작업공간이다.

## 문제

현재 Family OS의 캘린더는 확인된 일정을 표시하고 메모를 빈 시간에 제안하는 초기 Planner다. 실제 가족 사용에는 다음 연결이 부족하다.

- 일정의 주소·시간·이동·준비·Reminder가 하나의 흐름으로 연결되지 않는다.
- Past Journey 지구본의 장소 점과 사진·이야기·새 일정이 연결되지 않는다.
- 형님은 ChatGPT를, 가족은 Gemini를 주로 사용하지만 두 작업공간의 결과가 Family OS로 모이지 않는다.
- 웹·YouTube·현재 대시보드를 조사한 결과가 제품 요구사항과 구현 후보로 승격되는 경로가 없다.
- Agent가 직접 관찰하고 제안할 수 있는 범위와 인간 승인 후에만 변경할 수 있는 범위가 분리되어야 한다.

## 제품 목표

1. 실제 Chrome을 풀스크린으로 유지하고 Chad Glass를 그 위에 띄워 가족과 Agent가 같은 화면을 본다.
2. 공개 웹·YouTube·Gemini·ChatGPT 결과를 출처 있는 Research Observation으로 수집한다.
3. Apple·Google 생태계의 허용된 메타데이터를 공통 Family Context로 정규화한다.
4. 확인된 일정은 고정하고, 빈 시간은 이동·준비·Task·Reminder를 고려한 살아 있는 제안 블록으로 만든다.
5. Past Journey 3D 지구본의 장소 점을 사진·메모·과거 일정·새 계획과 연결한다.
6. 모든 외부 변경은 Candidate → 사람 승인 → 실행 → readback 순서를 지킨다.

## 비목표

- 형님 승인 없는 Google/Apple Calendar 생성·수정
- Gmail 자동 발송, 구매, 예약, 공개 게시
- 가족의 실시간 위치 추적 또는 과거 위치를 추정한 지도 점 생성
- 사진 원본·메일 본문·OAuth token을 client projection에 노출
- OpenCLI를 DoranDoran의 정본 저장소로 사용
- 모델 제공자 하나에 종속된 Agent runtime
- 지도 시각화만으로 실제 이동시간을 단정

## 사용자와 핵심 시나리오

### 형님 — 지휘 사용자

형님은 ChatGPT에서 “이번 주 가족 일정에 맞는 여행 아이디어를 찾아줘”라고 말하고, Chad가 연 브라우저를 직접 보면서 검색·YouTube·Gemini 결과를 비교한다. 형님은 제품 제안과 외부 변경을 승인한다.

### 가족 — 생활 사용자

가족은 Gemini 또는 DoranDoran에서 “오늘 내가 할 일”을 묻고, 공유된 오늘 화면에서 담당자·장소·준비물·Reminder를 확인한다.

### Chad — Agent 사용자

Chad는 OpenCLI로 브라우저를 관찰하고, 페이지·영상·대시보드의 구조와 내용을 요약한다. Chad는 Candidate까지 만들 수 있으나 Task·Calendar write를 스스로 승인할 수 없다.

## 핵심 경험

```text
형님 질문
  → OpenCLI가 브라우저 표시
  → Chad가 현재 페이지·YouTube·Gemini를 읽음
  → 출처 있는 요약
  → 가족 Context와 비교
  → 제품/여행/일정 Candidate
  → 형님 승인
  → Live Planner에 제안 블록 생성
  → 승인 후 외부 반영
```

## 제품 구조

### 1. Browser Bridge

- Chrome 풀스크린은 그대로 보인다.
- 기본 surface는 Chrome Side Panel companion이며, DoranDoran focus mode에서만 반투명·이동 가능·접기 가능한 floating Glass를 사용한다.
- 모바일에서는 floating Glass 대신 bottom sheet/companion route를 사용한다.
- 현재 탭, URL, 제목, 선택된 범위, 스크린샷, DOM/network 관측을 작업 단위로 묶는다.
- 사용자가 직접 열어 둔 인증 탭은 명시적으로 bind한 경우에만 사용한다.
- 공개 리서치용 owned session과 가족 인증용 bound session을 분리한다.

### 2. Research Inbox

```text
Source → Observation → Summary → Evidence → Pattern → Product Opportunity
```

각 항목은 `sourceUrl`, `observedAt`, `observer`, `contentKind`, `evidenceState`, `summary`, `unknowns`를 갖는다. YouTube는 가능한 경우 transcript·댓글·timestamp와 원본 URL을 저장하고 영상 원본을 복제하지 않는다.

### 3. Family Context

```text
Who / What / When / Where / Why / How
```

Google Calendar·Apple Calendar·Tasks·Reminders·Photos·Drive·Gmail·Maps의 허용된 메타데이터가 이 공통 문법으로 들어온다. provider payload는 UI 계약이 되지 않는다.

### 4. Past Journey Globe

- MapLibre globe을 Past Journey 시간축의 전체 세계 보기로 사용한다.
- 확인된 memory만 장소 cluster가 된다.
- 점 선택 시 장소·기간·가족·사진 썸네일·메모·관련 일정·Chad 대화가 열린다.
- 위치가 없거나 불확실한 기억은 count는 유지하되 지구본 점을 만들지 않는다.

### 5. Live Family Timebox Planner

- 확인된 일정은 `protected` 고정 블록이다.
- Free Block은 가용성의 증거가 아니라 조율 후보다.
- 주소를 좌표로 정규화하고 route provider의 이동시간을 별도 evidence로 저장한다.
- Chad는 duration, owner, priority, travel buffer, preparation, reminder를 대화로 조정한다.
- 변경된 원본 일정이 감지되면 제안 블록을 재계산하고 충돌을 숨기지 않는다.
- Today/Next는 operational summary로 먼저 읽히되, 기존 `Past → Year → Month → Week → Today → Now` temporal zoom과 Week/Month/Year projection은 그대로 보존한다. 이는 축소가 아니라 같은 canonical observation의 다른 zoom이다.

## 우선순위

| 우선순위 | 요구사항 | 성공 기준 |
|---|---|---|
| P0 | 실제 브라우저 + Chad Glass | 브라우저를 보면서 현재 페이지 요약과 후속 질문 가능 |
| P0 | Research Inbox | 웹/YouTube/Gemini 관측에 출처·시간·상태가 붙음 |
| P0 | 일정 고정 + Free Block | 원본 일정과 제안 블록이 시각적으로 구분됨 |
| P0 | 장소·사진·일정 연결 | 지구본 점에서 기억과 다음 계획을 열 수 있음 |
| P1 | route·travel buffer | 이동시간 부족·장소 미확인을 조율 경고로 표시 |
| P1 | Task·Reminder 제안 | 사람이 승인하기 전까지 외부 상태를 바꾸지 않음 |
| P1 | ChatGPT/Gemini handoff | 각 Agent 결과를 공통 Context로 비교·저장 |
| P2 | 가족 채널 알림 | 승인된 대상에게만 요약 전달 |

## 권한과 개인정보

- `read_public`: 공개 웹·YouTube 리서치
- `read_family`: 승인된 가족 Calendar/Photos/Drive metadata
- `propose`: Candidate·Planner suggestion 생성
- `write_calendar`: 인간 승인 후 Calendar 변경
- `send_message`: 별도 승인·수신자/본문 fingerprint 필요
- `build_product`: 전용 worktree·테스트·Preview까지만 자동; merge/deploy는 승인

각 도구 호출은 actor, agent, session, resource, scope, decision, evidenceRef를 기록한다. 인증 브라우저는 현재 허용된 Chrome `Big` 프로필인지 확인하기 전에는 사용하지 않는다.

## 리서치 근거

- OpenCLI는 Agent용 `browser`, `web read`, YouTube search/transcript/comments, ChatGPT/Gemini/Grok adapter를 제공한다. [OpenCLI browser skill](https://github.com/jackwener/opencli/blob/main/skills/opencli-browser/SKILL.md)
- OpenAI Custom GPT는 반복 업무에 역할·파일·도구를 고정하는 패턴을 제공한다. [Custom GPT](https://openai.com/academy/custom-gpts/)
- Gemini Gems는 반복 작업과 전문 역할을 저장하는 사용자 정의 Agent 패턴이다. [Gemini Gems](https://support.google.com/gemini/answer/15236321?hl=en)
- Grok Bot은 대화가 아니라 지속적인 이름·역할·기억·컴퓨터를 가진 Bot을 중심으로 한다. [Grok Bot design](https://x.ai/news/designing-grok-bot)
- Google/Apple Calendar의 모바일 사용 패턴은 주간 격자보다 Schedule/List와 오늘·검색·Task 접근을 중시한다. [Apple Calendar views](https://support.apple.com/guide/iphone/change-how-you-view-events-iphfd1054569/26/ios/26), [Google Calendar iPhone](https://support.google.com/calendar/answer/6101541?co=GENIE.Platform%3DiOS&hl=en)

## 현재 코드와의 연결

- 기존 공통 Context·6W1H·Past Journey·MapLibre globe·사진 metadata adapter를 재사용한다.
- `components/family-globe.tsx`의 `journeyPoints`는 점 표시 기반이고, 장소별 사진·스토리 drawer는 이번 범위의 확장이다.
- `lib/family-os/family-planner.ts`의 보호 일정·gap·timezone 계약을 유지한다.
- 기존 `components/family-planner.tsx`의 memo/timebox는 Live Planner 제안층으로 이동한다.
- `context/product-constitution-01.md`의 “AI는 Candidate까지, Task는 사람”을 변경하지 않는다.

## 성공 지표

- 형님이 30초 안에 현재 페이지 요약과 다음 질문을 실행할 수 있음
- 리서치 Observation의 100%가 URL·observedAt·evidenceState를 가짐
- 원본 일정 0건이 제안 블록으로 변형되지 않음
- 이동시간이 없는 장소는 확정 이동으로 표시되지 않음
- 승인 전 외부 write 0건
- Past Journey의 위치 없는 기억 점 생성 0건
- desktop wide/medium/mobile에서 브라우저 overlay와 planner가 가려짐·overflow 없이 동작

## 단계적 출시

1. **Slice A — Observe**: OpenCLI web/YouTube + Browser Bridge + Research Inbox
2. **Slice B — Remember**: 3D Past Journey 점 → 사진·메모·일정 drawer
3. **Slice C — Plan**: 주소·route·Free Block·대화형 제안·Reminder draft
4. **Slice D — Approve**: Calendar/Task write의 인간 승인·readback
5. **Slice E — Build**: 승인된 제품 제안 → worktree → HyoDo → Preview

## 미해결 질문

- Gemini 탭과 ChatGPT 탭을 같은 가족 작업에 연결할 때 가족별 공유 범위를 어떻게 표시할 것인가?
- Apple Photos metadata의 실제 선택/앨범 운영을 어떤 local-only transport로 유지할 것인가?
- route provider를 하나로 고정할 것인가, provider별 결과를 비교할 것인가?
- 형님이 원하는 Chad Glass의 기본 위치·투명도·단축키는 무엇인가?
