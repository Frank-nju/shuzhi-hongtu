import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const miniRoot = path.resolve(scriptDirectory, '..')
const repoRoot = path.resolve(miniRoot, '..')
const outputPath = path.join(miniRoot, 'cloud-assets', 'route', 'route-geometry-v1.json')
const source = process.argv[2] ?? 'origin/main:data/route-geometry.json'

const readSource = () => {
  if (source.includes(':')) {
    return execFileSync('git', ['show', source], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024
    })
  }
  return fs.readFileSync(path.resolve(repoRoot, source), 'utf8')
}

const encodeValue = (input) => {
  let value = input < 0 ? ~(input << 1) : input << 1
  let encoded = ''
  while (value >= 0x20) {
    encoded += String.fromCharCode((0x20 | (value & 0x1f)) + 63)
    value >>= 5
  }
  return encoded + String.fromCharCode(value + 63)
}

const encodePolyline = (points) => {
  let latitude = 0
  let longitude = 0
  let encoded = ''
  for (const [nextLongitude, nextLatitude] of points) {
    const roundedLatitude = Math.round(nextLatitude * 1e5)
    const roundedLongitude = Math.round(nextLongitude * 1e5)
    encoded += encodeValue(roundedLatitude - latitude)
    encoded += encodeValue(roundedLongitude - longitude)
    latitude = roundedLatitude
    longitude = roundedLongitude
  }
  return encoded
}

const validCoordinate = (point) => {
  if (!Array.isArray(point) || point.length !== 2) return false
  const [longitude, latitude] = point
  return Number.isFinite(longitude) && Number.isFinite(latitude) &&
    Math.abs(longitude) <= 180 && Math.abs(latitude) <= 90
}

const upstream = JSON.parse(readSource())
const pairs = Object.fromEntries(Object.entries(upstream.pairs ?? {}).map(([key, value]) => {
  if (!Array.isArray(value.points) || value.points.length < 2 || !value.points.every(validCoordinate)) {
    throw new Error(`路线几何 ${key} 的坐标数据无效`)
  }
  return [key, encodePolyline(value.points)]
}))
const payload = {
  version: 1,
  encoding: 'google-polyline-5',
  source,
  updated: upstream._meta?.updated ?? new Date().toISOString().slice(0, 10),
  pairCount: Object.keys(pairs).length,
  pairs
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, JSON.stringify(payload), 'utf8')
console.log(`路线几何已同步：${payload.pairCount} 段，${(fs.statSync(outputPath).size / 1024).toFixed(1)} KiB`)
