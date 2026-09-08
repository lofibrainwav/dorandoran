"use client"

import { useEffect, useRef } from 'react'
import { Map as MapLibreMap, Marker, Popup } from 'maplibre-gl'
import { scheduleGlobeProjection } from '@/lib/client/maplibre-globe'
import type { TimeScale } from '@/lib/family-os/zoom-contract'
import { cameraForTimeScale, DEFAULT_HOUSEHOLD_HOME, type HouseholdHome } from '@/lib/family-os/household-home'

type GlobePoint = { longitude: number; latitude: number; label: string }


export function FamilyGlobe({
  timeScale,
  home = DEFAULT_HOUSEHOLD_HOME,
  focusPoint,
  journeyPoints = [],
}: {
  timeScale: TimeScale
  home?: HouseholdHome
  focusPoint?: GlobePoint
  journeyPoints?: GlobePoint[]
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const journeyMarkerRefs = useRef<Marker[]>([])
  const initialTimeScale = useRef(timeScale)
  const initialHome = useRef(home)
  const initialFocusPoint = useRef(focusPoint)

  useEffect(() => {
    const host = hostRef.current
    if (!host || mapRef.current) return

    const markUnavailable = () => {
      host.dataset.globeFallback = 'true'
    }

    let map: MapLibreMap
    try {
      map = new MapLibreMap({
        container: host,
        style: 'https://demotiles.maplibre.org/style.json',
        ...cameraForTimeScale(initialTimeScale.current, initialHome.current),
        attributionControl: false,
        interactive: false,
      })
    } catch {
      markUnavailable()
      return
    }

    mapRef.current = map
    let removed = false
    const removeMap = () => {
      if (removed) return
      removed = true
      markerRef.current?.remove()
      journeyMarkerRefs.current.forEach((marker) => marker.remove())
      journeyMarkerRefs.current = []
      map.remove()
      markerRef.current = null
      if (mapRef.current === map) mapRef.current = null
    }

    const cancelProjection = scheduleGlobeProjection(map, () => {
      markUnavailable()
      removeMap()
    })

    if (initialFocusPoint.current) {
      markerRef.current = new Marker({ color: '#f0d68a' })
        .setLngLat([initialFocusPoint.current.longitude, initialFocusPoint.current.latitude])
        .setPopup(new Popup({ closeButton: false }).setText(initialFocusPoint.current.label))
        .addTo(map)
    }

    return () => {
      cancelProjection()
      removeMap()
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const target = cameraForTimeScale(timeScale, home)
    const showFocusMarker = timeScale === 'now' || timeScale === 'today' || timeScale === 'week'
    const markerElement = markerRef.current?.getElement()
    if (markerElement) markerElement.style.display = showFocusMarker ? '' : 'none'
    journeyMarkerRefs.current.forEach((marker) => {
      marker.getElement().style.display = timeScale === 'past' ? '' : 'none'
    })
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) map.jumpTo(target)
    else map.easeTo({ ...target, duration: 650 })
  }, [timeScale, home])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!focusPoint) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }
    if (!markerRef.current) {
      markerRef.current = new Marker({ color: '#f0d68a' })
        .setLngLat([focusPoint.longitude, focusPoint.latitude])
        .setPopup(new Popup({ closeButton: false }).setText(focusPoint.label))
        .addTo(map)
      return
    }
    markerRef.current.setLngLat([focusPoint.longitude, focusPoint.latitude])
    markerRef.current.getPopup()?.setText(focusPoint.label)
  }, [focusPoint])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    journeyMarkerRefs.current.forEach((marker) => marker.remove())
    journeyMarkerRefs.current = journeyPoints.map((point) => {
      const marker = new Marker({ color: '#8aa4d6' })
        .setLngLat([point.longitude, point.latitude])
        .setPopup(new Popup({ closeButton: false }).setText(point.label))
        .addTo(map)
      marker.getElement().style.display = timeScale === 'past' ? '' : 'none'
      return marker
    })
  }, [journeyPoints, timeScale])

  return <div ref={hostRef} className="family-globe" aria-hidden="true" />
}
