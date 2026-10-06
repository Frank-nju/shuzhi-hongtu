import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'
import { pathToFileURL } from 'node:url'
import { build } from '../miniprogram/node_modules/esbuild/lib/main.js'

const root = path.resolve(import.meta.dirname, '..')
const miniRoot = path.join(root, 'miniprogram')
const bundlePath = path.join(os.tmpdir(), `shuzhi-cloud-assets-${process.pid}.mjs`)

after(() => fs.rmSync(bundlePath, { force: true }))

async function loadCloudAssets () {
  const sourcePath = path.join(miniRoot, 'src/utils/cloud-assets.ts')
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

test('cloud assets use the configured environment and uploaded folders', async () => {
  const assets = await loadCloudAssets()

  assert.equal(assets.CLOUD_ENV_ID, 'cloud1-d1ge8o1t9080c94bf')
  assert.equal(
    assets.cloudAssetPath('landmarks', '/landmarks/JGS01-museum.webp'),
    'cloud://cloud1-d1ge8o1t9080c94bf.636c-cloud1-d1ge8o1t9080c94bf-1474628382/landmarks/JGS01-museum.webp'
  )
  assert.equal(
    assets.cloudAssetPath('history', 'important/map-stage-01-woodcut.webp'),
    'cloud://cloud1-d1ge8o1t9080c94bf.636c-cloud1-d1ge8o1t9080c94bf-1474628382/history/map-stage-01-woodcut.webp'
  )
})

test('cloud asset helpers preserve cloud URLs and provide packaged fallbacks', async () => {
  const assets = await loadCloudAssets()
  const fileId = 'cloud://example.test/history/already-cloud.webp'

  assert.equal(assets.cloudAssetPath('history', fileId), fileId)
  assert.equal(assets.localAssetPath('history', 'important/map-stage-02-field-sketch.webp'), '/history/map-stage-02-field-sketch.webp')
  assert.equal(assets.localAssetPath('landmarks', ''), '')
})

test('52 cloud files are deduplicated and split into batches of 50 and 2', async () => {
  const assets = await loadCloudAssets()
  const fileIds = Array.from({ length: 52 }, (_, index) => `cloud://example.test/landmarks/${index}.webp`)
  const batches = assets.chunkCloudFileIds([...fileIds, fileIds[0], 'https://example.test/not-a-file-id.webp', ''])

  assert.deepEqual(batches.map((batch) => batch.length), [50, 2])
  assert.deepEqual(batches.flat(), fileIds)
})

test('mini-program preloads temporary URLs and image components consume the cache', () => {
  const app = fs.readFileSync(path.join(miniRoot, 'src/app.ts'), 'utf8')
  const cloudImage = fs.readFileSync(path.join(miniRoot, 'src/components/cloud-image/index.tsx'), 'utf8')
  const cloudUrls = fs.readFileSync(path.join(miniRoot, 'src/services/cloud-asset-urls.ts'), 'utf8')

  assert.match(app, /Taro\.cloud\.init/)
  assert.match(app, /CLOUD_ENV_ID/)
  assert.match(app, /historyStages/)
  assert.match(app, /spots/)
  assert.match(app, /preloadCloudAssets/)
  assert.match(cloudUrls, /getTempFileURL/)
  assert.match(cloudUrls, /chunkCloudFileIds/)
  assert.match(cloudUrls, /resolveCloudAsset/)
  assert.match(cloudImage, /cloudAssetPath/)
  assert.match(cloudImage, /localAssetPath/)
  assert.match(cloudImage, /getCachedCloudAsset/)
  assert.match(cloudImage, /resolveCloudAsset/)
  assert.match(cloudImage, /onError/)
  assert.doesNotMatch(cloudImage, /useState\(cloudSource\)/)
})

test('home landmark gallery matches the working catalogue image loading strategy', () => {
  const home = fs.readFileSync(path.join(miniRoot, 'src/pages/index/index.tsx'), 'utf8')
  const catalogue = fs.readFileSync(path.join(miniRoot, 'src/pages/landmarks/index.tsx'), 'utf8')
  const homeStyles = fs.readFileSync(path.join(miniRoot, 'src/pages/index/index.scss'), 'utf8')
  const homeImage = home.match(/<CloudImage[^>]+className='landmark-image'[^>]+\/>/)?.[0] ?? ''
  const catalogueImage = catalogue.match(/<CloudImage[^>]+className='spot-thumb'[^>]+\/>/)?.[0] ?? ''
  const galleryImageStyles = homeStyles.match(/\.landmark-image\s*\{([^}]*)\}/s)?.[1] ?? ''

  assert.ok(homeImage)
  assert.ok(catalogueImage)
  assert.match(homeImage, /lazyLoad/)
  assert.match(catalogueImage, /lazyLoad/)
  assert.doesNotMatch(galleryImageStyles, /filter\s*:/)
})
