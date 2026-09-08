"use client"

import { useEffect, useRef, useState } from 'react'
import { Map as MapLibreMap, Marker, Popup, NavigationControl } from 'maplibre-gl'
import { scheduleGlobeProjection } from '@/lib/client/maplibre-globe'
import { familyMapStyle } from '@/lib/client/family-map-style'
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
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')

  useEffect(() => {
    const host = hostRef.current
    if (!host || mapRef.current) return

    let failed = false
    const markUnavailable = () => {
      failed = true
      host.dataset.globeFallback = 'true'
      setStatus('unavailable')
    }

    let map: MapLibreMap
    try {
      map = new MapLibreMap({
        container: host,
        style: familyMapStyle(),
        ...cameraForTimeScale(initialTimeScale.current, initialHome.current),
        attributionControl: { compact: false },
        interactive: true,
        cooperativeGestures: true,
        // Map tiles need a valid referrer; disclose only this app's origin, never a private path.
        transformRequest: (url) => ({ url, referrerPolicy: 'origin' }),
      })
    } catch {
      markUnavailable()
      return
    }

    mapRef.current = map
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    const timeout = window.setTimeout(markUnavailable, 12000)
    map.on('load', () => {
      window.clearTimeout(timeout)
      if (failed) return
      delete host.dataset.globeFallback
      setStatus('ready')
      map.resize()
    })
    map.on('error', markUnavailable)
    const resizeObserver = new ResizeObserver(() => map.resize())
    resizeObserver.observe(host)
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
      window.clearTimeout(timeout)
      resizeObserver.disconnect()
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

  return <>
    <div ref={hostRef} className="family-globe" role="region" aria-label={`${home.label} family area map`} />
    {status !== 'ready' ? <div className="map-load-status" role="status">
      <strong>{status === 'loading' ? '지도를 불러오고 있어요' : '이 브라우저에서 지도를 표시하지 못했어요'}</strong>
      <span>{home.label} · 가족 생활권, 실시간 위치 아님</span>
      {status === 'unavailable' ? <a href={`https://www.google.com/maps/@${home.latitude},${home.longitude},11z`} target="_blank" rel="noreferrer">Google 지도에서 열기 ↗</a> : null}
    </div> : null}
  </>
}
