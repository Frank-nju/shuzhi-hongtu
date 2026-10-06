import Taro from '@tarojs/taro'
import { chunkCloudFileIds } from '../utils/cloud-assets'

const urlCache = new Map<string, string>()
const pendingUrls = new Map<string, Promise<string>>()

const fetchTemporaryUrls = async (fileIds: string[]) => {
  try {
    const result = await Taro.cloud.getTempFileURL({ fileList: fileIds })
    result.fileList.forEach((file) => {
      if (file.status === 0 && file.tempFileURL) urlCache.set(file.fileID, file.tempFileURL)
    })
  } catch {
    // 页面组件会继续使用代码包内的同名图片。
  }
}

export const getCachedCloudAsset = (fileId: string) => urlCache.get(fileId)

export const preloadCloudAssets = async (fileIds: string[]) => {
  const requestedFileIds = Array.from(new Set(fileIds.filter((fileId) => fileId.startsWith('cloud://'))))
  const missingFileIds = requestedFileIds.filter((fileId) => !urlCache.has(fileId) && !pendingUrls.has(fileId))

  chunkCloudFileIds(missingFileIds).forEach((batch) => {
    const batchRequest = fetchTemporaryUrls(batch)
    batch.forEach((fileId) => {
      const pendingUrl = batchRequest.then(() => urlCache.get(fileId) ?? '')
      pendingUrls.set(fileId, pendingUrl)
      void pendingUrl.finally(() => {
        if (pendingUrls.get(fileId) === pendingUrl) pendingUrls.delete(fileId)
      })
    })
  })

  await Promise.all(requestedFileIds.map((fileId) => pendingUrls.get(fileId) ?? Promise.resolve(urlCache.get(fileId) ?? '')))
}

export const resolveCloudAsset = async (fileId: string) => {
  if (!fileId.startsWith('cloud://')) return fileId
  const cachedUrl = getCachedCloudAsset(fileId)
  if (cachedUrl) return cachedUrl
  await preloadCloudAssets([fileId])
  return getCachedCloudAsset(fileId) ?? ''
}
