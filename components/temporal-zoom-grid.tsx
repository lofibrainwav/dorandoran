import type { TemporalGridDisplayProjection } from '@/lib/family-os/temporal-grid'

export function TemporalZoomGrid({ grid }: { grid: TemporalGridDisplayProjection }) {
  const isMonth = grid.scale === 'month'
  return (
    <div className="temporal-grid-shell" data-scale={grid.scale} aria-label={`${grid.scale} family timeline`}>
      {isMonth ? (
        <div className="temporal-weekdays" aria-hidden="true">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
        </div>
      ) : null}
      <div className={isMonth ? 'temporal-grid temporal-grid--month' : 'temporal-grid temporal-grid--year'}>
        {grid.cells.map((cell) => (
          <div key={cell.id} className="temporal-cell" data-in-scope={cell.inScope}>
            <span>{cell.label}</span>
            {cell.observationCount > 0 ? <strong>{cell.observationCount}</strong> : <small>·</small>}
          </div>
        ))}
      </div>
    </div>
  )
}
