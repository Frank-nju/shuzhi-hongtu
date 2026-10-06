import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'
import { pathToFileURL } from 'node:url'
import { build } from '../miniprogram/node_modules/esbuild/lib/main.js'

const root = path.resolve(import.meta.dirname, '..')
const miniRoot = path.join(root, 'miniprogram')
const bundlePath = path.join(os.tmpdir(), `shuzhi-route-geometry-${process.pid}.mjs`)
const coordinateBundlePath = path.join(os.tmpdir(), `shuzhi-map-coordinates-${process.pid}.mjs`)

after(() => {
  fs.rmSync(bundlePath, { force: true })
  fs.rmSync(coordinateBundlePath, { force: true })
})

async function loadRouteGeometryUtils () {
  const sourcePath = path.join(miniRoot, 'src/utils/route-geometry.ts')
  await build({
    bundle: true,
    format: 'esm',
    logLevel: 'silent',
    outfile: bundlePath,
    platform: 'node',
    stdin: {
      contents: fs.readFileSync(sourcePath, 'utf8'),
      loader: 'ts',
      resolveDir: path.dirname(sourcePath),
      sourcefile: sourcePath
    },
    target: 'node22'
  })
  return import(`${pathToFileURL(bundlePath).href}?v=${Date.now()}`)
}

async function loadMapCoordinateUtils () {
  const sourcePath = path.join(miniRoot, 'src/utils/map-coordinates.ts')
  await build({
    bundle: true,
    entryPoints: [sourcePath],
    format: 'esm',
    logLevel: 'silent',
    outfile: coordinateBundlePath,
    platform: 'node',
    target: 'node22'
  })
  return import(`${pathToFileURL(coordinateBundlePath).href}?v=${Date.now()}`)
}

test('Tianditu coordinates are converted to the GCJ-02 system required by WeChat maps', async () => {
  const coordinates = await loadMapCoordinateUtils()
  const converted = coordinates.toWechatMapPoint({ latitude: 28.67445, longitude: 115.88927 })

  assert.ok(Math.abs(converted.latitude - 28.67108145) < 1e-7)
  assert.ok(Math.abs(converted.longitude - 115.89411821) < 1e-7)
  assert.deepEqual(
    coordinates.toWechatMapPoint({ latitude: 51.5074, longitude: -0.1278 }),
    { latitude: 51.5074, longitude: -0.1278 }
  )
})

test('polyline decoder restores upstream road coordinates', async () => {
  const geometry = await loadRouteGeometryUtils()
  const points = geometry.decodeRoutePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')

  assert.equal(points.length, 3)
  assert.deepEqual(points[0], { latitude: 38.5, longitude: -120.2 })
  assert.deepEqual(points[2], { latitude: 43.252, longitude: -126.453 })
})

test('route lines orient cached roads and keep a dotted fallback for missing segments', async () => {
  const geometry = await loadRouteGeometryUtils()
  const spots = [
    { id: 'B', lat: 43.252, lng: -126.453 },
    { id: 'A', lat: 38.5, lng: -120.2 },
    { id: 'C', lat: 39, lng: -119 }
  ]
  const result = geometry.buildRoutePolylines(spots, {
    'A|B': '_p~iF~ps|U_ulLnnqC_mqNvxq`@'
  })

  assert.equal(result.totalSegments, 2)
  assert.equal(result.matchedSegments, 1)
  assert.equal(result.polylines[0].dottedLine, false)
  assert.equal(result.polylines[0].points[0].latitude, spots[0].lat)
  assert.equal(result.polylines[0].points.at(-1).latitude, spots[1].lat)
  assert.equal(result.polylines[1].dottedLine, true)
  assert.deepEqual(result.polylines[1].points, [
    { latitude: spots[1].lat, longitude: spots[1].lng },
    { latitude: spots[2].lat, longitude: spots[2].lng }
  ])
  assert.ok(result.includePoints.length <= spots.length + 4)
})

test('road geometry and fallback endpoints are converted before rendering on the WeChat base map', async () => {
  const geometry = await loadRouteGeometryUtils()
  const coordinates = await loadMapCoordinateUtils()
  const artifact = JSON.parse(fs.readFileSync(path.join(miniRoot, 'cloud-assets/route/route-geometry-v1.json'), 'utf8'))
  const spots = [
    { id: 'N01', lat: 28.67445, lng: 115.88927 },
    { id: 'N02', lat: 28.672667, lng: 115.904562 }
  ]
  const decodedFirst = geometry.decodeRoutePolyline(artifact.pairs['N01|N02'])[0]
  const result = geometry.buildRoutePolylines(spots, artifact.pairs)

  assert.deepEqual(result.polylines[0].points[0], coordinates.toWechatMapPoint(decodedFirst))
  assert.deepEqual(result.includePoints[0], coordinates.spotToWechatMapPoint(spots[0]))
  assert.notEqual(result.polylines[0].points[0].longitude, decodedFirst.longitude)
})

test('geometry payload parser rejects malformed cloud data', async () => {
  const geometry = await loadRouteGeometryUtils()
  const valid = JSON.stringify({
    version: 1,
    encoding: 'google-polyline-5',
    pairs: { 'A|B': '_p~iF~ps|U_ulLnnqC_mqNvxq`@' }
  })

  assert.deepEqual(geometry.parseRouteGeometryPayload(valid), {
    'A|B': '_p~iF~ps|U_ulLnnqC_mqNvxq`@'
  })
  assert.equal(geometry.parseRouteGeometryPayload('{bad json'), null)
  assert.equal(geometry.parseRouteGeometryPayload(JSON.stringify({ version: 2, pairs: {} })), null)
  assert.equal(geometry.parseRouteGeometryPayload(JSON.stringify({ version: 1, encoding: 'google-polyline-5', pairs: { bad: 42 } })), null)
  assert.equal(geometry.parseRouteGeometryPayload(JSON.stringify({ version: 1, encoding: 'google-polyline-5', pairs: { 'A|B': '?' } })), null)
})

test('geometry loader merges concurrent calls, retries transient failures and caches only success', async () => {
  const geometry = await loadRouteGeometryUtils()
  const expected = { 'A|B': '_p~iF~ps|U_ulLnnqC_mqNvxq`@' }
  let calls = 0
  const load = geometry.createRouteGeometryLoader(async () => {
    calls += 1
    if (calls === 1) throw new Error('temporary cloud failure')
    return expected
  }, { attempts: 2, retryDelayMs: 0 })

  const [first, second] = await Promise.all([load(), load()])
  assert.deepEqual(first, expected)
  assert.deepEqual(second, expected)
  assert.equal(calls, 2)
  assert.deepEqual(await load(), expected)
  assert.equal(calls, 2)
})

test('mini-program downloads road geometry from cloud and renders segment polylines', () => {
  const routeMap = fs.readFileSync(path.join(miniRoot, 'src/components/route-map/index.tsx'), 'utf8')
  const countyPolygons = fs.readFileSync(path.join(miniRoot, 'src/utils/county-polygons.ts'), 'utf8')
  const loader = fs.readFileSync(path.join(miniRoot, 'src/services/route-geometry.ts'), 'utf8')
  const assets = fs.readFileSync(path.join(miniRoot, 'src/utils/cloud-assets.ts'), 'utf8')

  assert.match(routeMap, /useEffect/)
  assert.match(routeMap, /loadRouteGeometry/)
  assert.match(routeMap, /buildRoutePolylines/)
  assert.match(routeMap, /spotToWechatMapPoint/)
  assert.match(countyPolygons, /toWechatMapPoint/)
  assert.match(routeMap, /真实道路路线/)
  assert.match(loader, /Taro\.cloud\.downloadFile/)
  assert.match(loader, /\.readFile\(/)
  assert.doesNotMatch(loader, /readFileSync/)
  assert.match(loader, /parseRouteGeometryPayload/)
  assert.match(assets, /CLOUD_ROUTE_GEOMETRY_FILE_ID/)
})

test('all native WeChat map entry points use GCJ-02 landmark coordinates', () => {
  for (const sourcePath of [
    'src/pages/route-detail/index.tsx',
    'src/pages/landmark-detail/index.tsx',
    'src/pages/landmarks/index.tsx'
  ]) {
    const source = fs.readFileSync(path.join(miniRoot, sourcePath), 'utf8')
    assert.match(source, /spotToWechatMapPoint/)
    assert.match(source, /Taro\.openLocation\(\{[\s\S]*latitude:[\s\S]*longitude:/)
  }
})

test('synced cloud artifact covers all upstream road pairs without entering the release package', () => {
  const artifactPath = path.join(miniRoot, 'cloud-assets/route/route-geometry-v1.json')
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
  const config = fs.readFileSync(path.join(miniRoot, 'config/index.ts'), 'utf8')
  const packageJson = JSON.parse(fs.readFileSync(path.join(miniRoot, 'package.json'), 'utf8'))

  assert.equal(artifact.version, 1)
  assert.equal(artifact.encoding, 'google-polyline-5')
  assert.equal(artifact.pairCount, 928)
  assert.equal(Object.keys(artifact.pairs).length, 928)
  assert.ok(fs.statSync(artifactPath).size < 1.2 * 1024 * 1024)
  assert.doesNotMatch(config, /cloud-assets/)
  assert.equal(packageJson.scripts['sync:route-geometry'], 'node scripts/sync-route-geometry.mjs')
})

test('every synced road segment decodes to finite in-range coordinates', async () => {
  const geometry = await loadRouteGeometryUtils()
  const artifactPath = path.join(miniRoot, 'cloud-assets/route/route-geometry-v1.json')
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
  const script = fs.readFileSync(path.join(miniRoot, 'scripts/sync-route-geometry.mjs'), 'utf8')

  for (const encoded of Object.values(artifact.pairs)) {
    const points = geometry.decodeRoutePolyline(encoded)
    assert.ok(points.length >= 2)
    assert.ok(points.every((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)))
    assert.ok(points.every((point) => Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180))
  }
  assert.match(script, /Number\.isFinite/)
  assert.match(script, /longitude/)
  assert.match(script, /latitude/)
})
