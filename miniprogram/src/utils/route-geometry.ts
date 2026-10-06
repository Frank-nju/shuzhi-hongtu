import { spotToWechatMapPoint, toWechatMapPoint } from './map-coordinates'

export type RouteGeometryPairs = Record<string, string>

export type RouteMapPoint = {
  latitude: number
  longitude: number
}

type RouteSpotPoint = {
  id: string
  lat: number
  lng: number
}

export type RoutePolyline = {
  points: RouteMapPoint[]
  color: string
  width: number
  dottedLine: boolean
  arrowLine: boolean
  borderColor: string
  borderWidth: number
}

export type RoutePolylineResult = {
  polylines: RoutePolyline[]
  includePoints: RouteMapPoint[]
  matchedSegments: number
  totalSegments: number
}

type GeometryLoaderOptions = {
  attempts?: number
  retryDelayMs?: number
}

export const routeGeometryKey = (left: { id: string }, right: { id: string }) => (
  [left.id, right.id].sort().join('|')
)

export function decodeRoutePolyline (encoded: string): RouteMapPoint[] {
  const points: RouteMapPoint[] = []
  let index = 0
  let latitude = 0
  let longitude = 0

  const decodeValue = () => {
    let result = 0
    let shift = 0
    while (index < encoded.length) {
      const byte = encoded.charCodeAt(index++) - 63
      if (byte < 0 || byte > 63 || shift > 30) throw new Error('路线编码无效')
      result |= (byte & 0x1f) << shift
      if (byte < 0x20) return (result & 1) ? ~(result >> 1) : result >> 1
      shift += 5
    }
    throw new Error('路线编码不完整')
  }

  while (index < encoded.length) {
    latitude += decodeValue()
    longitude += decodeValue()
    points.push({ latitude: latitude / 1e5, longitude: longitude / 1e5 })
  }

  return points
}

export function parseRouteGeometryPayload (raw: string): RouteGeometryPairs | null {
  try {
    const payload = JSON.parse(raw) as {
      version?: number
      encoding?: string
      pairs?: Record<string, unknown>
    }
    if (payload.version !== 1 || payload.encoding !== 'google-polyline-5' || !payload.pairs) return null
    for (const [key, value] of Object.entries(payload.pairs)) {
      if (!key.includes('|') || typeof value !== 'string' || value.length === 0) return null
      const points = decodeRoutePolyline(value)
      if (points.length < 2 || points.some((point) => (
        !Number.isFinite(point.latitude) ||
        !Number.isFinite(point.longitude) ||
        Math.abs(point.latitude) > 90 ||
        Math.abs(point.longitude) > 180
      ))) return null
    }
    return payload.pairs as RouteGeometryPairs
  } catch {
    return null
  }
}

export function createRouteGeometryLoader (
  fetchGeometry: () => Promise<RouteGeometryPairs | null>,
  options: GeometryLoaderOptions = {}
) {
  const attempts = Math.max(1, options.attempts ?? 2)
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? 350)
  let cache: RouteGeometryPairs | undefined
  let pending: Promise<RouteGeometryPairs | null> | null = null

  return async (): Promise<RouteGeometryPairs | null> => {
    if (cache) return cache
    if (pending) return pending

    pending = (async () => {
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          const result = await fetchGeometry()
          if (result) {
            cache = result
            return result
          }
        } catch {
          // 短暂网络或云存储错误会进入有限重试。
        }
        if (attempt < attempts - 1 && retryDelayMs > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, retryDelayMs))
        }
      }
      return null
    })().finally(() => {
      pending = null
    })

    return pending
  }
}

const pointDistance = (point: RouteMapPoint, spot: RouteSpotPoint) => (
  (point.latitude - spot.lat) ** 2 + (point.longitude - spot.lng) ** 2
)

const orientPoints = (points: RouteMapPoint[], from: RouteSpotPoint, to: RouteSpotPoint) => {
  const first = points[0]
  const last = points[points.length - 1]
  const forwardDistance = pointDistance(first, from) + pointDistance(last, to)
  const reverseDistance = pointDistance(first, to) + pointDistance(last, from)
  return reverseDistance < forwardDistance ? [...points].reverse() : points
}

const spotPoint = (spot: RouteSpotPoint): RouteMapPoint => spotToWechatMapPoint(spot)

export function buildRoutePolylines (
  spots: RouteSpotPoint[],
  geometryPairs: RouteGeometryPairs | null | undefined
): RoutePolylineResult {
  const polylines: RoutePolyline[] = []
  const spotPoints = spots.map(spotPoint)
  let north: RouteMapPoint | undefined
  let south: RouteMapPoint | undefined
  let east: RouteMapPoint | undefined
  let west: RouteMapPoint | undefined
  let matchedSegments = 0

  const includeInBounds = (point: RouteMapPoint) => {
    if (!north || point.latitude > north.latitude) north = point
    if (!south || point.latitude < south.latitude) south = point
    if (!east || point.longitude > east.longitude) east = point
    if (!west || point.longitude < west.longitude) west = point
  }

  spotPoints.forEach(includeInBounds)

  for (let index = 1; index < spots.length; index += 1) {
    const from = spots[index - 1]
    const to = spots[index]
    const encoded = geometryPairs?.[routeGeometryKey(from, to)]
    let roadPoints: RouteMapPoint[] = []

    if (encoded) {
      try {
        roadPoints = orientPoints(decodeRoutePolyline(encoded), from, to).map(toWechatMapPoint)
      } catch {
        roadPoints = []
      }
    }

    const hasRoadGeometry = roadPoints.length >= 2
    const points = hasRoadGeometry ? roadPoints : [spotPoint(from), spotPoint(to)]
    if (hasRoadGeometry) matchedSegments += 1
    points.forEach(includeInBounds)
    polylines.push({
      points,
      color: hasRoadGeometry ? '#DA291CDD' : '#DA291C88',
      width: hasRoadGeometry ? 5 : 3,
      dottedLine: !hasRoadGeometry,
      arrowLine: true,
      borderColor: '#fffaf7',
      borderWidth: 1
    })
  }

  const seenPoints = new Set<string>()
  const includePoints = [...spotPoints, north, south, east, west]
    .filter((point): point is RouteMapPoint => Boolean(point))
    .filter((point) => {
      const key = `${point.latitude.toFixed(6)}|${point.longitude.toFixed(6)}`
      if (seenPoints.has(key)) return false
      seenPoints.add(key)
      return true
    })

  return {
    polylines,
    includePoints,
    matchedSegments,
    totalSegments: Math.max(0, spots.length - 1)
  }
}
