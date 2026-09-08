export interface GlobeProjectionMap {
  isStyleLoaded(): boolean | void
  setProjection(projection: { type: 'globe' }): unknown
  once(event: 'style.load', listener: () => void): unknown
  off?(event: 'style.load', listener: () => void): unknown
}

export function scheduleGlobeProjection(
  map: GlobeProjectionMap,
  onError: (error: unknown) => void,
): () => void {
  let active = true
  const applyProjection = () => {
    if (!active) return
    try {
      map.setProjection({ type: 'globe' })
    } catch (error) {
      onError(error)
    }
  }

  if (map.isStyleLoaded()) applyProjection()
  else map.once('style.load', applyProjection)

  return () => {
    active = false
    map.off?.('style.load', applyProjection)
  }
}
