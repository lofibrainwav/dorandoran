'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type PointerEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { FamilyGlobe } from './family-globe'
import { DAY_PERIODS, minuteClock, orderedPlannerDays, parsePlannerMemo, schedulePlannerWishes, exportTimeboxes, type FamilyPlannerModel, type PlannedTimebox, type PlannerEvent, type PlannerWish } from '@/lib/family-os/family-planner'
import { lifecycleTasksToPlannerWishes, mergePlannerWishes, LIFECYCLE_WISH_ID_PREFIX, type LifecycleTaskForPlanner } from '@/lib/family-os/lifecycle-planner-bridge'
import type { PlannerRecommendation } from '@/lib/family-os/planner-recommendations'
import type { HouseholdHome } from '@/lib/family-os/household-home'
import type { FamilyDailyCapsule } from '@/lib/family-os/daily-capsule'
import { appendPlannerChatProposal, isPlannerSchedulingRequest } from '@/lib/family-os/chat-planner-intent'
import { ApplePhotoPairingPanel } from './apple-photo-pairing-panel'

type Saved = { memo: string; plans: PlannedTimebox[]; durations: Record<string, number> }
const EMPTY: Saved = { memo: '', plans: [], durations: {} }
function subscribe(listener: () => void) {
  window.addEventListener('storage', listener)
  window.addEventListener('family-planner-change', listener)
  return () => { window.removeEventListener('storage', listener); window.removeEventListener('family-planner-change', listener) }
}
function readSaved(raw: string): Saved {
  try {
    const value = JSON.parse(raw)
    if (typeof value.memo !== 'string' || !Array.isArray(value.plans) || !value.durations || typeof value.durations !== 'object') return EMPTY
    return { memo: value.memo.slice(0, 10000), durations: value.durations, plans: value.plans.filter((p: PlannedTimebox) => typeof p.id === 'string' && typeof p.title === 'string' && typeof p.owner === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.date) && Number.isInteger(p.startMinute) && p.startMinute >= 360 && Number.isInteger(p.minutes) && p.minutes > 0 && p.startMinute + p.minutes <= 1260).slice(0, 50) }
  } catch { return EMPTY }
}

function shiftWeekStart(weekStart: string, weeks: number): string {
  const date = new Date(`${weekStart}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + weeks * 7)
  return date.toISOString().slice(0, 10)
}

export interface FamilyPlannerLifecycleViewer { personId: string; access: 'adult' | 'child' }

type LifecycleCandidateSummary = { id: string; state: string; opportunity: { title: string } }
type ChatMessage = { id: number; role: 'user' | 'assistant'; text: string }
type ChatCaptureKind = 'want' | 'decision' | 'fact' | 'question' | 'final_artifact'
type ChatCaptureMode = 'digital' | 'physical' | 'together'
type DriveChatResponse = {
  status?: 'connected' | 'not_connected' | 'incomplete' | 'unavailable'
  artifacts?: Array<{ id: string; kind: string; observedAt: string; state: string; sourceSystem: string; domain: string }>
}
type GmailChatResponse = { status?: 'connected' | 'not_connected' | 'incomplete' | 'unavailable'; messages?: Array<{ messageId: string; observedAt: string; senderDomain?: string }> }
type AppleDigitalAtomSource = { source: 'calendar' | 'reminders' | 'shortcuts' | 'home'; state: 'connected' | 'stale' | 'unconnected'; eventCount: number; lastObservedAt: string | null }
type AppleDigitalAtomResponse = { status?: 'connected' | 'partial' | 'unconnected'; sources?: AppleDigitalAtomSource[]; error?: string }
type DailyCapsuleChatResponse = { capsule?: FamilyDailyCapsule; sources?: { artifacts?: string }; error?: string }
type DriveArtifactState = 'idle' | 'loading' | 'connected' | 'not_connected' | 'incomplete' | 'unavailable'
type GmailConnectionState = 'idle' | 'loading' | 'connected' | 'not_connected' | 'incomplete' | 'unavailable'
type DailyCapsuleResponse = { capsule?: FamilyDailyCapsule; error?: string }

function localDateForTimeZone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function PlannerModal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKeyDown) }
  }, [open, onClose])
  if (!open) return null
  return <div className="planner-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="planner-modal" role="dialog" aria-modal="true" aria-label={title}>
      <header className="planner-modal-header"><h2>{title}</h2><button className="planner-modal-close" onClick={onClose} aria-label={`${title} 닫기`}>×</button></header>
      <div className="planner-modal-body">{children}</div>
    </section>
  </div>
}

function readOnlyChatReply(input: string, model: FamilyPlannerModel, next: PlannerEvent | undefined, todayEvents: PlannerEvent[], wishes: PlannerWish[], candidates: LifecycleCandidateSummary[]): string {
  const prompt = input.toLowerCase()
  if (prompt.includes('drive') || prompt.includes('artifact') || prompt.includes('아티팩트')) {
    return 'Drive·Artifact는 현재 읽기 화면 경로가 연결되지 않았습니다. 가짜 파일을 만들지 않고 연결 전 상태로 남겼습니다. 다음 단계에서 기존 Drive Outbox와 Artifact Registry를 읽기 전용 카드로 연결하겠습니다.'
  }
  if (prompt.includes('gmail') || prompt.includes('메일') || prompt.includes('이메일')) {
    return 'Gmail은 현재 이 화면의 읽기 경로가 연결되지 않았습니다. 메일 본문이나 발신자를 추정하지 않았습니다. 연결되면 먼저 읽기·요약만 제공하고 발송은 별도 승인으로 막겠습니다.'
  }
  if (prompt.includes('후보') || prompt.includes('승인') || prompt.includes('candidate')) {
    return candidates.length
      ? `승인 대기 Candidate ${candidates.length}개가 있습니다: ${candidates.map((candidate) => candidate.opportunity.title).join(', ')}. 아직 Task로 확정하지 않았습니다.`
      : '현재 읽힌 승인 대기 Candidate가 없습니다. 관찰되지 않은 것을 비어 있다고 단정하지 않도록, 연결 실패와 빈 목록은 별도로 표시합니다.'
  }
  if (prompt.includes('할 일') || prompt.includes('task') || prompt.includes('작업')) {
    return wishes.length
      ? `사람이 승인한 Planner 대상이 ${wishes.length}개 있습니다: ${wishes.map((wish) => wish.title).join(', ')}. 캘린더 원본을 바꾸지 않고 빈 시간 제안만 할 수 있습니다.`
      : '현재 사람이 승인한 Planner 대상은 없습니다. 메모를 적거나 Candidate를 승인하면 다음 단계로 연결할 수 있습니다.'
  }
  if (prompt.includes('일정') || prompt.includes('캘린더') || prompt.includes('이번 주') || prompt.includes('오늘')) {
    if (!model.known) return 'Calendar source를 현재 확인하지 못했습니다. 일정이 없다고 확정하지 않고 자동 배치도 중지했습니다.'
    return `이번 주에는 ${model.eventCount}개 일정이 읽혔고, 오늘은 ${todayEvents.length}개입니다. ${next ? `다음 일정은 ${next.title} · ${next.date} · ${minuteClock(next.startMinute)}입니다.` : '확인된 다음 일정은 없습니다.'}`
  }
  return '현재 조회 범위는 Calendar·수락한 Task·Candidate입니다. “이번 주 일정”, “승인 대기 후보”, “할 일”, “Drive 아티팩트”, “Gmail”처럼 물어보시면 확인된 정보만 답하고, 메모는 “적어두기”를 눌렀을 때만 저장합니다.'
}

export function FamilyPlanner({ model: initialModel, home, appleStatus, learningStatus, lifecycleViewer, memberLabels = {}, children }: {
  model: FamilyPlannerModel; home: HouseholdHome; appleStatus: string; learningStatus: string
  lifecycleViewer?: FamilyPlannerLifecycleViewer | null; memberLabels?: Record<string, string>; children?: ReactNode
}) {
  const router = useRouter()
  const swipeStart = useRef<{ x: number; y: number; pointerId: number } | null>(null)
  const [freshModel, setFreshModel] = useState<FamilyPlannerModel | null>(null)
  const [busy, setBusy] = useState(false)
  const model = freshModel ?? initialModel
  const semanticOwnerLabels = { child: '가족 구성원', adult: '보호자', family: '가족 · 대상 미배정' } as const
  const eventOwnerLabel = (event: PlannerEvent) => event.ownerPersonId && memberLabels[event.ownerPersonId] ? memberLabels[event.ownerPersonId] : semanticOwnerLabels[event.owner]
  const key = `dorandoran-week-planner:${model.weekStart}`
  const raw = useSyncExternalStore(subscribe, () => { try { return localStorage.getItem(key) ?? '' } catch { return '' } }, () => '')
  const saved = useMemo(() => readSaved(raw), [raw])
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState<PlannerEvent | null>(null)
  const [showEventDetails, setShowEventDetails] = useState(false)
  const [showConnections, setShowConnections] = useState(false)
  const [showArtifacts, setShowArtifacts] = useState(false)
  const [showCapsule, setShowCapsule] = useState(false)
  const [showMemo, setShowMemo] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatBusy, setChatBusy] = useState(false)
  const [chatCaptureBusy, setChatCaptureBusy] = useState(false)
  const [chatCaptureKind, setChatCaptureKind] = useState<ChatCaptureKind>('want')
  const [chatCaptureMode, setChatCaptureMode] = useState<ChatCaptureMode>('together')
  const [chatCapturePrivacy, setChatCapturePrivacy] = useState<'family' | 'personal'>('family')
  const [chatProposeCandidate, setChatProposeCandidate] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([{ id: 1, role: 'assistant', text: '안녕하세요. 일정·수락한 일·승인 대기의 현재 상태를 확인하고, 원하실 때 메모를 저장할 수 있어요.' }])
  const [resolvedLifecycleViewer, setResolvedLifecycleViewer] = useState<FamilyPlannerLifecycleViewer | null>(null)
  const activeLifecycleViewer = lifecycleViewer ?? resolvedLifecycleViewer
  const [showContext, setShowContext] = useState(false)
  const [completed, setCompleted] = useState<Record<string, boolean>>({})
  const [recommendations, setRecommendations] = useState<PlannerRecommendation[]>([])
  const [recommendationBusy, setRecommendationBusy] = useState(false)
  // 로그인 viewer가 있을 때만, 본인 lane(person=)의 수락한 task를 읽어 planner wish로 합류시킨다.
  // 실패(비로그인·네트워크·서버 오류)해도 memo만으로 조용히 계속 동작한다 — planner를 깨뜨리지 않는다.
  const [lifecycleWishes, setLifecycleWishes] = useState<PlannerWish[]>([])
  const [lifecycleNotice, setLifecycleNotice] = useState('')
  const [pendingCandidates, setPendingCandidates] = useState<LifecycleCandidateSummary[]>([])
  const [driveArtifactState, setDriveArtifactState] = useState<DriveArtifactState>('idle')
  const [driveArtifacts, setDriveArtifacts] = useState<NonNullable<DriveChatResponse['artifacts']>>([])
  const [gmailConnectionState, setGmailConnectionState] = useState<GmailConnectionState>('idle')
  const [appleDigitalAtoms, setAppleDigitalAtoms] = useState<AppleDigitalAtomResponse | null>(null)
  const [dailyCapsule, setDailyCapsule] = useState<FamilyDailyCapsule | null>(null)
  const [dailyCapsuleState, setDailyCapsuleState] = useState<'idle' | 'loading' | 'connected' | 'not_connected' | 'unavailable'>('idle')
  const onWeekPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse') return
    swipeStart.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId }
  }
  const onWeekPointerUp = (event: PointerEvent<HTMLElement>) => {
    const start = swipeStart.current
    swipeStart.current = null
    if (!start || start.pointerId !== event.pointerId) return
    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY)) return
    router.push(`/family?week=${shiftWeekStart(model.weekStart, deltaX > 0 ? -1 : 1)}`)
  }
  const onWeekPointerCancel = () => { swipeStart.current = null }
  useEffect(() => {
    if (lifecycleViewer || resolvedLifecycleViewer) return
    let cancelled = false
    fetch('/api/lifecycle/viewer', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000) })
      .then(async (response) => {
        if (!response.ok) return
        const data = (await response.json()) as { viewer?: FamilyPlannerLifecycleViewer }
        if (!cancelled && data.viewer) setResolvedLifecycleViewer(data.viewer)
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [lifecycleViewer, resolvedLifecycleViewer])
  useEffect(() => {
    if (!activeLifecycleViewer) return
    let cancelled = false
    const viewer = activeLifecycleViewer
    // unmount·viewer 변경 시 진행 중인 요청 자체를 끊는다 (setState 방지만으로는 네트워크가 계속 흐름).
    const controller = new AbortController()
    async function run() {
      try {
        const response = await fetch(`/api/lifecycle/tasks?person=${encodeURIComponent(viewer.personId)}`, {
          credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        })
        if (!response.ok) throw new Error('UNAVAILABLE')
        const data = (await response.json()) as { tasks?: LifecycleTaskForPlanner[] }
        if (!Array.isArray(data.tasks)) throw new Error('UNAVAILABLE')
        if (cancelled) return
        setLifecycleWishes(lifecycleTasksToPlannerWishes(data.tasks, viewer))
        setLifecycleNotice('')
      } catch {
        if (!cancelled) { setLifecycleWishes([]); setLifecycleNotice('수락한 일을 불러오지 못했습니다. 메모만으로 계속할게요.') }
      }
    }
    void run()
    return () => { cancelled = true; controller.abort() }
  }, [activeLifecycleViewer])
  useEffect(() => {
    if (!activeLifecycleViewer) {
      setAppleDigitalAtoms(null)
      return
    }
    let cancelled = false
    fetch('/api/apple/digital-atoms/read', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000) })
      .then(async (response) => {
        const data = (await response.json()) as AppleDigitalAtomResponse
        if (cancelled) return
        if (response.status === 401) { setAppleDigitalAtoms({ status: 'unconnected' }); return }
        if (!response.ok || !Array.isArray(data.sources)) throw new Error(data.error ?? 'UNAVAILABLE')
        setAppleDigitalAtoms(data)
      })
      .catch(() => {
        if (!cancelled) setAppleDigitalAtoms(null)
      })
    return () => { cancelled = true }
  }, [activeLifecycleViewer])
  useEffect(() => {
    if (!activeLifecycleViewer) {
      setDailyCapsule(null)
      setDailyCapsuleState('idle')
      return
    }
    let cancelled = false
    setDailyCapsuleState('loading')
    fetch(`/api/family/daily-capsule?date=${encodeURIComponent(localDateForTimeZone(model.timeZone))}`, {
      credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000),
    }).then(async (response) => {
      const data = (await response.json()) as DailyCapsuleResponse
      if (cancelled) return
      if (response.status === 401) { setDailyCapsule(null); setDailyCapsuleState('not_connected'); return }
      if (!response.ok || !data.capsule) throw new Error(data.error ?? 'UNAVAILABLE')
      setDailyCapsule(data.capsule)
      setDailyCapsuleState('connected')
    }).catch(() => {
      if (!cancelled) { setDailyCapsule(null); setDailyCapsuleState('unavailable') }
    })
    return () => { cancelled = true }
  }, [activeLifecycleViewer, model.timeZone])
  useEffect(() => {
    if (!activeLifecycleViewer) return
    let cancelled = false
    setGmailConnectionState('loading')
    fetch('/api/chat/gmail/status', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000) })
      .then(async (response) => {
        const data = (await response.json()) as { status?: GmailConnectionState }
        if (cancelled) return
        if (response.status === 401) { setGmailConnectionState('not_connected'); return }
        if (data.status === 'connected' || data.status === 'not_connected' || data.status === 'incomplete') {
          setGmailConnectionState(data.status)
          return
        }
        setGmailConnectionState('unavailable')
      })
      .catch(() => {
        if (!cancelled) setGmailConnectionState('unavailable')
      })
    return () => { cancelled = true }
  }, [activeLifecycleViewer])
  useEffect(() => {
    if (!activeLifecycleViewer) {
      return
    }
    let cancelled = false
    fetch('/api/chat/drive?lane=10_JAY', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(20000) })
      .then(async (response) => {
        const data = (await response.json()) as DriveChatResponse
        if (cancelled) return
        if (response.status === 401) { setDriveArtifactState('not_connected'); setDriveArtifacts([]); return }
        if (data.status === 'not_connected') { setDriveArtifactState('not_connected'); setDriveArtifacts([]); return }
        if (data.status === 'incomplete') { setDriveArtifactState('incomplete'); setDriveArtifacts([]); return }
        if (data.status !== 'connected') { setDriveArtifactState('unavailable'); setDriveArtifacts([]); return }
        setDriveArtifactState('connected')
        setDriveArtifacts(data.artifacts ?? [])
      })
      .catch(() => {
        if (!cancelled) { setDriveArtifactState('unavailable'); setDriveArtifacts([]) }
      })
    return () => { cancelled = true }
  }, [activeLifecycleViewer])
  useEffect(() => {
    if (!activeLifecycleViewer) return
    let cancelled = false
    fetch(`/api/lifecycle/candidates?person=${encodeURIComponent(activeLifecycleViewer.personId)}`, {
      credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000),
    }).then(async (response) => {
      if (!response.ok) throw new Error('UNAVAILABLE')
      const data = (await response.json()) as { candidates?: LifecycleCandidateSummary[] }
      if (!Array.isArray(data.candidates)) throw new Error('UNAVAILABLE')
      if (!cancelled) setPendingCandidates(data.candidates.filter((candidate) => candidate.state === 'proposed'))
    }).catch(() => {
      if (!cancelled) setPendingCandidates([])
    })
    return () => { cancelled = true }
  }, [activeLifecycleViewer])
  const wishes = useMemo(
    () => mergePlannerWishes(parsePlannerMemo(saved.memo), lifecycleWishes).map((wish) => ({ ...wish, minutes: saved.durations[wish.id] ?? wish.minutes })),
    [saved, lifecycleWishes],
  )
  const wishById = useMemo(() => new Map(wishes.map((wish) => [wish.id, wish])), [wishes])
  const plans = saved.plans
  const collision = (plan: PlannedTimebox) => !model.known || !model.days.some((day) => day.date === plan.date && day.gaps.some((gap) => plan.startMinute >= gap.startMinute && plan.startMinute + plan.minutes <= gap.endMinute))
  const collidingPlans = plans.filter(collision)
  const attention = model.days.reduce((sum, day) => sum + day.notices.length, 0)
  const next = model.days.filter((day) => !day.past).flatMap((day) => day.events).find((event) => !event.allDay)
  const activeEvent = selected ?? next
  const preparationGroups = [{ label: '준비', who: '함께 확인', items: ['필요한 준비물이 있는지 확인', '맡을 사람과 준비 시간 정하기'] }, { label: '이동', who: '이동 담당 확인', items: ['예정 장소와 출발 시각 확인', '앞 일정과의 이동 여유 확인'] }, { label: '가족', who: '서로 맞춰보기', items: ['다른 가족의 개인 일정 확인', '일정 뒤 휴식 시간 남기기'] }]
  const today = model.days.find((day) => day.today)
  const displayDays = useMemo(() => orderedPlannerDays(model.days), [model.days])
  const todayEvents = today?.events ?? []
  const nextWhen = next ? `${next.date} · ${minuteClock(next.startMinute)}–${minuteClock(next.endMinute)}` : '확인된 다음 일정 없음'
  const visibleDriveArtifactState = activeLifecycleViewer
    ? driveArtifactState === 'idle' ? 'loading' : driveArtifactState
    : 'idle'
  const visibleDriveArtifacts = activeLifecycleViewer ? driveArtifacts : []
  const artifactStatusLabel = visibleDriveArtifactState === 'connected'
    ? `FINAL Artifact ${visibleDriveArtifacts.length}개 확인`
    : visibleDriveArtifactState === 'loading'
      ? 'Artifact 확인 중'
      : visibleDriveArtifactState === 'not_connected'
        ? '로그인 후 확인'
        : visibleDriveArtifactState === 'incomplete'
          ? 'Drive 설정 불완전'
          : visibleDriveArtifactState === 'unavailable'
            ? 'Drive 조회 실패'
            : '연결 전'
  const gmailStatusLabel = gmailConnectionState === 'connected'
    ? '읽기 연결됨'
    : gmailConnectionState === 'loading'
      ? '연결 상태 확인 중'
      : gmailConnectionState === 'incomplete'
        ? '설정 일부 누락'
        : gmailConnectionState === 'unavailable'
          ? '상태 확인 실패'
          : '연결 전'
  const appleDigitalAtomLabel = appleDigitalAtoms?.status === 'connected'
    ? 'Apple Digital Atom 연결됨'
    : appleDigitalAtoms?.status === 'partial'
      ? 'Apple Digital Atom 일부 연결'
      : appleDigitalAtoms
        ? 'Apple Digital Atom 연결 전'
        : 'Apple Digital Atom 상태 확인 실패'
  const appleDigitalAtomSourceLabel = (source: AppleDigitalAtomSource) => source.state === 'connected' ? `${source.eventCount}건 · 연결됨` : source.state === 'stale' ? `${source.eventCount}건 · 갱신 필요` : '연결 전'
  const dailyCapsuleLabel = dailyCapsuleState === 'connected'
    ? `오늘 기록 ${dailyCapsule?.captures.total ?? 0}건 · Task ${dailyCapsule?.tasks.total ?? 0}건`
    : dailyCapsuleState === 'loading'
      ? '오늘 기록 확인 중'
      : dailyCapsuleState === 'not_connected'
        ? '로그인 후 확인'
        : dailyCapsuleState === 'unavailable'
          ? '오늘 기록 확인 실패'
          : '연결 전'
  const selectEvent = (event: PlannerEvent) => { setSelected(event); setShowEventDetails(true) }
  async function askChat(prompt: string) {
    const trimmed = prompt.trim()
    if (!trimmed || chatBusy) return
    const isDriveQuestion = /drive|artifact|아티팩트|파일|결과물/i.test(trimmed)
    const isGmailQuestion = /gmail|메일|이메일/i.test(trimmed)
    const isCapsuleQuestion = /capsule|캡슐|하루 요약|하루 정리|오늘 기록/i.test(trimmed)
    const isSchedulingRequest = isPlannerSchedulingRequest(trimmed)
    setChatInput('')
    setChatMessages((messages) => [...messages, { id: Date.now(), role: 'user', text: trimmed }])
    setChatBusy(isDriveQuestion || isGmailQuestion || isCapsuleQuestion || isSchedulingRequest)
    let reply: string
    if (isSchedulingRequest) {
      save({ ...saved, memo: appendPlannerChatProposal(saved.memo, trimmed), durations: {} })
      setShowMemo(true)
      reply = '일정 원본은 바꾸지 않고 Planner 제안으로 적어두었습니다. 캘린더를 다시 확인한 뒤 “빈 시간에 자동 배치”를 눌러 반영하세요.'
    } else if (isCapsuleQuestion) {
      try {
        const response = await fetch(`/api/family/daily-capsule?date=${encodeURIComponent(localDateForTimeZone(model.timeZone))}`, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000) })
        const data = (await response.json()) as DailyCapsuleChatResponse
        if (response.status === 401) reply = '오늘 Capsule을 확인하려면 먼저 승인된 가족 로그인 세션이 필요합니다.'
        else if (!response.ok || !data.capsule) reply = '오늘 Capsule을 확인하지 못했습니다. 빈 기록으로 바꾸지 않았습니다.'
        else reply = `오늘 Capsule은 Capture ${data.capsule.captures.total}건, Candidate ${data.capsule.candidates.total}건, Task ${data.capsule.tasks.total}건, Artifact ${data.capsule.artifacts.artifacts.length}건입니다. ${data.sources?.artifacts === 'connected' ? 'Drive Artifact도 확인했습니다.' : 'Drive Artifact 연결 상태는 별도로 표시됩니다.'}`
      } catch {
        reply = '오늘 Capsule을 확인하지 못했습니다. 연결 실패를 빈 기록으로 바꾸지 않았습니다.'
      }
    } else if (isDriveQuestion) {
      try {
        const response = await fetch('/api/chat/drive?lane=10_JAY', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(20000) })
        const data = (await response.json()) as DriveChatResponse
        if (response.status === 401) reply = 'Drive를 확인하려면 먼저 승인된 가족 로그인 세션이 필요합니다. 로그인 전 상태를 빈 파일 목록으로 바꾸지 않았습니다.'
        else if (data.status === 'not_connected') reply = 'Drive Outbox가 아직 연결되지 않았습니다. 파일이 없다고 단정하지 않았습니다.'
        else if (data.status === 'incomplete') reply = 'Drive 연결 설정이 일부만 되어 있습니다. 안전을 위해 조회를 중지했습니다.'
        else if (data.status !== 'connected') reply = 'Drive를 확인하지 못했습니다. 원문을 추정하거나 가짜 Artifact를 만들지 않았습니다.'
        else if (!data.artifacts?.length) reply = 'Drive Outbox는 확인했지만 현재 읽을 수 있는 FINAL Artifact가 없습니다. 템플릿·불완전한 파일은 Artifact로 확정하지 않았습니다.'
        else reply = `Drive에서 FINAL Artifact ${data.artifacts.length}개를 확인했습니다: ${data.artifacts.map((artifact) => `${artifact.kind} · ${artifact.state}`).join(', ')}.`
      } catch {
        reply = 'Drive를 확인하지 못했습니다. 연결 실패를 빈 목록으로 바꾸지 않았습니다.'
      }
    } else if (isGmailQuestion) {
      try {
        const response = await fetch('/api/chat/gmail', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(20000) })
        const data = (await response.json()) as GmailChatResponse
        if (response.status === 401) reply = 'Gmail을 확인하려면 먼저 승인된 가족 로그인 세션이 필요합니다. 메일이 없다고 단정하지 않았습니다.'
        else if (data.status === 'not_connected') reply = 'Gmail 읽기 연결이 아직 설정되지 않았습니다. 메일 본문이나 발신자를 추정하지 않았습니다.'
        else if (data.status === 'incomplete') reply = 'Gmail 연결 설정이 일부만 되어 있어 조회를 중지했습니다.'
        else if (data.status !== 'connected') reply = 'Gmail을 확인하지 못했습니다. 실패를 빈 메일함으로 바꾸지 않았습니다.'
        else if (!data.messages?.length) reply = '최근 7일 Inbox에서 확인된 메일이 없습니다. 제목·본문은 읽지 않고 메타데이터만 확인했습니다.'
        else {
          const domains = [...new Set(data.messages.map((message) => message.senderDomain).filter(Boolean))]
          reply = `최근 7일 Inbox에서 ${data.messages.length}건을 확인했습니다.${domains.length ? ` 발신 도메인: ${domains.join(', ')}.` : ''} 제목·본문은 노출하지 않았습니다.`
        }
      } catch {
        reply = 'Gmail을 확인하지 못했습니다. 실패를 빈 메일함으로 바꾸지 않았습니다.'
      }
    } else {
      try {
        const contextSummary = [
          `오늘 날짜 기준 주간 일정 수: ${model.eventCount}`,
          `오늘 일정 수: ${todayEvents.length}`,
          `다음 일정: ${next ? `${next.title}, ${next.date}, ${minuteClock(next.startMinute)}` : '확인된 일정 없음'}`,
          `사람이 승인한 Planner 대상 수: ${lifecycleWishes.length}`,
          `승인 대기 Candidate 수: ${pendingCandidates.length}`,
        ].join('\n')
        const response = await fetch('/api/chat', {
          method: 'POST', credentials: 'same-origin', cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed, context: contextSummary }),
          signal: AbortSignal.timeout(18_000),
        })
        const data = await response.json() as { mode?: string; reply?: string }
        reply = response.ok && data.mode === 'ai' && typeof data.reply === 'string'
          ? data.reply
          : readOnlyChatReply(trimmed, model, next, todayEvents, lifecycleWishes, pendingCandidates)
      } catch {
        reply = readOnlyChatReply(trimmed, model, next, todayEvents, lifecycleWishes, pendingCandidates)
      }
    }
    setChatMessages((messages) => [...messages, { id: Date.now() + 1, role: 'assistant', text: reply }])
    setChatInput('')
    setChatBusy(false)
  }
  function submitChat(event: FormEvent) {
    event.preventDefault()
    void askChat(chatInput)
  }
  async function saveChatCapture() {
    const statedText = chatInput.trim()
    if (!activeLifecycleViewer || !statedText || chatCaptureBusy) return
    setChatCaptureBusy(true)
    try {
      const response = await fetch('/api/chat/capture', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId: activeLifecycleViewer.personId,
          privacyScope: chatCapturePrivacy,
          kind: chatCaptureKind,
          statedText,
          ...(chatProposeCandidate ? { propose: { mode: chatCaptureMode } } : {}),
        }),
      })
      const data = await response.json() as { error?: string; capture?: { id: string }; candidate?: { id: string; opportunity: { title: string } } }
      if (!response.ok || !data.capture) throw new Error(data.error ?? 'CAPTURE_UNAVAILABLE')
      setChatMessages((messages) => [...messages, { id: Date.now(), role: 'assistant', text: data.candidate ? '메모를 저장했고 Candidate로 제안했습니다. Task 확정은 승인 후에만 진행됩니다.' : '메모를 Capture로 저장했습니다. 아직 일정이나 Task로 확정하지 않았습니다.' }])
      if (data.candidate) {
        setPendingCandidates((candidates) => [...candidates, { id: data.candidate!.id, state: 'proposed', opportunity: data.candidate!.opportunity }])
      }
      setChatInput('')
    } catch (error) {
      setChatMessages((messages) => [...messages, { id: Date.now(), role: 'assistant', text: error instanceof Error && error.message === 'AUTH_REQUIRED' ? '저장하려면 승인된 가족 로그인 세션이 필요합니다.' : '메모를 저장하지 못했습니다. 원문은 저장된 것으로 표시하지 않았습니다.' }])
    } finally {
      setChatCaptureBusy(false)
    }
  }
  function save(value: Saved) {
    try { localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new Event('family-planner-change')) }
    catch { setMessage('이 브라우저에 저장할 수 없습니다. 저장 공간 설정을 확인해 주세요.') }
  }
  async function refresh(): Promise<FamilyPlannerModel | null> {
    setBusy(true)
    setMessage('기존 Google 일정을 다시 확인하고 있어요…')
    try {
      const response = await fetch(`/api/planner/availability?week=${encodeURIComponent(model.weekStart)}`, { cache: 'no-store', signal: AbortSignal.timeout(20000) })
      if (!response.ok || response.redirected) throw new Error('UNAVAILABLE')
      const latest: FamilyPlannerModel = await response.json()
      if (!Array.isArray(latest.days) || latest.days.length !== 7) throw new Error('UNAVAILABLE')
      setFreshModel(latest)
      if (!latest.known) throw new Error('UNAVAILABLE')
      return latest
    } catch {
      setMessage('최신 일정을 확인하지 못했습니다. 기존 계획을 유지하며, 배치·내보내기는 진행하지 않았어요.')
      return null
    } finally { setBusy(false) }
  }
  async function arrange() {
    if (busy) return
    if (wishes.some((wish) => !Number.isInteger(wish.minutes) || wish.minutes < 5 || wish.minutes > 900)) {
      setMessage('소요시간은 5~900분 사이로 입력해 주세요.'); return
    }
    const latest = await refresh()
    if (!latest) return
    if (latest.weekStart !== model.weekStart) { setMessage('새로운 주가 시작됐습니다. 이번 주 메모를 입력해 주세요.'); return }
    const result = schedulePlannerWishes(wishes, latest)
    save({ ...saved, plans: result.plans })
    setMessage(`${result.plans.length}개를 빈 시간에 배치했어요.${result.unplaced.length ? ` ${result.unplaced.length}개는 맞는 시간이 없어 메모에 남겨두었습니다.` : ''} 기존 일정은 바꾸지 않았어요.`)
  }
  async function showRecommendations() {
    if (!model.known || !wishes.length) return
    setRecommendationBusy(true)
    try {
      const { recommendPlannerWishes } = await import('@/lib/family-os/planner-recommendations')
      setRecommendations(recommendPlannerWishes(wishes, model, plans))
      setMessage('지금 일정에 넣을 수 있는 일을 골라 주세요. 실제 배치는 선택할 때 최신 일정을 다시 확인합니다.')
    } catch {
      setRecommendations([])
      setMessage('추천을 준비하지 못했습니다. 기존 자동 배치를 사용해 주세요.')
    } finally { setRecommendationBusy(false) }
  }
  async function placeRecommendation(recommendation: PlannerRecommendation) {
    if (busy || recommendationBusy) return
    const wish = wishById.get(recommendation.wishId)
    if (!wish) { setMessage('이 추천의 원래 일을 찾지 못했습니다. 다시 추천해 주세요.'); return }
    setRecommendationBusy(true)
    const latest = await refresh()
    if (!latest) { setRecommendationBusy(false); return }
    if (latest.weekStart !== model.weekStart) { setMessage('새로운 주가 시작됐습니다. 이번 주 메모를 입력해 주세요.'); setRecommendationBusy(false); return }
    const result = schedulePlannerWishes([wish], latest, plans)
    if (result.plans.length !== 1) {
      setMessage('최신 일정에는 이 일을 넣을 수 있는 시간이 없어 기존 계획을 그대로 유지했어요.')
      setRecommendationBusy(false)
      return
    }
    save({ ...saved, plans: [...plans, ...result.plans] })
    setRecommendations(recommendations.filter((item) => item.wishId !== wish.id))
    setMessage(`${wish.title}을(를) 최신 일정 기준으로 빈 시간에 넣었어요. 캘린더 원본은 바뀌지 않았습니다.`)
    setRecommendationBusy(false)
  }
  async function download() {
    if (busy) return
    const latest = await refresh()
    if (!latest) return
    if (plans.some((plan) => !latest.days.some((day) => day.date === plan.date && day.gaps.some((gap) => plan.startMinute >= gap.startMinute && plan.startMinute + plan.minutes <= gap.endMinute)))) { setMessage('현재 일정과 충돌하는 계획이 있습니다. 다시 자동 배치해 주세요.'); return }
    const url = URL.createObjectURL(new Blob([exportTimeboxes(plans, model.timeZone)], { type: 'text/calendar;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = `family-plan-${model.weekStart}.ics`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMessage('계획 파일을 내려받았습니다. Google Calendar의 가져오기 또는 Apple Calendar에서 파일을 열면 반영됩니다. 아직 캘린더에 저장된 것은 아닙니다.')
  }
  async function publishToGoogleCalendar() {
    if (busy || !plans.length || !model.known || collidingPlans.length) return
    const latest = await refresh()
    if (!latest) return
    if (plans.some((plan) => !latest.days.some((day) => day.date === plan.date && day.gaps.some((gap) => plan.startMinute >= gap.startMinute && plan.startMinute + plan.minutes <= gap.endMinute)))) {
      setMessage('현재 일정과 충돌하는 계획이 있습니다. 다시 배치해 주세요.')
      return
    }
    setBusy(true)
    try {
      const results = []
      for (const plan of plans) {
        const response = await fetch('/api/planner/calendar', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...plan, timeZone: model.timeZone }) })
        const data = await response.json() as { created?: boolean; error?: string }
        if (!response.ok) throw new Error(data.error ?? 'CALENDAR_WRITE_FAILED')
        results.push(data.created === true)
      }
      setMessage(`Google Calendar에 ${results.filter(Boolean).length}개 계획을 반영했습니다. 이미 반영된 계획은 중복 생성하지 않았습니다.`)
    } catch (error) {
      setMessage(error instanceof Error && error.message === 'CALENDAR_WRITE_NOT_ALLOWED' ? 'Calendar 반영은 성인 scheduler/admin만 할 수 있습니다.' : 'Calendar 반영에 실패했습니다. 기존 계획은 유지했습니다.')
    } finally { setBusy(false) }
  }
  const dateRange = today
    ? `${today.date.slice(5).replace('-', '.')} 기준 · ${model.days[0].date.slice(5).replace('-', '.')} — ${model.days[6].date.slice(5).replace('-', '.')}`
    : `${model.days[0].date.slice(5).replace('-', '.')} — ${model.days[6].date.slice(5).replace('-', '.')}`

  return <main className="family-planner">
    <div className="planner-shell">
      <header className="planner-header">
        <a className="planner-brand" href="/family"><span className="brand-sun" aria-hidden="true">✺</span><span>도란도란<small>OUR FAMILY, A LITTLE CLOSER</small></span></a>
        <div className="planner-header-actions"><span className="planner-week-label">FAMILY OS / {model.weekStart.slice(0, 4)}</span><button onClick={() => setShowConnections((value) => !value)} aria-expanded={showConnections} className="connection-button"><span className={model.known ? 'status-dot' : 'status-dot status-dot--amber'} /> 연결된 생활 <span>↗</span></button></div>
      </header>
      <section className="operational-home" aria-labelledby="operational-home-title">
        <div className="operational-home-heading"><div><p className="eyebrow">DORANDORAN OPERATING HOME</p><h1 id="operational-home-title">오늘의 운영판</h1><p>지금 일어나는 일과 다음에 할 일을 한곳에서 확인합니다.</p></div><span className={model.known ? 'operational-source operational-source--ready' : 'operational-source'}><i className="status-dot" /> {model.known ? '실제 일정 기준' : '일정 확인 필요'}</span></div>
        <nav className="operational-nav" aria-label="운영판 섹션">
          <button onClick={() => document.getElementById('calendar')?.scrollIntoView({ behavior: 'smooth' })}>Calendar <span>오늘 · 주 · 월</span></button>
          <button onClick={() => setShowContext(true)} disabled={!children}>Tasks & Candidates <span>{children ? '승인과 실행' : '연결 전'}</span></button>
          <button onClick={() => setShowConnections(true)}>Google & Apple <span>연결 상태</span></button>
          <button onClick={() => setShowChat(true)}>Doran Chat <span>조회 · 메모</span></button>
          <button onClick={() => setShowArtifacts(true)} disabled={visibleDriveArtifactState === 'idle'}>Artifacts <span>{artifactStatusLabel}</span></button>
          <button onClick={() => setShowCapsule(true)} disabled={dailyCapsuleState === 'idle'}>Daily Capsule <span>{dailyCapsuleLabel}</span></button>
        </nav>
        <div className="operational-grid">
          <article className="operational-card operational-card--next"><small>다음 일정</small><strong>{next?.title ?? '다음 일정이 없습니다'}</strong><dl><div><dt>누가</dt><dd>{next ? eventOwnerLabel(next) : '미확인'}</dd></div><div><dt>무엇을</dt><dd>{next?.title ?? '미확인'}</dd></div><div><dt>언제</dt><dd>{nextWhen}</dd></div><div><dt>어디서</dt><dd>{next?.place ?? '미확인'}</dd></div><div><dt>왜</dt><dd>원본 일정에 기록되지 않음</dd></div><div><dt>어떻게</dt><dd>일정 상세에서 준비 확인</dd></div></dl>{next ? <button onClick={() => selectEvent(next)}>일정 상세 열기 →</button> : null}</article>
          <article className="operational-card"><small>오늘</small><strong>{todayEvents.length}개 일정 · {lifecycleWishes.length}개 수락한 일</strong><p>{attention ? `${attention}곳에서 이동·겹침 확인이 필요합니다.` : '일정 사이의 여유를 확인하세요.'}</p><button onClick={() => document.getElementById('calendar')?.scrollIntoView({ behavior: 'smooth' })}>캘린더 보기 →</button></article>
          <article className="operational-card"><small>Daily Capsule</small><strong>{dailyCapsuleLabel}</strong><p>오늘의 Capture·Candidate·Task 상태를 원문 없이 요약합니다.</p><button onClick={() => setShowCapsule(true)} disabled={dailyCapsuleState === 'idle'}>오늘 기록 보기 →</button></article>
          {pendingCandidates.length ? <article className="operational-card operational-card--attention"><small>확인 필요</small><strong>{pendingCandidates.length}개 Candidate 승인 대기</strong><p>{pendingCandidates[0].opportunity.title}</p><button onClick={() => setShowContext(true)}>승인 목록 열기 →</button></article> : null}
          {lifecycleWishes.length ? <article className="operational-card"><small>수락한 Task</small><strong>{lifecycleWishes.length}개가 Planner에 대기 중</strong><p>사람이 승인한 일만 일정 배치 대상으로 들어갑니다.</p><button onClick={() => document.getElementById('calendar')?.scrollIntoView({ behavior: 'smooth' })}>시간 배치 보기 →</button></article> : null}
          <article className={`operational-card ${visibleDriveArtifactState === 'connected' && visibleDriveArtifacts.length ? 'operational-card--attention' : ''}`}><small>Artifacts</small><strong>{artifactStatusLabel}</strong><p>{visibleDriveArtifacts.length ? `${visibleDriveArtifacts.slice(0, 2).map((artifact) => artifact.kind).join(' · ')}${visibleDriveArtifacts.length > 2 ? ' 외' : ''}` : 'Drive 원문은 보관하고 운영판에는 안전한 요약만 표시합니다.'}</p><button onClick={() => setShowArtifacts(true)} disabled={visibleDriveArtifactState === 'idle'}>Artifact 보기 →</button></article>
        </div>
      </section>
      <details className="planner-context"><summary>생활권 · 시간 맥락 보기 <span>+</span></summary><section className="planner-intro">
        <div><p className="eyebrow">SMALL STEPS. BRIGHTER DAYS.</p><h2>우리 가족의 한 주,<br /><em>함께 여유롭게.</em></h2><p className="intro-copy">해야 할 일도, 하고 싶은 일도.<br className="mobile-only" /> 메모해 두면 우리 일정 사이에 자리를 찾아요.</p></div>
        <aside className="planner-map"><div className="map-heading"><span>⌖ {home.label}</span><small>가족 생활권 · 실시간 위치 아님</small></div><div className="planner-map-canvas"><FamilyGlobe timeScale="today" home={home} /></div></aside>
      </section></details>
      <PlannerModal open={showConnections} title="연결된 생활" onClose={() => setShowConnections(false)}>
        <div className="connection-panel">
          <article><strong>Google Calendar</strong><span>{model.known ? '실제 일정 읽음 · 기존 일정 고정' : '일정을 확인할 수 없음 · 자동 배치 중지'}</span><p>연결된 가족 운영 캘린더를 기준으로 합니다. 개인별 다른 캘린더까지 비어 있다는 뜻은 아닙니다.</p></article>
          <article><strong>Google Drive</strong><span>{artifactStatusLabel}</span><p>FINAL Artifact는 Drive Outbox 정본에서 읽기 전용으로 투영합니다. 원문과 권한은 Drive에 남습니다.</p></article>
          <article><strong>Gmail</strong><span>{gmailStatusLabel}</span><p>연결되면 최근 메일의 제한된 메타데이터만 읽습니다. 발송·초안·변경은 이 경로에 없습니다.</p></article>
          <article><strong>Apple 생태계</strong><span>{appleStatus}</span><p>Photos·Calendar·미리 알림·Shortcuts·HomeKit은 승인된 iPhone에서 허용된 메타데이터만 스트리밍합니다. 원본 사진, Reminder 본문, 실시간 위치, HomeKit 제어는 이 경로에 없습니다.</p><div className="apple-digital-atom-status"><strong>{appleDigitalAtomLabel}</strong>{appleDigitalAtoms?.sources?.map((source) => <span key={source.source}>{source.source} · {appleDigitalAtomSourceLabel(source)}</span>)}</div><ApplePhotoPairingPanel canPair={activeLifecycleViewer?.access === 'adult'} /></article>
          <article><strong>학습·할 일</strong><span>{learningStatus}</span><p>메모는 이 브라우저에 보관합니다. Apple 미리 알림은 승인된 기기에서 메타데이터만 관찰하며, Doran Task로 자동 확정하지 않습니다. Google Tasks는 아직 별도 연결하지 않습니다.</p></article>
        </div>
      </PlannerModal>
      <PlannerModal open={showArtifacts} title="Drive Artifacts" onClose={() => setShowArtifacts(false)}>
        <div className="artifact-panel">
          <p className="chat-scope"><span className="status-dot" /> {artifactStatusLabel} · 읽기 전용</p>
          {visibleDriveArtifactState === 'connected' && visibleDriveArtifacts.length ? <div className="artifact-list">{visibleDriveArtifacts.map((artifact) => <article className="artifact-row" key={artifact.id}><div><strong>{artifact.kind}</strong><span>{artifact.state} · {artifact.sourceSystem} · {artifact.domain}</span></div><small>{artifact.observedAt}</small></article>)}</div> : <p className="modal-empty">{visibleDriveArtifactState === 'idle' ? '승인된 가족 로그인 후 Drive 상태를 확인할 수 있습니다.' : visibleDriveArtifactState === 'not_connected' ? 'Drive를 확인하려면 승인된 가족 로그인 세션이 필요합니다.' : visibleDriveArtifactState === 'incomplete' ? 'Drive 연결 설정이 일부만 되어 있어 조회하지 않았습니다.' : visibleDriveArtifactState === 'unavailable' ? 'Drive를 확인하지 못했습니다. 빈 목록으로 축약하지 않았습니다.' : visibleDriveArtifactState === 'loading' ? 'Drive Artifact를 확인하고 있습니다…' : '현재 읽을 수 있는 FINAL Artifact가 없습니다.'}</p>}
        </div>
      </PlannerModal>
      <PlannerModal open={showCapsule} title="오늘의 Daily Capsule" onClose={() => setShowCapsule(false)}>
        {dailyCapsuleState === 'connected' && dailyCapsule ? <div className="capsule-panel">
          <p className="chat-scope"><span className="status-dot" /> {dailyCapsule.date} · privacy-safe 요약 · 읽기 전용</p>
          <div className="capsule-summary-grid">
            <article><small>Capture</small><strong>{dailyCapsule.captures.total}건</strong><span>오늘 들어온 기록</span></article>
            <article><small>Candidate</small><strong>{dailyCapsule.candidates.total}건</strong><span>오늘 제안된 후보</span></article>
            <article><small>Task</small><strong>{dailyCapsule.tasks.total}건</strong><span>오늘 관찰된 작업</span></article>
            <article><small>Artifact</small><strong>{dailyCapsule.artifacts.artifacts.length}건</strong><span>확인된 결과물</span></article>
          </div>
          <div className="capsule-breakdown">
            <p><b>Task 상태</b> {Object.entries(dailyCapsule.tasks.byState).map(([state, count]) => `${state} ${count}`).join(' · ')}</p>
            <p><b>Candidate 상태</b> {Object.entries(dailyCapsule.candidates.byState).map(([state, count]) => `${state} ${count}`).join(' · ')}</p>
          </div>
          <p className="preparation-note">이 화면은 원문·evidence ref를 표시하지 않습니다. Task 확정이나 상태 변경은 이 모달에서 실행하지 않습니다.</p>
        </div> : <p className="modal-empty">{dailyCapsuleState === 'idle' ? '승인된 가족 로그인 후 오늘 기록을 확인할 수 있습니다.' : dailyCapsuleState === 'not_connected' ? '오늘 기록을 확인하려면 승인된 가족 로그인 세션이 필요합니다.' : dailyCapsuleState === 'loading' ? '오늘 기록을 모으고 있습니다…' : '오늘 기록을 확인하지 못했습니다. 빈 기록으로 바꾸지 않았습니다.'}</p>}
      </PlannerModal>
      <PlannerModal open={showMemo} title="일단, 적어두세요." onClose={() => setShowMemo(false)}>
        <div className="memo-modal">
          <p className="chat-scope"><span className="status-dot" /> 생각·할 일 기록 · 아직 캘린더에 확정하지 않음</p>
          <label className="sr-only" htmlFor="family-memo">가족 할 일 메모</label>
          <textarea id="family-memo" maxLength={10000} value={saved.memo} onChange={(event) => save({ ...saved, memo: event.target.value, durations: {} })} placeholder={'한 줄에 하나씩 편하게 적어보세요\n\n예) 해야 할 학교 준비 20분\n@구성원 책 읽기 30분\n함께 산책 40분\n가족과 이야기 나누기'} />
          <p className="memo-hint">시간을 적지 않으면 <b>30분 예상</b>으로 시작해요. 캘린더에 넣기 전 바꿀 수 있어요.</p>
          {lifecycleNotice ? <p className="memo-hint">{lifecycleNotice}</p> : null}
          {wishes.length ? <div className="wish-list">{wishes.map((wish) => <label key={wish.id} className="wish-row"><span><b>{wish.required ? '해야' : '하고 싶어'}</b>{wish.title}<small>{wish.id.startsWith(LIFECYCLE_WISH_ID_PREFIX) ? `수락한 일 · ${wish.owner}` : wish.estimated && !saved.durations[wish.id] ? '예상 시간 · 확인해 주세요' : wish.owner}</small></span><input aria-label={`${wish.title} 소요시간`} type="number" min="5" max="900" step="5" value={wish.minutes} onChange={(event) => save({ ...saved, durations: { ...saved.durations, [wish.id]: Number(event.target.value) } })} /><small>분</small></label>)}</div> : <div className="memo-empty"><span>〰</span><p>머릿속에 있던 것들을<br />여기에 내려놓으세요.</p></div>}
          <button className="recommend-button" disabled={!model.known || !wishes.length || recommendationBusy} onClick={() => void showRecommendations()}>✦ 지금 넣을 일 추천</button>
          {recommendations.length ? <section className="recommendations" aria-label="지금 넣을 일 추천"><h3>지금 넣기 좋은 일</h3><p>선택한 한 가지만 최신 일정을 확인한 뒤 배치합니다.</p>{recommendations.map((recommendation) => <article className="recommendation-card" key={recommendation.wishId}><div><strong>{recommendation.title}</strong><small>{recommendation.owner} · {recommendation.label} · {recommendation.confidence === 'high' ? '확신 높음' : '확인 필요'}</small><span>{recommendation.fitReason.join(' · ')}</span></div><button aria-label={`${recommendation.title} 추천 선택`} disabled={recommendationBusy} onClick={() => void placeRecommendation(recommendation)}>이 일 넣기</button></article>)}</section> : null}
          <button className="auto-plan-button" disabled={!model.known || !wishes.length} onClick={arrange}>✦ {plans.length ? '시간표 다시 짜기' : '빈 시간에 자동 배치'} <span>→</span></button>
          <p className="memo-policy">기존 일정 앞뒤 15분 여유 · 할 일 사이 10분 쉼<br />필수 항목 우선 · 종일 일정이 있는 날은 자동 배치 제외</p>
        </div>
      </PlannerModal>
      <PlannerModal open={showChat} title="Doran Chat" onClose={() => setShowChat(false)}>
        <div className="chat-panel">
          <p className="chat-scope"><span className="status-dot" /> 확인은 읽기 전용 · 메모 저장은 명시적 버튼으로만 실행</p>
          <div className="chat-thread" role="log" aria-live="polite">
            {chatMessages.map((message) => <div className={`chat-message chat-message--${message.role}`} key={message.id}><span>{message.role === 'user' ? '형' : '도란'}</span><p>{message.text}</p></div>)}
          </div>
          <div className="chat-prompts" aria-label="질문 예시">
            {['이번 주 일정 확인해줘', '산책 30분 시간표에 넣어줘', '오늘 Capsule 요약해줘', '승인 대기 후보 보여줘', 'Drive 아티팩트 상태 알려줘', 'Gmail 연결 상태 알려줘'].map((prompt) => <button type="button" key={prompt} onClick={() => void askChat(prompt)} disabled={chatBusy}>{prompt}</button>)}
          </div>
          <form className="chat-composer" onSubmit={submitChat}><label className="sr-only" htmlFor="doran-chat-input">도란에게 물어보기</label><input id="doran-chat-input" value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="이번 주 일정이나 승인 대기를 물어보세요" disabled={chatBusy} /><button type="submit" disabled={!chatInput.trim() || chatBusy}>{chatBusy ? '확인 중…' : '보내기'}</button></form>
          {activeLifecycleViewer ? <div className="chat-capture-controls" aria-label="메모 저장 설정">
            <div className="chat-capture-fields">
              <label>종류<select value={chatCaptureKind} onChange={(event) => setChatCaptureKind(event.target.value as ChatCaptureKind)}><option value="want">하고 싶은 일</option><option value="decision">결정</option><option value="fact">사실</option><option value="question">질문</option><option value="final_artifact">완성 결과물</option></select></label>
              <label>범위<select value={chatCapturePrivacy} onChange={(event) => setChatCapturePrivacy(event.target.value as 'family' | 'personal')}><option value="family">가족</option><option value="personal">개인</option></select></label>
              {chatProposeCandidate ? <label>작업 방식<select value={chatCaptureMode} onChange={(event) => setChatCaptureMode(event.target.value as ChatCaptureMode)}><option value="together">함께</option><option value="digital">디지털</option><option value="physical">실행</option></select></label> : null}
            </div>
            <label className="chat-capture-propose"><input type="checkbox" checked={chatProposeCandidate} onChange={(event) => setChatProposeCandidate(event.target.checked)} /> 저장과 함께 Candidate로 제안</label>
            <button type="button" className="chat-capture-button" onClick={() => void saveChatCapture()} disabled={!chatInput.trim() || chatCaptureBusy}>{chatCaptureBusy ? '저장 중…' : '적어두기'}</button>
          </div> : null}
        </div>
      </PlannerModal>
      <div className="planner-workspace">
        <section className="week-panel" id="calendar" aria-label="이번 주 타임박스 플래너" onPointerDown={onWeekPointerDown} onPointerUp={onWeekPointerUp} onPointerCancel={onWeekPointerCancel}>
          <div className="week-toolbar"><div><p className="eyebrow">OUR WEEK</p><h2>이번 주 캘린더 <span>{dateRange}</span></h2></div><div className="week-toolbar-actions"><button className="export-button" onClick={() => router.push(`/family?week=${shiftWeekStart(model.weekStart, -1)}`)} aria-label="이전 주 보기">‹ 이전 주</button><button className="export-button" onClick={() => router.push('/family')} aria-label="이번 주 보기">오늘 주</button><button className="export-button" onClick={() => router.push(`/family?week=${shiftWeekStart(model.weekStart, 1)}`)} aria-label="다음 주 보기">다음 주 ›</button><button className="memo-toolbar-button" onClick={() => setShowMemo(true)} aria-haspopup="dialog">✎ 메모{wishes.length ? ` ${wishes.length}` : ''}<span className="sr-only">빈 시간에 자동 배치</span></button><button className="export-button" onClick={download} disabled={!plans.length || !model.known || !!collidingPlans.length}>계획 내보내기 ↗</button><button className="export-button" onClick={() => void publishToGoogleCalendar()} disabled={!plans.length || !model.known || !!collidingPlans.length || busy}>Google Calendar에 반영</button></div></div>
          <div className="week-summary"><span><i className="status-dot" />{model.known ? `${model.eventCount}개 실제 일정` : '일정 확인 필요'}</span><span>{plans.length}개 새 계획</span><span>{attention ? `${attention}곳 시간 조율 확인` : '일정 사이에 여유를 남겨요'}</span></div>
          <p role="status" aria-live="polite" className={message ? 'planner-message' : 'planner-message-empty'}>{message}</p>
          {collidingPlans.length ? <p className="planner-warning">⚠ 일정이 바뀌었거나 이미 지난 시간이 포함된 계획 {collidingPlans.length}개가 있습니다. 다시 배치해 주세요.</p> : null}
          {!model.known ? <p className="planner-warning">일정이 확인되지 않아 빈 시간으로 간주하지 않습니다. 연결을 확인하면 자동 배치할 수 있어요.</p> : null}
          <div className="week-scroll"><div className="timebox-grid">
            <div className="grid-corner">TIME</div>{displayDays.map((day) => <div key={day.date} className={`day-heading ${day.today ? 'is-today' : ''} ${day.dayKind === 'sunday' ? 'is-sunday' : ''} ${day.dayKind === 'saturday' ? 'is-saturday' : ''}`}><span>{day.weekday}</span><strong>{day.dayNumber}</strong>{day.today ? <small>TODAY</small> : null}</div>)}
            <div className="period-label all-day-label">종일</div>{displayDays.map((day) => <div className="all-day-cell" key={`all-${day.date}`}>{day.events.filter((event) => event.allDay).map((event) => <button key={event.id} className="all-day-event" onClick={() => selectEvent(event)}>{event.title}</button>)}{day.notices.length ? <span className="day-notice">△ {day.notices.some((notice) => notice.kind === 'overlap') ? '겹치는 시간 확인' : `${day.notices[0].minutes}분 전환 · 확인`}</span> : null}</div>)}
            {DAY_PERIODS.map((period) => <div className="period-row" key={period.id}><div className="period-label"><span>{period.icon}</span><b>{period.label}</b><small>{minuteClock(period.start)}<br />{minuteClock(period.end)}</small></div>{displayDays.map((day) => {
              const events = day.events.filter((event) => !event.allDay && event.startMinute < period.end && event.endMinute > period.start)
              const dayPlans = plans.filter((plan) => plan.date === day.date && plan.startMinute >= period.start && plan.startMinute < period.end)
              const gap = day.gaps.find((item) => item.startMinute >= period.start && item.startMinute < period.end)
              return <div key={day.date} className={`timebox-cell ${day.past ? 'is-past' : ''} ${day.today ? 'is-today' : ''}`}>{events.map((event) => <button key={event.id} className={`calendar-block block-${event.owner}`} onClick={() => selectEvent(event)}><span className="block-time">{event.continued || event.startMinute < period.start ? '이어지는 일정' : `${minuteClock(event.startMinute)}–${minuteClock(event.endMinute)}`} <i>▣</i></span><strong>{event.title}</strong><small>{eventOwnerLabel(event)}</small></button>)}{dayPlans.map((plan) => <article key={plan.id} className={`draft-block ${collision(plan) ? 'draft-conflict' : ''}`}><span>{minuteClock(plan.startMinute)}–{minuteClock(plan.startMinute + plan.minutes)} · 계획</span><strong>{plan.title}</strong><small>{plan.owner}</small><button aria-label={`${plan.title} 계획 삭제`} onClick={() => save({ ...saved, plans: plans.filter((p) => p.id !== plan.id) })}>×</button></article>)}{gap && !dayPlans.length ? <div className="gap-block"><span>＋</span><b>{gap.minutes}분의 여유</b><small>{minuteClock(gap.startMinute)}–{minuteClock(gap.endMinute)}</small><p>{wishes.length ? '메모를 자동 배치해 보세요' : '하고 싶은 일을 적어보세요'}</p></div> : !events.length && !dayPlans.length ? <span className="quiet-cell">{day.past ? '지나간 시간' : model.known ? '일정과 함께 조율' : '확인 필요'}</span> : null}</div>
            })}</div>)}
          </div></div>
          <p className="calendar-footnote">▣ 기존 Google Calendar 일정은 고정됩니다. 성인 scheduler/admin이 버튼을 눌렀을 때만 새 계획을 반영합니다. 여유 시간은 연결된 캘린더 기준이며 가족 모두의 가용성을 확정하지 않습니다.</p>
        </section>
      </div>
      {activeEvent ? <section className="action-launcher" aria-label="일정에서 준비까지">
        <div><p className="eyebrow">FROM CALENDAR TO CARE</p><h2>일정에서 준비까지</h2><p>{activeEvent.title}의 준비 항목을 확인해 보세요.</p></div>
        <button className="action-launcher-button" onClick={() => setShowEventDetails(true)}>일정 상세 열기 <span>→</span></button>
      </section> : null}
      <PlannerModal open={showEventDetails} title={activeEvent?.title ?? '일정 상세'} onClose={() => setShowEventDetails(false)}>
        {activeEvent ? <>
          <div className="event-detail-summary"><small>선택한 일정</small><strong>{activeEvent.date} · {minuteClock(activeEvent.startMinute)}–{minuteClock(activeEvent.endMinute)}</strong><span>{eventOwnerLabel(activeEvent)}{activeEvent.place ? ` · ${activeEvent.place}` : ' · 예정 장소 미확인'}</span>{activeEvent.place ? <div className="map-links"><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeEvent.place)}`} target="_blank" rel="noreferrer">Google 지도 ↗</a><a href={`https://maps.apple.com/?q=${encodeURIComponent(activeEvent.place)}`} target="_blank" rel="noreferrer">Apple 지도 ↗</a></div> : null}</div>
          <div className="modal-preparation-grid">{preparationGroups.map((group) => <article className="preparation-card" key={group.label}><div><h3>{group.label}</h3><small>{group.who} · 제안</small></div>{group.items.map((item) => { const id = `${activeEvent.id}-${item}`; return <label key={item}><input type="checkbox" checked={!!completed[id]} onChange={(event) => setCompleted({ ...completed, [id]: event.target.checked })} /><span>{item}</span></label> })}</article>)}</div>
          <p className="preparation-note">준비 항목은 확인을 돕는 제안이며, 원본 일정에서 확인된 지시나 담당자 배정이 아닙니다.</p>
        </> : <p className="modal-empty">캘린더에서 먼저 일정을 선택해 주세요.</p>}
      </PlannerModal>
      <PlannerModal open={showContext} title="추억 · 월간 · 연간 맥락" onClose={() => setShowContext(false)}>{children}</PlannerModal>
      {children ? <section className="advanced-context"><button className="export-button" onClick={() => setShowContext(true)} aria-expanded={showContext}>추억 · 월간 · 연간 맥락 더 보기 +</button></section> : null}
      <footer className="planner-footer"><span>도란도란 · Same team. Brighter tomorrow.</span><button onClick={() => { setShowConnections(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Google & Apple 연결 상태 ↗</button></footer>
    </div>
  </main>
}
