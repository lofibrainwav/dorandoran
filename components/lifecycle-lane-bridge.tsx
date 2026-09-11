'use client'

import { useEffect, useState } from 'react'
import { LifecycleLane, type LifecycleLaneProps, type LifecycleViewer } from '@/components/lifecycle-lane'

interface LifecycleLaneBridgeProps {
  initialViewer: LifecycleViewer | null
  members: LifecycleLaneProps['members']
}

/**
 * Keeps the page shell truthful when the server component cannot read the same
 * household cookie path as the lifecycle API. The API remains the authority.
 */
export function LifecycleLaneBridge({ initialViewer, members }: LifecycleLaneBridgeProps) {
  const [viewer, setViewer] = useState<LifecycleViewer | null>(initialViewer)

  useEffect(() => {
    if (initialViewer || viewer) return
    let cancelled = false
    fetch('/api/lifecycle/viewer', {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
      .then(async (response) => {
        if (!response.ok) return
        const data = (await response.json()) as { viewer?: LifecycleViewer }
        if (!cancelled && data.viewer) setViewer(data.viewer)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [initialViewer, viewer])

  if (!viewer) return null

  return (
    <section className="lifecycle-lane-section">
      <p className="eyebrow">CAPTURE → CANDIDATE → TASK</p>
      <p className="lifecycle-lane-note">사람이 수락한 것만 할 일이 됩니다.</p>
      <LifecycleLane viewer={viewer} members={members} />
    </section>
  )
}
