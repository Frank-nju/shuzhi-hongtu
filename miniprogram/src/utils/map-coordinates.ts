export type MapCoordinate = {
  latitude: number
  longitude: number
}

type SpotCoordinate = {
  lat: number
  lng: number
}

const PI = Math.PI
const EARTH_AXIS = 6378245
const ECCENTRICITY = 0.006693421622965943

const outsideChina = ({ latitude, longitude }: MapCoordinate) => (
  longitude < 72.004 || longitude > 137.8347 || latitude < 0.8293 || latitude > 55.8271
)

const latitudeOffset = (longitude: number, latitude: number) => {
  let result = -100 + 2 * longitude + 3 * latitude + 0.2 * latitude ** 2 +
    0.1 * longitude * latitude + 0.2 * Math.sqrt(Math.abs(longitude))
  result += (20 * Math.sin(6 * longitude * PI) + 20 * Math.sin(2 * longitude * PI)) * 2 / 3
  result += (20 * Math.sin(latitude * PI) + 40 * Math.sin(latitude * PI / 3)) * 2 / 3
  result += (160 * Math.sin(latitude * PI / 12) + 320 * Math.sin(latitude * PI / 30)) * 2 / 3
  return result
}

const longitudeOffset = (longitude: number, latitude: number) => {
  let result = 300 + longitude + 2 * latitude + 0.1 * longitude ** 2 +
    0.1 * longitude * latitude + 0.1 * Math.sqrt(Math.abs(longitude))
  result += (20 * Math.sin(6 * longitude * PI) + 20 * Math.sin(2 * longitude * PI)) * 2 / 3
  result += (20 * Math.sin(longitude * PI) + 40 * Math.sin(longitude * PI / 3)) * 2 / 3
  result += (150 * Math.sin(longitude * PI / 12) + 300 * Math.sin(longitude * PI / 30)) * 2 / 3
  return result
}

export function toWechatMapPoint (point: MapCoordinate): MapCoordinate {
  if (outsideChina(point)) return point

  const offsetLongitude = point.longitude - 105
  const offsetLatitude = point.latitude - 35
  const latitudeRadians = point.latitude / 180 * PI
  const sine = Math.sin(latitudeRadians)
  const magic = 1 - ECCENTRICITY * sine ** 2
  const squareRoot = Math.sqrt(magic)
  const latitudeDelta = latitudeOffset(offsetLongitude, offsetLatitude) * 180 /
    ((EARTH_AXIS * (1 - ECCENTRICITY)) / (magic * squareRoot) * PI)
  const longitudeDelta = longitudeOffset(offsetLongitude, offsetLatitude) * 180 /
    (EARTH_AXIS / squareRoot * Math.cos(latitudeRadians) * PI)

  return {
    latitude: point.latitude + latitudeDelta,
    longitude: point.longitude + longitudeDelta
  }
}

export const spotToWechatMapPoint = (spot: SpotCoordinate): MapCoordinate => toWechatMapPoint({
  latitude: spot.lat,
  longitude: spot.lng
})
