"use client"

import { useEffect, useRef } from 'react'
import { Map as MapLibreMap, Marker, Popup } from 'maplibre-gl'
import type { TimeScale } from '@/lib/family-os/zoom-contract'

type GlobePoint = { longitude: number; latitude: number; label: string }

const cameraByTime: Record<TimeScale, { center: [number, number]; zoom: number }> = {
  now: { center: [-118.24, 34.05], zoom: 8.5 },
  today: { center: [-118.24, 34.05], zoom: 7.8 },
  week: { center: [-118.24, 34.05], zoom: 6.0 },
  month: { center: [-119.5, 36.5], zoom: 4.0 },
  year: { center: [-98, 38], zoom: 2.6 },
  past: { center: [0, 22], zoom: 1.25 },
}

export function FamilyGlobe({
  timeScale,
  focusPoint,
  journeyPoints = [],
}: {
  timeScale: TimeScale
  focusPoint?: GlobePoint
  journeyPoints?: GlobePoint[]
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const journeyMarkerRefs = useRef<Marker[]>([])
  const initialTimeScale = useRef(timeScale)
  const initialFocusPoint = useRef(focusPoint)

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return
    const map = new MapLibreMap({
      container: hostRef.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: cameraByTime[initialTimeScale.current].center,
      zoom: cameraByTime[initialTimeScale.current].zoom,
      attributionControl: false,
      interactive: false,
    })
    map.setProjection({ type: 'globe' })
    if (initialFocusPoint.current) {
      markerRef.current = new Marker({ color: '#f0d68a' })
        .setLngLat([initialFocusPoint.current.longitude, initialFocusPoint.current.latitude])
        .setPopup(new Popup({ closeButton: false }).setText(initialFocusPoint.current.label))
        .addTo(map)
    }
    mapRef.current = map
    return () => {
      markerRef.current?.remove()
      journeyMarkerRefs.current.forEach((marker) => marker.remove())
      journeyMarkerRefs.current = []
      map.remove()
      markerRef.current = null
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const target = cameraByTime[timeScale]
    const showFocusMarker = timeScale === 'now' || timeScale === 'today' || timeScale === 'week'
    const markerElement = markerRef.current?.getElement()
    if (markerElement) markerElement.style.display = showFocusMarker ? '' : 'none'
    journeyMarkerRefs.current.forEach((marker) => {
      marker.getElement().style.display = timeScale === 'past' ? '' : 'none'
    })
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) map.jumpTo(target)
    else map.easeTo({ ...target, duration: 650 })
  }, [timeScale])

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
