import Taro from '@tarojs/taro'
import { CLOUD_ROUTE_GEOMETRY_FILE_ID } from '../utils/cloud-assets'
import { createRouteGeometryLoader, parseRouteGeometryPayload } from '../utils/route-geometry'

const readTextFile = (filePath: string) => new Promise<string>((resolve, reject) => {
  Taro.getFileSystemManager().readFile({
    filePath,
    encoding: 'utf8',
    success: (result) => {
      if (typeof result.data === 'string') resolve(result.data)
      else reject(new Error('路线文件不是 UTF-8 文本'))
    },
    fail: reject
  })
})

const downloadRouteGeometry = async () => {
  if (!Taro.cloud?.downloadFile) return null
  const result = await Taro.cloud.downloadFile({ fileID: CLOUD_ROUTE_GEOMETRY_FILE_ID })
  const raw = await readTextFile(result.tempFilePath)
  return parseRouteGeometryPayload(raw)
}

export const loadRouteGeometry = createRouteGeometryLoader(downloadRouteGeometry)
