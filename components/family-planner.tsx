'use client'

import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { FamilyGlobe } from './family-globe'
import { DAY_PERIODS, minuteClock, parsePlannerMemo, schedulePlannerWishes, exportTimeboxes, type FamilyPlannerModel, type PlannedTimebox, type PlannerEvent } from '@/lib/family-os/family-planner'
import type { HouseholdHome } from '@/lib/family-os/household-home'

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

const ownerLabel = { child: 'Jayden', adult: '보호자', family: '가족 · 대상 미배정' }

export function FamilyPlanner({ model: initialModel, home, appleStatus, learningStatus, children }: {
  model: FamilyPlannerModel; home: HouseholdHome; appleStatus: string; learningStatus: string; children?: ReactNode
}) {
  const [freshModel, setFreshModel] = useState<FamilyPlannerModel | null>(null)
  const [busy, setBusy] = useState(false)
  const model = freshModel ?? initialModel
  const key = `dorandoran-week-planner:${model.weekStart}`
  const raw = useSyncExternalStore(subscribe, () => { try { return localStorage.getItem(key) ?? '' } catch { return '' } }, () => '')
  const saved = useMemo(() => readSaved(raw), [raw])
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState<PlannerEvent | null>(null)
  const [showConnections, setShowConnections] = useState(false)
  const [showContext, setShowContext] = useState(false)
  const [completed, setCompleted] = useState<Record<string, boolean>>({})
  const wishes = useMemo(() => parsePlannerMemo(saved.memo).map((wish) => ({ ...wish, minutes: saved.durations[wish.id] ?? wish.minutes })), [saved])
  const plans = saved.plans
  const collision = (plan: PlannedTimebox) => !model.known || !model.days.some((day) => day.date === plan.date && day.gaps.some((gap) => plan.startMinute >= gap.startMinute && plan.startMinute + plan.minutes <= gap.endMinute))
  const collidingPlans = plans.filter(collision)
  const attention = model.days.reduce((sum, day) => sum + day.notices.length, 0)
  const next = model.days.filter((day) => !day.past).flatMap((day) => day.events).find((event) => !event.allDay)
  function save(value: Saved) {
    try { localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new Event('family-planner-change')) }
    catch { setMessage('이 브라우저에 저장할 수 없습니다. 저장 공간 설정을 확인해 주세요.') }
  }
  async function refresh(): Promise<FamilyPlannerModel | null> {
    setBusy(true)
    setMessage('기존 Google 일정을 다시 확인하고 있어요…')
    try {
      const response = await fetch('/api/planner/availability', { cache: 'no-store', signal: AbortSignal.timeout(20000) })
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
  const dateRange = `${model.days[0].date.slice(5).replace('-', '.')} — ${model.days[6].date.slice(5).replace('-', '.')}`

  return <main className="family-planner">
    <div className="planner-shell">
      <header className="planner-header">
        <a className="planner-brand" href="/family"><span className="brand-sun" aria-hidden="true">✺</span><span>도란도란<small>OUR FAMILY, A LITTLE CLOSER</small></span></a>
        <div className="planner-header-actions"><span className="planner-week-label">FAMILY OS / {model.weekStart.slice(0, 4)}</span><button onClick={() => setShowConnections((value) => !value)} aria-expanded={showConnections} className="connection-button"><span className={model.known ? 'status-dot' : 'status-dot status-dot--amber'} /> 연결된 생활 <span>↗</span></button></div>
      </header>
      <section className="planner-intro">
        <div><p className="eyebrow">SMALL STEPS. BRIGHTER DAYS.</p><h1>우리 가족의 한 주,<br /><em>함께 여유롭게.</em></h1><p className="intro-copy">해야 할 일도, 하고 싶은 일도.<br className="mobile-only" /> 메모해 두면 우리 일정 사이에 자리를 찾아요.</p></div>
        <aside className="planner-map"><div className="map-heading"><span>⌖ {home.label}</span><small>가족 생활권 · 실시간 위치 아님</small></div><div className="planner-map-canvas"><FamilyGlobe timeScale="today" home={home} /></div></aside>
      </section>
      {showConnections ? <section className="connection-panel" aria-label="연결 상태">
        <article><strong>Google Calendar</strong><span>{model.known ? '실제 일정 읽음 · 기존 일정 고정' : '일정을 확인할 수 없음 · 자동 배치 중지'}</span><p>연결된 가족 운영 캘린더를 기준으로 합니다. 개인별 다른 캘린더까지 비어 있다는 뜻은 아닙니다.</p></article>
        <article><strong>Apple 생태계</strong><span>{appleStatus}</span><p>Photos는 허용된 로컬 스냅샷 경로입니다. Apple Calendar·미리 알림·실시간 위치의 서버 동기화는 아직 연결되지 않았습니다.</p></article>
        <article><strong>학습·할 일</strong><span>{learningStatus}</span><p>메모는 이 브라우저에 보관합니다. Google Tasks·Gmail·Apple 미리 알림의 할 일을 자동으로 읽는 연결은 아직 없습니다.</p></article>
      </section> : null}
      <div className="family-legend" aria-label="가족과 역할">
        <span className="legend-child"><i>J</i><b>Jayden<small>배우고 자라기</small></b></span><span className="legend-parent"><i>J</i><b>Julie<small>준비와 조율</small></b></span><span className="legend-physical"><i>J</i><b>Jay<small>이동과 실행</small></b></span><span className="legend-chad"><i>✦</i><b>Chad<small>계획 도우미</small></b></span><span className="legend-together"><i>♡</i><b>Together<small>함께하는 시간</small></b></span>
        <div className="legend-key"><span>▣ 캘린더 고정</span><span>┄ 새 계획</span></div>
      </div>
      <div className="planner-workspace">
        <aside className="memo-panel" aria-label="우리 가족 메모">
          <div className="memo-heading"><span>✎</span><div><h2>일단, 적어두세요.</h2><p>해야 하는 일 · 하고 싶은 일</p></div></div>
          <label className="sr-only" htmlFor="family-memo">가족 할 일 메모</label>
          <textarea id="family-memo" maxLength={10000} value={saved.memo} onChange={(event) => save({ ...saved, memo: event.target.value, durations: {} })} placeholder={'한 줄에 하나씩 편하게 적어보세요\n\n예) 해야 할 학교 준비 20분\n@Jayden 책 읽기 30분\n함께 산책 40분\n쥴리와 이야기 나누기'} />
          <p className="memo-hint">시간을 적지 않으면 <b>30분 예상</b>으로 시작해요. 아래에서 바꿀 수 있어요.</p>
          {wishes.length ? <div className="wish-list">{wishes.map((wish) => <label key={wish.id} className="wish-row"><span><b>{wish.required ? '해야' : '하고 싶어'}</b>{wish.title}<small>{wish.estimated && !saved.durations[wish.id] ? '예상 시간 · 확인해 주세요' : wish.owner}</small></span><input aria-label={`${wish.title} 소요시간`} type="number" min="5" max="900" step="5" value={wish.minutes} onChange={(event) => save({ ...saved, durations: { ...saved.durations, [wish.id]: Number(event.target.value) } })} /><small>분</small></label>)}</div> : <div className="memo-empty"><span>〰</span><p>머릿속에 있던 것들을<br />여기에 내려놓으세요.</p></div>}
          <button className="auto-plan-button" disabled={!model.known || !wishes.length} onClick={arrange}>✦ {plans.length ? '시간표 다시 짜기' : '빈 시간에 자동 배치'} <span>→</span></button>
          <p className="memo-policy">기존 일정 앞뒤 15분 여유 · 할 일 사이 10분 쉼<br />필수 항목 우선 · 종일 일정이 있는 날은 자동 배치 제외</p>
          <p className="local-note">이 브라우저에 저장 · 가족 계정 간 동기화 전</p>
        </aside>
        <section className="week-panel" aria-label="이번 주 타임박스 플래너">
          <div className="week-toolbar"><div><p className="eyebrow">OUR WEEK</p><h2>이번 주 캘린더 <span>{dateRange}</span></h2></div><button className="export-button" onClick={download} disabled={!plans.length || !model.known || !!collidingPlans.length}>계획 내보내기 ↗</button></div>
          <div className="week-summary"><span><i className="status-dot" />{model.known ? `${model.eventCount}개 실제 일정` : '일정 확인 필요'}</span><span>{plans.length}개 새 계획</span><span>{attention ? `${attention}곳 시간 조율 확인` : '일정 사이에 여유를 남겨요'}</span></div>
          <p role="status" aria-live="polite" className={message ? 'planner-message' : 'planner-message-empty'}>{message}</p>
          {collidingPlans.length ? <p className="planner-warning">⚠ 일정이 바뀌었거나 이미 지난 시간이 포함된 계획 {collidingPlans.length}개가 있습니다. 다시 배치해 주세요.</p> : null}
          {!model.known ? <p className="planner-warning">일정이 확인되지 않아 빈 시간으로 간주하지 않습니다. 연결을 확인하면 자동 배치할 수 있어요.</p> : null}
          <div className="week-scroll"><div className="timebox-grid">
            <div className="grid-corner">TIME</div>{model.days.map((day) => <div key={day.date} className={`day-heading ${day.today ? 'is-today' : ''}`}><span>{day.weekday}</span><strong>{day.dayNumber}</strong>{day.today ? <small>TODAY</small> : null}</div>)}
            <div className="period-label all-day-label">종일</div>{model.days.map((day) => <div className="all-day-cell" key={`all-${day.date}`}>{day.events.filter((event) => event.allDay).map((event) => <button key={event.id} className="all-day-event" onClick={() => setSelected(event)}>{event.title}</button>)}{day.notices.length ? <span className="day-notice">△ {day.notices.some((notice) => notice.kind === 'overlap') ? '겹치는 시간 확인' : `${day.notices[0].minutes}분 전환 · 확인`}</span> : null}</div>)}
            {DAY_PERIODS.map((period) => <div className="period-row" key={period.id}><div className="period-label"><span>{period.icon}</span><b>{period.label}</b><small>{minuteClock(period.start)}<br />{minuteClock(period.end)}</small></div>{model.days.map((day) => {
              const events = day.events.filter((event) => !event.allDay && event.startMinute < period.end && event.endMinute > period.start)
              const dayPlans = plans.filter((plan) => plan.date === day.date && plan.startMinute >= period.start && plan.startMinute < period.end)
              const gap = day.gaps.find((item) => item.startMinute >= period.start && item.startMinute < period.end)
              return <div key={day.date} className={`timebox-cell ${day.past ? 'is-past' : ''} ${day.today ? 'is-today' : ''}`}>{events.map((event) => <button key={event.id} className={`calendar-block block-${event.owner}`} onClick={() => setSelected(event)}><span className="block-time">{event.continued || event.startMinute < period.start ? '이어지는 일정' : `${minuteClock(event.startMinute)}–${minuteClock(event.endMinute)}`} <i>▣</i></span><strong>{event.title}</strong><small>{ownerLabel[event.owner]}</small></button>)}{dayPlans.map((plan) => <article key={plan.id} className={`draft-block ${collision(plan) ? 'draft-conflict' : ''}`}><span>{minuteClock(plan.startMinute)}–{minuteClock(plan.startMinute + plan.minutes)} · 계획</span><strong>{plan.title}</strong><small>{plan.owner}</small><button aria-label={`${plan.title} 계획 삭제`} onClick={() => save({ ...saved, plans: plans.filter((p) => p.id !== plan.id) })}>×</button></article>)}{gap && !dayPlans.length ? <div className="gap-block"><span>＋</span><b>{gap.minutes}분의 여유</b><small>{minuteClock(gap.startMinute)}–{minuteClock(gap.endMinute)}</small><p>{wishes.length ? '메모를 자동 배치해 보세요' : '하고 싶은 일을 적어보세요'}</p></div> : !events.length && !dayPlans.length ? <span className="quiet-cell">{day.past ? '지나간 시간' : model.known ? '일정과 함께 조율' : '확인 필요'}</span> : null}</div>
            })}</div>)}
          </div></div>
          <p className="calendar-footnote">▣ 기존 Google Calendar 일정은 고정됩니다. 새 계획은 내보내기 후 캘린더에서 가져오면 반영됩니다. 여유 시간은 연결된 캘린더 기준이며 가족 모두의 가용성을 확정하지 않습니다.</p>
        </section>
      </div>
      <section className="action-section" aria-label="일정에서 준비까지">
        <div className="action-title"><span>↳</span><div><p className="eyebrow">FROM CALENDAR TO CARE</p><h2>하나의 일정, 함께 준비하는 작은 일들.</h2><p>캘린더 블록을 누르면 그 일정의 준비를 확인할 수 있어요.</p></div></div>
        <div className="action-layout"><article className="selected-event"><small>{selected ? '선택한 일정' : '다가오는 일정'}</small><h3>{(selected ?? next)?.title ?? '확인된 다음 일정이 없습니다'}</h3><p>{(selected ?? next) ? `${(selected ?? next)!.date} · ${minuteClock((selected ?? next)!.startMinute)}` : '새 일정을 확인하면 여기에 표시됩니다.'}</p>{(selected ?? next)?.place ? <><span>{(selected ?? next)!.place}</span><div className="map-links"><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((selected ?? next)!.place!)}`} target="_blank" rel="noreferrer">Google 지도 ↗</a><a href={`https://maps.apple.com/?q=${encodeURIComponent((selected ?? next)!.place!)}`} target="_blank" rel="noreferrer">Apple 지도 ↗</a></div></> : <small>예정 장소 미확인</small>}</article>
          {[{ label: '준비', who: '함께 확인', items: ['필요한 준비물이 있는지 확인', '맡을 사람과 준비 시간 정하기'] }, { label: '이동', who: '이동 담당 확인', items: ['예정 장소와 출발 시각 확인', '앞 일정과의 이동 여유 확인'] }, { label: '가족', who: '서로 맞춰보기', items: ['다른 가족의 개인 일정 확인', '일정 뒤 휴식 시간 남기기'] }].map((group) => <article className="preparation-card" key={group.label}><div><h3>{group.label}</h3><small>{group.who} · 제안</small></div>{group.items.map((item) => { const id = `${(selected ?? next)?.id ?? 'none'}-${item}`; return <label key={item}><input type="checkbox" disabled={!(selected ?? next)} checked={!!completed[id]} onChange={(event) => setCompleted({ ...completed, [id]: event.target.checked })} /><span>{item}</span></label> })}</article>)}
        </div><p className="preparation-note">준비 항목은 확인을 돕는 제안이며, 원본 일정에서 확인된 지시나 담당자 배정이 아닙니다.</p>
      </section>
      {children ? <section className="advanced-context"><button className="export-button" onClick={() => setShowContext((value) => !value)} aria-expanded={showContext}>추억 · 월간 · 연간 맥락 {showContext ? '닫기 −' : '더 보기 +'}</button>{showContext ? children : null}</section> : null}
      <footer className="planner-footer"><span>도란도란 · Same team. Brighter tomorrow.</span><button onClick={() => { setShowConnections(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Google & Apple 연결 상태 ↗</button></footer>
    </div>
  </main>
}
