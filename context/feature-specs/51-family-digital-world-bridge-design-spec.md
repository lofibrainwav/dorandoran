# Design Spec 51 — Family Digital World Bridge Integration Experience

## 상태

`DRAFT / RESEARCH-BACKED` — 2026-09-12. PRD 49의 경험 계약을 화면 구조·상태·반응형 규칙으로 구체화한다. 기존 Family OS의 기능과 기록을 제거하지 않고 하나의 경험으로 수렴한다.

## 디자인 판정

현재 Family OS는 Past Journey 지구본, 일정 모델, temporal zoom, lifecycle과 Chad decision contract라는 강한 기반을 갖고 있다. 목표는 이를 줄이는 것이 아니라 `가족이 지금 무엇을 보고 있고, 다음에 무엇을 결정해야 하는가`를 operational summary로 앞에 세우면서, Calendar의 Week/Month/Year와 Globe의 공간축을 모두 보존하는 것이다.

따라서 v1의 디자인 방향은 다음으로 고정한다.

```text
브라우저를 보는 가족
  → Chad Glass가 현재 맥락을 붙잡음
  → 근거 있는 기억/리서치
  → 오늘·다음 일정과 빈 시간
  → 승인 가능한 후보
```

## 리서치에서 확인한 설계 원칙

### 1. 브라우저 companion은 Side Panel 우선

Chrome Side Panel은 웹페이지 옆에 확장 UI를 호스팅하고, 탭 이동 중에도 열림을 유지할 수 있으며, 사이트별 활성화·사용자 제스처 기반 열기를 지원한다. 따라서 인증 웹페이지 위에 임의로 DOM을 주입하는 overlay보다 `Chad Companion`을 기본 표면으로 둔다. [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)

### 2. 캘린더의 첫 시야는 Schedule/Today

Google Calendar iPhone은 기본적으로 upcoming list와 Schedule/Month 전환을 제공한다. 주간 격자는 전체 관계를 볼 때 사용하고, 가족의 일상 실행 화면은 `오늘`, `다음`, `준비`, `이동`을 먼저 보여줘야 한다. [Google Calendar mobile views](https://support.google.com/calendar/answer/6110849?co=GENIE.Platform%3DiOS&hl=en)

### 3. 빈 시간은 busy/read model과 분리

Google Calendar FreeBusy API는 `timeMin`, `timeMax`, `timeZone`으로 busy range를 돌려준다. busy가 없다는 사실은 계획 가능성의 증명이 아니므로, UI는 `Free Block`이 아니라 `Candidate window`로 표현한다. [Google Calendar FreeBusy](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query)

### 4. Globe은 presentation, DOM은 의미

MapLibre GL JS는 WebGL 기반 지도와 globe projection을 제공한다. 지구본은 감정적·공간적 진입점으로 사용하되, 기억 목록과 장소 drawer의 핵심 의미는 DOM으로 동일하게 제공한다. [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/)

### 5. 에이전트 상태는 trace와 guardrail의 축약본이어야 함

에이전트 SDK의 trace에는 agent, tool call, handoff, guardrail과 custom event가 포함될 수 있다. 제품 화면에는 원본 trace나 민감한 payload를 노출하지 않고 `누가 / 무엇을 읽었나 / 언제 관측했나 / 어떤 권한으로 제안했나`만 evidence row로 보여준다. [Agents tracing](https://openai.github.io/openai-agents-js/guides/tracing/), [Agents guardrails](https://openai.github.io/openai-agents-js/guides/guardrails/)

## 화면 구조

### A. 실제 브라우저 표면

```text
┌───────────────────────────────────────────────────────────┐
│ 실제 Chrome 탭                                             │
│                                                           │
│                 웹/YouTube/Gemini 콘텐츠                   │
│                                                           │
│                                      ┌──────────────────┐ │
│                                      │ Chad Companion   │ │
│                                      │ source           │ │
│                                      │ summary          │ │
│                                      │ ask / save       │ │
│                                      └──────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

- 기본: Chrome Side Panel.
- DoranDoran focus mode: panel 내용을 floating glass로 축소해 브라우저 위에 표시.
- 모바일: floating glass를 사용하지 않고 bottom sheet/companion route로 전환.
- Glass는 페이지를 덮는 장식이 아니라 현재 관측의 상태판이다.

### B. DoranDoran Family OS

```text
┌──────────────┬──────────────────────────┬─────────────────────┐
│ Today rail   │ Live family timeline      │ Context drawer      │
│              │ today → next → later      │ event/place/memory  │
│ - now        │ protected / candidate     │ source / route      │
│ - next       │ travel / preparation      │ Chad conversation   │
│ - conflicts  │                          │ approval            │
└──────────────┴──────────────────────────┴─────────────────────┘
```

상단 navigation은 `Today`, `Research`, `Journey`, `Planner`로 구성하되, 기존 `Past → Year → Month → Week → Today → Now` 시간 확대/축소를 제거하거나 숨기지 않는다. Today/Next summary는 temporal zoom 위에 놓이는 operational layer다.

## Chad Companion 계약

### 항상 보여야 하는 정보

- `현재 탭 제목`과 축약 URL
- `관측 상태`: observing / ready / unavailable / stale
- `마지막 관측 시각`
- `observer`: Chad + OpenCLI
- `permission`: read_public / read_family / propose
- `저장된 근거 수`

### 주요 action

| Action | 결과 | 외부 write |
|---|---|---:|
| 요약 | Observation 초안 | 없음 |
| 더 조사 | 새 Observation 후보 | 없음 |
| 가족 맥락과 비교 | Context match 결과 | 없음 |
| 일정 후보 만들기 | Candidate 생성 | 없음 |
| 캘린더에 반영 | 승인 센터로 이동 | 승인 후에만 |
| Gemini에 넘기기 | handoff proposal | 없음 |

### Glass 상호작용

- open/close/collapse는 한 번의 사용자 동작으로 가능해야 한다.
- close 후 underlying browser의 focus가 복귀해야 한다.
- `Escape`는 가장 안쪽 drawer부터 닫고, 두 번째 `Escape`에서 companion을 닫는다.
- drag는 데스크톱 focus mode에서만 허용한다.
- 웹 콘텐츠의 클릭을 가로채지 않도록 기본 상태에서는 side panel을 사용한다.
- stale tab/ref이면 action 버튼을 비활성화하고 `다시 관측`만 제공한다.

## Calendar / Live Planner 계약

### 기본 hierarchy

1. 지금: 현재 진행 중인 일정, 남은 준비, 다음 이동
2. 다음: 다음 일정의 시각·주소·담당자·route 상태
3. 오늘 남은 후보 window
4. 주간 전체 보기

### 블록 상태

| 상태 | 시각 표현 | 의미 |
|---|---|---|
| protected | 실선 | 원본 Calendar에서 읽은 확정 일정 |
| candidate | 점선 | Chad 또는 가족이 제안한 미승인 후보 |
| travel | 별도 이동 stripe | route evidence로 계산된 이동 구간 |
| tight | 주황 경고 | 준비/이동 buffer가 부족함 |
| collision | 빨간 경고 | 시간 또는 담당자 충돌 |
| unavailable | 중립 회색 | provider/route/source 관측 실패 |
| stale | 해칭 | 원본 변경 후 재계산 필요 |

색상만으로 상태를 전달하지 않는다. 라벨·아이콘·패턴·접근성 이름을 함께 사용한다.

### 일정 detail drawer

```text
제목 / 상태
담당 가족
현지 날짜·시간 / America/Los_Angeles
주소 / 주소 출처 / 좌표 confidence
이동시간 / route provider / observedAt
준비물 / reminder draft
근거
[후보 승인] [수정 제안] [닫기]
```

주소가 없거나 route가 실패하면 이동시간을 `0분`으로 축약하지 않는다. `미확인`으로 유지한다.

## Journey Globe / Memory Drawer

### 점을 눌렀을 때의 고정 흐름

```text
점 선택
  → camera focus
  → 장소 요약
  → 허용된 사진 metadata / story
  → 과거 일정
  → 관련 Research Observation
  → 다음 계획 Candidate
```

- 좌표 confidence가 없는 기억은 목록 count에는 포함할 수 있으나 지도 점으로 승격하지 않는다.
- 사진 원본 경로·EXIF·private identifier는 client projection에 포함하지 않는다.
- 사진이 없으면 `사진 미확인`, 기억이 없으면 `기억 없음`, provider가 끊기면 `불러오지 못함`으로 구분한다.
- globe이 WebGL을 사용할 수 없을 때 동일 장소 목록과 시간축을 정적 DOM으로 제공한다.

## 반응형 규칙

### Desktop wide

- 브라우저/Family OS 모두 3열 구조 허용.
- Companion width는 콘텐츠 폭을 침범하지 않는 고정 범위.
- temporal zoom의 week/month/year view는 유지하고, Today rail이 같은 데이터의 실행 요약을 제공한다.

### Desktop medium

- Today rail을 아이콘+label compact 모드로 줄인다.
- Context drawer는 오른쪽 overlay로 전환하되 underlying action을 가리지 않는다.

### Mobile

- 기본 화면은 Today summary + 시간축 진입점.
- 날짜별 Schedule list와 week grid를 같은 canonical observation의 두 projection으로 제공한다.
- Globe → memory drawer는 full-height bottom sheet.
- Chad Companion은 bottom sheet이며 뒤로가기 순서는 `drawer → companion → route`다.
- horizontal overflow와 scroll-jacking을 금지한다.

## 접근성·안전 acceptance

- 첫 2초 안에 `지금 할 일`과 `다음 일정`이 보인다.
- 모든 WebGL marker는 동일한 DOM button/list item을 가진다.
- drawer open 시 focus가 drawer heading으로 이동하고 close 시 trigger로 돌아온다.
- loading, empty, unavailable, stale가 서로 다른 텍스트 상태를 가진다.
- source URL, observedAt, observer, permission은 detail에서 확인 가능하다.
- 웹 페이지의 prompt injection은 데이터로만 표시되고 tool 권한을 바꾸지 않는다.
- 승인 전 Calendar/Task/Gmail/Apple write request는 0건이다.

## 권장 구현 순서

1. 기존 temporal zoom을 보존한 Today/Next operational layer 도입
2. Journey point 선택과 DOM memory drawer 연결
3. Research Inbox observation card 추가
4. OpenCLI state/evidence를 Chad Companion에 연결
5. 기존 Candidate → Human Decision → Task lifecycle과 candidate block 연결
6. route/travel evidence와 DST adversarial tests 추가
7. 실제 Chrome Side Panel adapter와 DoranDoran focus mode 연결

기존 Calendar/Globe/Memory/Lifecycle을 삭제하거나 축소하지 않는다. 먼저 한 장소와 한 일정의 `관측 → 기억 → 후보 → 승인` loop를 증명하고, 같은 observation이 Today/Week/Month/Year projection에서 일관되게 보이는지 확인한다.

## 스킬 업데이트 결과

이번 보강에 사용한 스킬과 역할:

- `deep-research`: 공식 문서 중심의 최신 browser/agent/calendar/map 근거 수집
- `design:research-synthesis`: 관찰·해석·기회·우선순위 분리
- `design:design-critique`: 첫인상·계층·반응형·접근성·권고 판정
- `agent-browser` / `opencli-browser`: 실제 Chrome session, state→action→state, read-only evidence 경계
- `engineering:testing-strategy`: domain/UI/integration/adversarial acceptance 분리

Skills 검색 결과에는 `company-research`와 `web-research-workflow`가 추가로 확인되었지만, 현재는 OpenCLI와 기존 내부 리서치/합성 스킬이 제품 범위에 더 직접적이므로 외부 hosted-service 스킬을 추가 설치하지 않는다.

## 결정해야 할 다음 질문

- Chad Companion의 기본 위치는 Chrome 오른쪽 panel로 고정할 것인가?
- Family OS focus mode에서만 floating glass를 허용할 것인가?
- 가족별 Today rail을 한 화면에 합칠 것인가, 사용자별 filter를 기본으로 둘 것인가?

## Sources

1. [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
2. [Google Calendar mobile views](https://support.google.com/calendar/answer/6110849?co=GENIE.Platform%3DiOS&hl=en)
3. [Google Calendar FreeBusy query](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query)
4. [MapLibre GL JS documentation](https://maplibre.org/maplibre-gl-js/docs/)
5. [OpenAI Agents SDK tracing](https://openai.github.io/openai-agents-js/guides/tracing/)
6. [OpenAI Agents SDK guardrails](https://openai.github.io/openai-agents-js/guides/guardrails/)
7. [OpenCLI browser skill](https://github.com/jackwener/opencli/blob/main/skills/opencli-browser/SKILL.md)
