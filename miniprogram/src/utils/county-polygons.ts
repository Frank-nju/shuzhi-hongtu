import type { Spot } from '@shared/domain'
import { JIANGXI_COUNTIES } from '../../../app/jiangxi-counties'
import { toWechatMapPoint } from './map-coordinates'

const JIANGXI_BOUNDS = {
  minLng: 113.45,
  maxLng: 118.55,
  minLat: 24.35,
  maxLat: 30.15,
  width: 1000,
  height: 560
}

type GeoPoint = { latitude: number; longitude: number }

const svgPointToGeo = (x: number, y: number): GeoPoint => toWechatMapPoint({
  longitude: JIANGXI_BOUNDS.minLng + (x / JIANGXI_BOUNDS.width) * (JIANGXI_BOUNDS.maxLng - JIANGXI_BOUNDS.minLng),
  latitude: JIANGXI_BOUNDS.maxLat - (y / JIANGXI_BOUNDS.height) * (JIANGXI_BOUNDS.maxLat - JIANGXI_BOUNDS.minLat)
})

function pathToRings (path: string): GeoPoint[][] {
  const tokens = path.match(/[MLZ]|-?\d+(?:\.\d+)?/g) ?? []
  const rings: GeoPoint[][] = []
  let ring: GeoPoint[] = []

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token === 'M') {
      if (ring.length >= 3) rings.push(ring)
      ring = []
    }
    if (token === 'M' || token === 'L') {
      const x = Number(tokens[index + 1])
      const y = Number(tokens[index + 2])
      index += 2
      if (Number.isFinite(x) && Number.isFinite(y)) ring.push(svgPointToGeo(x, y))
    }
    if (token === 'Z') {
      if (ring.length >= 3) rings.push(ring)
      ring = []
    }
  }
  if (ring.length >= 3) rings.push(ring)
  return rings
}

export function coverageCountyNames (spots: Spot[]): string[] {
  return Array.from(new Set(spots.map((spot) => spot.county)))
}

export function countyPolygons (spots: Spot[]) {
  const active = new Set(coverageCountyNames(spots))
  return JIANGXI_COUNTIES
    .filter((county) => active.has(county.name))
    .flatMap((county) => pathToRings(county.d).map((points) => ({
      points,
      strokeColor: '#7B1419EE',
      strokeWidth: 2,
      fillColor: '#DA291C55',
      zIndex: 1
    })))
}
