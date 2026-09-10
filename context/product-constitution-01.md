# 제품 헌법 1번 — DoranDoran Family OS

## 한 문장 정의

**DoranDoran은 가족이 여러 AI·Calendar·Drive·학습·실행 도구를 따로 관리하지 않아도, 실제 생활에서 생긴 변화와 결과를 한곳에서 이해하고 다음 행동까지 이어주는 Family Operating System이다.**

DoranDoran은 가족용 파일/캘린더 모음 페이지가 아니다. 가족의 실제 생활을 따라가며 정보를 모으고, 중요한 것을 구분하고, 승인된 다음 행동까지 연결하는 **Memory + Planner + Action + Evidence 허브**다.

## 시스템별 정본과 역할

| 시스템 | 정본 또는 역할 |
| --- | --- |
| Google Calendar | 실제 시간과 일정의 정본 |
| Google Drive | 완성된 파일과 아티팩트의 정본 |
| ChatGPT / Gemini / Grok / Claude | 생각하고 만들고 대화하는 작업 공간 |
| JDK | 제이든 학습 상태와 학습 증거 |
| KINGDOM | 디지털 실행 |
| HyoDo | 사실·증거·권한 검증 |
| DoranDoran | 위 시스템을 사람 기준으로 연결해 보여주는 운영판 |

DoranDoran은 외부 시스템의 정본을 대체하지 않는다. 각 시스템에서 발생한 의미 있는 변화를 받아 가족 단위의 맥락, 판단, 다음 행동으로 연결한다.

## 표준 생활 흐름

```text
가족의 실제 활동
↓
ChatGPT / Calendar / Drive / JDK / KINGDOM
↓
의미 있는 변화 감지
↓
Capture
↓
Candidate
↓
사람이 승인
↓
Task
↓
실행
↓
Artifact
↓
하루 종료 시 Reconcile
↓
Daily Capsule
```

## 권한 원칙

> **AI는 Candidate까지 만들 수 있다. Task는 사람이 승인해야 한다.**

AI는 Capture를 만들고 Candidate를 제안할 수 있지만, Candidate를 승인하거나 Task를 확정할 수 없다. Task는 인간의 명시적인 결정과 증거를 통해서만 생성된다. 실행 결과 역시 HyoDo 검증과 evidence readback을 통해 닫힌다.

예시:

```text
ChatGPT에서 Resume 완성
↓
Drive FINAL_ARTIFACTS에 저장
↓
DoranDoran이 새 Artifact 발견
↓
"Meta 지원에 사용할까요?" Candidate 표시
↓
Jay 승인
↓
Task 생성
↓
Planner가 빈 시간 추천
↓
KINGDOM 실행
↓
HyoDo 결과 검증
```

## 운영판 화면 원칙

첫 화면은 기능 소개 페이지가 아니라 **오늘의 운영판**이어야 한다.

```text
오늘
├─ 다음 일정 / 담당자 / 장소
├─ 오늘 할 일 / 다음 액션
├─ 새로 들어온 Artifact
└─ 확인 필요한 Candidate

Calendar
└─ 오늘 / 주 / 월

섹션 이동
├─ Jayden 학습
├─ Family
├─ Artifacts
├─ Tasks
├─ History
├─ Google 생태계
└─ Apple 포토·지구본
```

모든 기능과 기록은 보존한다. 다만 첫 화면에 긴 설명을 모두 펼치지 않고, 요약 화면 → 섹션 이동 → 상세 팝업/패널의 progressive disclosure를 사용한다. 시간 확대·축소는 오늘의 운영판에서 주간·월간·연간 맥락으로 이어지는 하나의 탐색 문법이어야 한다.

## 공통 6하원칙 데이터 모델

6하원칙은 장식용 카드가 아니라 모든 사건·일정·아티팩트·작업을 설명하는 공통 모델이다.

```text
Who     누가
What    무엇을
When    언제
Where   어디서
Why     왜
How     어떻게
```

예를 들어 같은 엔진으로 다음을 설명한다.

```text
Jayden 수영
Who: Jayden
What: Swimming
When: Thu 6:45 PM
Where: Waterwings
Why: Social Recreation
How: 준비물 / 이동 담당 / 완료 상태

Resume
Who: Jay
What: Meta Resume FINAL
When: Sep 9
Where: Google Drive
Why: Meta application
How: ChatGPT 생성 → 검토 → FINAL
```

## 목표 상태와 현재 경계

현재까지 OS의 lifecycle, DB persistence, API, Family UI, Task-to-Planner, Artifact Registry, Drive handoff parser, Drive Zettelkasten 구조, AI README/MOC/Outbox, Drive legacy migration이 구축되어 있다.

다음 연결은 별도 구현 범위로 관리한다.

```text
Drive Outbox → DoranDoran 자동 ingest
실시간 또는 근실시간 event sync
Night Reconcile
Daily Capsule
ChatGPT 결과 자동 handoff
JDK 학습 이벤트 연결
KINGDOM 실행 결과 연결
Authority 자동 전파
```

완료되지 않은 연결을 완료된 것으로 표시하지 않는다. 특히 Drive에서 파일을 읽는 것과 DoranDoran 화면에 실시간 반영하는 것은 별도 계약이며, Apple Photos의 로컬 승인 스냅샷과 iPhone/단축어 실시간 연동도 별도 경계다.

## 구현 불변식

1. 외부 시스템의 정본을 DoranDoran에 복제해 새 정본으로 만들지 않는다.
2. AI가 Candidate를 Task로 자동 확정하지 않는다.
3. 모든 운영판 항목은 6하원칙과 출처/evidence를 추적할 수 있어야 한다.
4. 새 Artifact는 먼저 관찰·검증·Candidate 상태로 표시하고, 사람 승인 없이 실행 상태로 승격하지 않는다.
5. 완료 보고는 source wiring, runtime, 실제 동기화, 화면 반영을 각각 검증한 뒤에만 한다.
6. 개인정보가 있는 Apple Photos와 가족 데이터는 명시적 동의·범위·권한 없이 공개 표면에 노출하지 않는다.

