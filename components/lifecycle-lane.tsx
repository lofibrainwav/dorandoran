'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { PrivacyScope, JobMode, WorkState } from '@/lib/family-os/contracts'
import type { CandidateState } from '@/lib/family-os/lifecycle'
import { jobModeLabel } from '@/lib/family-os/lifecycle'
import { lifecycleErrorMessage } from '@/lib/family-os/lifecycle-ui-messages'
import {
  canDecideCandidate,
  candidateStateLabel,
  captureKindOptions,
  capturePrivacyScopeOptions,
  jobModeOptions,
  readbackEvidenceRef,
  readbackNoteMaxLength,
  scopeLabel,
  taskTransitionActions,
  visibleLaneMembers,
  workStateLabel,
  type LaneMember,
} from '@/lib/family-os/lifecycle-ui'

export interface LifecycleViewer {
  personId: string
  access: 'adult' | 'child'
}

export interface LifecycleLaneProps {
  viewer: LifecycleViewer
  members: LaneMember[]
}

interface LifecycleCandidate {
  id: string
  personId: string
  privacyScope: PrivacyScope
  version: number
  state: CandidateState
  opportunity: {
    title: string
    mode: JobMode
    estimatedMinutes?: number
  }
}

interface LifecycleTask {
  id: string
  personId: string
  privacyScope: PrivacyScope
  workState: WorkState
  version: number
  block: {
    reality: { title: string }
    people: { subjectIds: string[] }
  }
}

class LifecycleFetchError extends Error {
  code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

async function lifecycleFetch(path: string, init?: RequestInit): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
  } catch {
    throw new LifecycleFetchError('NETWORK_UNAVAILABLE')
  }
  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    data = null
  }
  if (!response.ok) {
    const code =
      data && typeof data === 'object' && 'error' in (data as Record<string, unknown>)
        ? String((data as { error: unknown }).error)
        : 'UNKNOWN'
    throw new LifecycleFetchError(code)
  }
  return data
}

function errorCodeOf(error: unknown): string {
  return error instanceof LifecycleFetchError ? error.code : 'UNKNOWN'
}

/** Renders every lifecycle error the same way: Korean message first, raw code always alongside it
 * (never alone) in a `<small>`. */
export function LifecycleErrorText({ code }: { code: string }) {
  const { message } = lifecycleErrorMessage(code)
  return (
    <p className="lifecycle-error planner-warning" role="alert">
      {message} <small>{code}</small>
    </p>
  )
}

/** Pure presentational card — decide buttons are gated entirely by the `canDecide` prop the
 * caller computes (client-side mirror of the server rule; the server re-checks regardless). */
export function CandidateCard({
  candidate,
  canDecide,
  busy,
  onAccept,
  onDecline,
}: {
  candidate: LifecycleCandidate
  canDecide: boolean
  busy: boolean
  onAccept: () => void
  onDecline: () => void
}) {
  return (
    <article className="lifecycle-candidate">
      <div className="lifecycle-candidate-main">
        <strong>{candidate.opportunity.title}</strong>
        <span className="lifecycle-badge">{jobModeLabel(candidate.opportunity.mode)}</span>
        {candidate.opportunity.estimatedMinutes != null ? (
          <span className="lifecycle-badge">{candidate.opportunity.estimatedMinutes}분</span>
        ) : null}
        <span className="lifecycle-badge">{scopeLabel(candidate.privacyScope)}</span>
        <span className="lifecycle-badge lifecycle-badge-state">{candidateStateLabel(candidate.state)}</span>
      </div>
      {candidate.state === 'proposed' && canDecide ? (
        <div className="lifecycle-candidate-actions">
          <button type="button" disabled={busy} onClick={onAccept}>수락</button>
          <button type="button" disabled={busy} onClick={onDecline}>거절</button>
        </div>
      ) : null}
    </article>
  )
}

/** Pure presentational row for one lane's own task list — the "완료" note affordance is fully
 * controlled by the caller so the component stays a plain function of its props. */
export function TaskRow({
  task,
  busy,
  doneNoteOpen,
  doneNoteValue,
  onTransition,
  onDoneNoteOpen,
  onDoneNoteChange,
  onDoneNoteConfirm,
  onDoneNoteCancel,
}: {
  task: LifecycleTask
  busy: boolean
  doneNoteOpen: boolean
  doneNoteValue: string
  onTransition: (next: WorkState) => void
  onDoneNoteOpen: () => void
  onDoneNoteChange: (value: string) => void
  onDoneNoteConfirm: () => void
  onDoneNoteCancel: () => void
}) {
  const actions = taskTransitionActions(task.workState)
  const executor = task.block.people.subjectIds[0] ?? '미배정'
  return (
    <article className="lifecycle-task">
      <div className="lifecycle-task-main">
        <strong>{task.block.reality.title}</strong>
        <span className="lifecycle-badge">{workStateLabel(task.workState)}</span>
        <span className="lifecycle-badge">{executor}</span>
      </div>
      <div className="lifecycle-task-actions">
        {actions.map((action) =>
          action.next === 'done' && doneNoteOpen ? null : (
            <button
              key={action.next}
              type="button"
              disabled={busy}
              onClick={action.next === 'done' ? onDoneNoteOpen : () => onTransition(action.next)}
            >
              {action.label}
            </button>
          ),
        )}
      </div>
      {doneNoteOpen ? (
        <div className="lifecycle-done-note">
          <label className="sr-only" htmlFor={`lifecycle-readback-${task.id}`}>완료 확인 한 줄</label>
          <input
            id={`lifecycle-readback-${task.id}`}
            value={doneNoteValue}
            maxLength={readbackNoteMaxLength(task.id)}
            placeholder="한 줄로 확인 — 무엇을 확인했는지"
            onChange={(event) => onDoneNoteChange(event.target.value)}
          />
          <button type="button" disabled={busy || !doneNoteValue.trim()} onClick={onDoneNoteConfirm}>완료 확인</button>
          <button type="button" disabled={busy} onClick={onDoneNoteCancel}>취소</button>
        </div>
      ) : null}
    </article>
  )
}

/** Read-only row for the family-wide projection. Renders exactly what the server returned —
 * never adds client-side filtering that could mask a server-side scope leak. */
export function FamilyTaskRow({ task }: { task: LifecycleTask }) {
  return (
    <li className="lifecycle-family-row">
      <strong>{task.block.reality.title}</strong>
      <span className="lifecycle-badge">{workStateLabel(task.workState)}</span>
      <span className="lifecycle-badge">{scopeLabel(task.privacyScope)}</span>
    </li>
  )
}

/** Groups the family projection by person label. Purely presentational — the grouping key is the
 * task's own `personId`, and the visible scope badge is whatever the server actually sent. */
export function FamilyTaskList({ tasks, members }: { tasks: LifecycleTask[]; members: LaneMember[] }) {
  if (!tasks.length) return <p className="lifecycle-empty">가족에게 공유된 할 일이 아직 없습니다.</p>
  const order: string[] = []
  const groups = new Map<string, LifecycleTask[]>()
  for (const task of tasks) {
    if (!groups.has(task.personId)) order.push(task.personId)
    const list = groups.get(task.personId) ?? []
    list.push(task)
    groups.set(task.personId, list)
  }
  return (
    <div className="lifecycle-family-groups">
      {order.map((personId) => (
        <section key={personId} className="lifecycle-family-group">
          <h3>{members.find((member) => member.personId === personId)?.label ?? personId}</h3>
          <ul>
            {(groups.get(personId) ?? []).map((task) => (
              <FamilyTaskRow key={task.id} task={task} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** A4 minimal UI: Capture (one line) → Candidate (accept/decline) → Task (work-state
 * transitions), plus a read-only family-wide view. No optimistic updates — every mutation
 * refetches the lists it touched; the server stays the sole source of truth. */
export function LifecycleLane({ viewer, members }: LifecycleLaneProps) {
  const lanes = useMemo(() => visibleLaneMembers(viewer, members), [viewer, members])
  const [selectedPerson, setSelectedPerson] = useState(viewer.personId)
  const isOwnLane = selectedPerson === viewer.personId
  const targetAccess = members.find((member) => member.personId === selectedPerson)?.access
  const canDecideHere = canDecideCandidate({
    viewerPersonId: viewer.personId,
    viewerAccess: viewer.access,
    targetPersonId: selectedPerson,
    targetAccess,
  })
  const scopeOptions = useMemo(() => capturePrivacyScopeOptions(isOwnLane, viewer.access), [isOwnLane, viewer.access])

  const [captureText, setCaptureText] = useState('')
  const [captureKind, setCaptureKind] = useState<'want' | 'decision' | 'fact' | 'question'>('want')
  const [captureScope, setCaptureScope] = useState<PrivacyScope>('family')
  const [proposeChecked, setProposeChecked] = useState(false)
  const [proposeMode, setProposeMode] = useState<JobMode>('digital')
  const [proposeMinutes, setProposeMinutes] = useState(30)
  const [captureBusy, setCaptureBusy] = useState(false)
  const [captureNotice, setCaptureNotice] = useState<{ text: string; code?: string } | null>(null)

  // Keyed by the lane they belong to, rather than reset with a synchronous `setState` at the top
  // of the fetch effect (which would trigger a cascading extra render) — a lane switch is instead
  // recognized in render by comparing `person` against `selectedPerson`, and treated as "loading"
  // until the matching response for the *current* lane lands.
  const [candidatesState, setCandidatesState] = useState<{ person: string; data: LifecycleCandidate[] | null; error: string | null }>(
    { person: viewer.personId, data: null, error: null },
  )
  const [decideBusy, setDecideBusy] = useState<Record<string, boolean>>({})

  const [tasksState, setTasksState] = useState<{ person: string; data: LifecycleTask[] | null; error: string | null }>(
    { person: viewer.personId, data: null, error: null },
  )
  const [transitionBusy, setTransitionBusy] = useState<Record<string, boolean>>({})
  const [doneNoteOpenId, setDoneNoteOpenId] = useState<string | null>(null)
  const [doneNoteValue, setDoneNoteValue] = useState('')

  const [familyMode, setFamilyMode] = useState(false)
  const [familyState, setFamilyState] = useState<{ data: LifecycleTask[] | null; error: string | null }>({ data: null, error: null })

  const candidates = candidatesState.person === selectedPerson ? candidatesState.data : null
  const candidatesError = candidatesState.person === selectedPerson ? candidatesState.error : null
  const tasks = tasksState.person === selectedPerson ? tasksState.data : null
  const tasksError = tasksState.person === selectedPerson ? tasksState.error : null
  const familyTasks = familyMode ? familyState.data : null
  const familyError = familyMode ? familyState.error : null

  async function fetchCandidatesFor(personId: string) {
    try {
      const data = (await lifecycleFetch(`/api/lifecycle/candidates?person=${encodeURIComponent(personId)}`)) as {
        candidates: LifecycleCandidate[]
      }
      return { person: personId, data: data.candidates, error: null }
    } catch (error) {
      return { person: personId, data: [], error: errorCodeOf(error) }
    }
  }

  async function fetchTasksFor(personId: string) {
    try {
      const data = (await lifecycleFetch(`/api/lifecycle/tasks?person=${encodeURIComponent(personId)}`)) as {
        tasks: LifecycleTask[]
      }
      return { person: personId, data: data.tasks, error: null }
    } catch (error) {
      return { person: personId, data: [], error: errorCodeOf(error) }
    }
  }

  useEffect(() => {
    let cancelled = false
    const personId = selectedPerson
    void fetchCandidatesFor(personId).then((result) => {
      if (!cancelled) setCandidatesState(result)
    })
    void fetchTasksFor(personId).then((result) => {
      if (!cancelled) setTasksState(result)
    })
    return () => {
      cancelled = true
    }
  }, [selectedPerson])

  useEffect(() => {
    if (!familyMode) return
    let cancelled = false
    async function run() {
      try {
        const data = (await lifecycleFetch('/api/lifecycle/tasks?scope=family')) as { tasks: LifecycleTask[] }
        if (!cancelled) setFamilyState({ data: data.tasks, error: null })
      } catch (error) {
        if (!cancelled) setFamilyState({ data: [], error: errorCodeOf(error) })
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [familyMode])

  async function refreshLane() {
    const [candidateResult, taskResult] = await Promise.all([
      fetchCandidatesFor(selectedPerson),
      fetchTasksFor(selectedPerson),
    ])
    setCandidatesState(candidateResult)
    setTasksState(taskResult)
  }

  async function submitCapture(event: FormEvent) {
    event.preventDefault()
    if (captureBusy) return
    const trimmed = captureText.trim()
    if (!trimmed) return
    setCaptureBusy(true)
    setCaptureNotice(null)
    try {
      const body: Record<string, unknown> = {
        personId: selectedPerson,
        privacyScope: captureScope,
        kind: captureKind,
        statedText: trimmed,
        source: 'human',
      }
      if (proposeChecked) {
        body.propose = { mode: proposeMode, estimatedMinutes: proposeMinutes }
      }
      const result = (await lifecycleFetch('/api/lifecycle/capture', {
        method: 'POST',
        body: JSON.stringify(body),
      })) as { candidate?: unknown }
      setCaptureText('')
      setProposeChecked(false)
      setCaptureNotice({ text: result.candidate ? '기록됨 · 후보 생성' : '기록됨' })
      await refreshLane()
    } catch (error) {
      const code = errorCodeOf(error)
      setCaptureNotice({ text: lifecycleErrorMessage(code).message, code })
    } finally {
      setCaptureBusy(false)
    }
  }

  async function decide(candidate: LifecycleCandidate, kind: 'accept' | 'decline') {
    if (decideBusy[candidate.id]) return
    setDecideBusy((prev) => ({ ...prev, [candidate.id]: true }))
    try {
      await lifecycleFetch(`/api/lifecycle/candidates/${candidate.id}/decide`, {
        method: 'POST',
        body: JSON.stringify({ personId: selectedPerson, kind, expectedVersion: candidate.version }),
      })
      setCaptureNotice(kind === 'accept' ? { text: '수락됨 → 할 일' } : { text: '거절됨' })
      await refreshLane()
    } catch (error) {
      setCandidatesState((prev) => ({ ...prev, person: selectedPerson, error: errorCodeOf(error) }))
    } finally {
      setDecideBusy((prev) => ({ ...prev, [candidate.id]: false }))
    }
  }

  async function transition(task: LifecycleTask, next: WorkState, readbackNote?: string) {
    if (transitionBusy[task.id]) return
    setTransitionBusy((prev) => ({ ...prev, [task.id]: true }))
    try {
      const body: Record<string, unknown> = { personId: selectedPerson, next, expectedVersion: task.version }
      if (next === 'done') {
        body.readbackEvidenceRefs = [readbackEvidenceRef(task.id, readbackNote ?? '')]
      }
      await lifecycleFetch(`/api/lifecycle/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      setDoneNoteOpenId(null)
      setDoneNoteValue('')
      setTasksState(await fetchTasksFor(selectedPerson))
    } catch (error) {
      setTasksState((prev) => ({ ...prev, person: selectedPerson, error: errorCodeOf(error) }))
    } finally {
      setTransitionBusy((prev) => ({ ...prev, [task.id]: false }))
    }
  }

  return (
    <div className="lifecycle-lane">
      <div className="lifecycle-lane-tabs" role="tablist" aria-label="사람 lane">
        {lanes.map((lane) => (
          <button
            key={lane.personId}
            type="button"
            role="tab"
            aria-selected={lane.personId === selectedPerson}
            className={`lifecycle-lane-tab${lane.personId === selectedPerson ? ' is-active' : ''}`}
            onClick={() => {
              setSelectedPerson(lane.personId)
              setDoneNoteOpenId(null)
              setDoneNoteValue('')
            }}
          >
            {lane.label}
          </button>
        ))}
      </div>

      <form className="lifecycle-capture" onSubmit={submitCapture}>
        <label className="sr-only" htmlFor="lifecycle-capture-text">한 줄 기록</label>
        <input
          id="lifecycle-capture-text"
          value={captureText}
          maxLength={2000}
          placeholder="한 줄로 적기 — 하고 싶은 것 / 결정한 것 / 사실"
          onChange={(event) => setCaptureText(event.target.value)}
        />
        <select aria-label="종류" value={captureKind} onChange={(event) => setCaptureKind(event.target.value as typeof captureKind)}>
          {captureKindOptions().map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select aria-label="범위" value={captureScope} onChange={(event) => setCaptureScope(event.target.value as PrivacyScope)}>
          {scopeOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <label className="lifecycle-propose-toggle">
          <input type="checkbox" checked={proposeChecked} onChange={(event) => setProposeChecked(event.target.checked)} />
          후보로 올리기
        </label>
        {proposeChecked ? (
          <span className="lifecycle-propose-fields">
            <select aria-label="모드" value={proposeMode} onChange={(event) => setProposeMode(event.target.value as JobMode)}>
              {jobModeOptions().map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input
              aria-label="소요 시간(분)"
              type="number"
              min={5}
              max={1440}
              value={proposeMinutes}
              onChange={(event) => setProposeMinutes(Number(event.target.value))}
            />
          </span>
        ) : null}
        <button type="submit" disabled={captureBusy || !captureText.trim()}>기록</button>
      </form>
      {captureNotice ? (
        captureNotice.code ? (
          <LifecycleErrorText code={captureNotice.code} />
        ) : (
          <p role="status" className="planner-message">{captureNotice.text}</p>
        )
      ) : null}

      <section className="lifecycle-section" aria-label="후보">
        <p className="eyebrow">후보</p>
        {candidatesError ? <LifecycleErrorText code={candidatesError} /> : null}
        {candidates === null ? (
          <p className="lifecycle-empty">후보를 확인하고 있어요…</p>
        ) : candidates.length === 0 ? (
          <p className="lifecycle-empty">아직 후보가 없습니다.</p>
        ) : (
          <div className="lifecycle-candidate-list">
            {candidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                canDecide={canDecideHere}
                busy={!!decideBusy[candidate.id]}
                onAccept={() => decide(candidate, 'accept')}
                onDecline={() => decide(candidate, 'decline')}
              />
            ))}
          </div>
        )}
      </section>

      <section className="lifecycle-section" aria-label="할 일">
        <p className="eyebrow">할 일</p>
        {tasksError ? <LifecycleErrorText code={tasksError} /> : null}
        {tasks === null ? (
          <p className="lifecycle-empty">할 일을 확인하고 있어요…</p>
        ) : tasks.length === 0 ? (
          <p className="lifecycle-empty">아직 할 일이 없습니다.</p>
        ) : (
          <div className="lifecycle-task-list">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                busy={!!transitionBusy[task.id]}
                doneNoteOpen={doneNoteOpenId === task.id}
                doneNoteValue={doneNoteOpenId === task.id ? doneNoteValue : ''}
                onTransition={(next) => transition(task, next)}
                onDoneNoteOpen={() => {
                  setDoneNoteOpenId(task.id)
                  setDoneNoteValue('')
                }}
                onDoneNoteChange={setDoneNoteValue}
                onDoneNoteConfirm={() => transition(task, 'done', doneNoteValue)}
                onDoneNoteCancel={() => {
                  setDoneNoteOpenId(null)
                  setDoneNoteValue('')
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section className="lifecycle-section lifecycle-family-section" aria-label="가족 보기">
        <button
          type="button"
          className="lifecycle-family-toggle"
          aria-expanded={familyMode}
          onClick={() => setFamilyMode((value) => !value)}
        >
          가족 보기 {familyMode ? '닫기 −' : '+'}
        </button>
        {familyMode ? (
          <>
            {familyError ? <LifecycleErrorText code={familyError} /> : null}
            {familyTasks === null ? (
              <p className="lifecycle-empty">가족 할 일을 확인하고 있어요…</p>
            ) : (
              <FamilyTaskList tasks={familyTasks} members={members} />
            )}
          </>
        ) : null}
      </section>
    </div>
  )
}
