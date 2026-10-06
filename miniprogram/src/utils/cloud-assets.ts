export type CloudAssetDirectory = 'history' | 'landmarks'

export const CLOUD_ENV_ID = 'cloud1-d1ge8o1t9080c94bf'
export const CLOUD_ASSET_ROOT = 'cloud://cloud1-d1ge8o1t9080c94bf.636c-cloud1-d1ge8o1t9080c94bf-1474628382'
export const CLOUD_ROUTE_GEOMETRY_FILE_ID = `${CLOUD_ASSET_ROOT}/route/route-geometry-v1.json`
export const MAX_CLOUD_FILES_PER_REQUEST = 50

const assetFilename = (assetPath: string) => {
  const normalizedPath = assetPath.replace(/\\/g, '/').split(/[?#]/)[0]
  const segments = normalizedPath.split('/').filter(Boolean)
  return segments[segments.length - 1] ?? ''
}

export const localAssetPath = (directory: CloudAssetDirectory, assetPath: string) => {
  const filename = assetFilename(assetPath)
  return filename ? `/${directory}/${filename}` : assetPath
}

export const cloudAssetPath = (directory: CloudAssetDirectory, assetPath: string) => {
  if (/^(?:cloud|https?):\/\//.test(assetPath)) return assetPath
  const filename = assetFilename(assetPath)
  return filename ? `${CLOUD_ASSET_ROOT}/${directory}/${filename}` : assetPath
}

export const chunkCloudFileIds = (fileIds: string[]) => {
  const uniqueFileIds = Array.from(new Set(fileIds.filter((fileId) => fileId.startsWith('cloud://'))))
  return Array.from(
    { length: Math.ceil(uniqueFileIds.length / MAX_CLOUD_FILES_PER_REQUEST) },
    (_, index) => uniqueFileIds.slice(index * MAX_CLOUD_FILES_PER_REQUEST, (index + 1) * MAX_CLOUD_FILES_PER_REQUEST)
  )
}
