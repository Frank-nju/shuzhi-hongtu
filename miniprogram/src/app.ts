import { PropsWithChildren } from 'react'
import Taro, { useLaunch } from '@tarojs/taro'
import { historyStages, spots } from '@shared/domain'

import { preloadCloudAssets } from './services/cloud-asset-urls'
import { cloudAssetPath, CLOUD_ENV_ID } from './utils/cloud-assets'

import './app.scss'

const cloudAssetFileIds = [
  ...spots.map((spot) => cloudAssetPath('landmarks', spot.image)),
  ...historyStages.reduce<string[]>((fileIds, stage) => [
    ...fileIds,
    cloudAssetPath('history', stage.artwork),
    cloudAssetPath('history', stage.mapImage)
  ], [])
]

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    if (Taro.cloud) {
      Taro.cloud.init({ env: CLOUD_ENV_ID, traceUser: true })
      void preloadCloudAssets(cloudAssetFileIds)
    }
    console.log('App launched.')
  })

  // children 是将要会渲染的页面
  return children
}

export default App
