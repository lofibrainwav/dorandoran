export interface RouteCoordinate {
  latitude: number
  longitude: number
}

export interface ScheduledPlaceIdentity {
  id: string
  label: string
  coordinates?: RouteCoordinate
}
