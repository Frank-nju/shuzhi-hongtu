import { useState } from 'react'
import Taro, { useLoad, useShareAppMessage } from '@tarojs/taro'
import { Button, Text, View } from '@tarojs/components'
import { spotDetails, spots, type Spot } from '@shared/domain'
import CloudImage from '../../components/cloud-image'
import RouteMap from '../../components/route-map'
import { openExternalLink } from '../../utils/external-link'
import { spotToWechatMapPoint } from '../../utils/map-coordinates'
import './index.scss'

type PageParams = { spotId?: string }
const weekdayNames = '日一二三四五六'

export default function LandmarkDetailPage () {
  const [spot, setSpot] = useState<Spot | null>(null)

  useLoad<PageParams>((params) => {
    const nextSpot = spots.find((item) => item.id === params.spotId) ?? null
    setSpot(nextSpot)
    if (nextSpot) Taro.setNavigationBarTitle({ title: nextSpot.short })
  })

  useShareAppMessage(() => ({
    title: spot ? `${spot.name}｜数智-红途` : '江西红色点位｜数智-红途',
    path: spot ? `/pages/landmark-detail/index?spotId=${spot.id}` : '/pages/landmarks/index'
  }))

  if (!spot) {
    return (
      <View className='page-shell landmark-detail-page detail-missing'>
        <Text>没有找到这个点位</Text>
        <Button className='tap-button detail-missing-action' onClick={() => Taro.navigateBack()}>返回点位图鉴</Button>
      </View>
    )
  }

  const detail = spotDetails[spot.id]
  const relatedSpots = spots.filter((item) => item.id !== spot.id && item.region === spot.region).slice(0, 3)
  const openLocation = () => {
    const point = spotToWechatMapPoint(spot)
    return Taro.openLocation({
      latitude: point.latitude,
      longitude: point.longitude,
      name: spot.name,
      address: detail?.address ?? `${spot.region} · ${spot.county}`,
      scale: 16
    }).catch(() => Taro.showToast({ title: '未能打开地图，请稍后重试', icon: 'none' }))
  }

  return (
    <View className='page-shell landmark-detail-page'>
      <View className='detail-cover'>
        <CloudImage assetDirectory='landmarks' src={spot.image} mode='aspectFill' />
        <View className='detail-cover-copy'>
          <Text>{spot.region} · {spot.county}</Text>
          <Text>{spot.name}</Text>
          <Text>{spot.intro}</Text>
          <View>
            <Text>建议停留 {spot.minutes} 分钟</Text>
            <Text>{spot.core ? '核心历史节点' : '辅助体验点位'}</Text>
            <Text>固定闭馆：{spot.closed.length ? `每周${spot.closed.map((day) => weekdayNames[day]).join('、')}` : '暂无固定闭馆日'}</Text>
          </View>
        </View>
      </View>

      <View className='visit-panel'>
        <View className='detail-section-title'><Text>VISIT INFO</Text><Text>参观信息</Text></View>
        <Text className='visit-description'>{detail?.description ?? spot.intro}</Text>
        {detail && (
          <View className='visit-list'>
            <View><Text>详细地址</Text><Text>{detail.address}</Text></View>
            <View><Text>开放时间</Text><Text>{detail.openingHours}</Text></View>
            <View><Text>固定闭馆</Text><Text>{spot.closed.length ? `每周${spot.closed.map((day) => weekdayNames[day]).join('、')}` : '暂无固定闭馆日'}</Text></View>
            <View><Text>开放性质</Text><Text>{detail.openNote}</Text></View>
            <View><Text>预约要求</Text><Text>{detail.reservationRequired}</Text></View>
            <View><Text>预约方式</Text><Text>{detail.reservationMethod}</Text></View>
            <View><Text>资料核验</Text><Text>{detail.verificationLevel} · {detail.verifiedAt}</Text></View>
            <View><Text>核验备注</Text><Text>{detail.verificationNote}</Text></View>
          </View>
        )}
        <View className='visit-actions'>
          <Button className='tap-button visit-action visit-primary' onClick={openLocation}>打开微信地图</Button>
          {detail?.reservationUrl && <Button className='tap-button visit-action visit-secondary' onClick={() => openExternalLink(detail.reservationUrl!, '预约入口')}>复制预约入口</Button>}
          {detail?.officialUrl && <Button className='tap-button visit-action visit-secondary' onClick={() => openExternalLink(detail.officialUrl!, '官方信息')}>复制官方链接</Button>}
          {detail?.sourceUrl && <Button className='tap-button visit-action visit-secondary' onClick={() => openExternalLink(detail.sourceUrl!, '资料来源')}>复制资料来源</Button>}
        </View>
      </View>

      <View className='detail-map-wrap'>
        <RouteMap spots={[spot]} title='点位位置' compact onSpotTap={openLocation} />
      </View>

      <View className='dimension-panel'>
        <View className='detail-section-title'><Text>CONTENT DIMENSIONS</Text><Text>内容维度</Text></View>
        {Object.entries(spot.themes).map(([theme, score]) => (
          <View className='dimension-row' key={theme}>
            <Text>{theme}</Text><View><View style={{ width: `${score * 20}%` }} /></View><Text>{score}/5</Text>
          </View>
        ))}
      </View>

      {relatedSpots.length > 0 && (
        <View className='related-panel'>
          <View className='detail-section-title'><Text>NEARBY</Text><Text>同区域点位</Text></View>
          {relatedSpots.map((item) => (
            <View className='related-card' key={item.id} onClick={() => Taro.redirectTo({ url: `/pages/landmark-detail/index?spotId=${item.id}` })}>
              <CloudImage assetDirectory='landmarks' src={item.image} mode='aspectFill' lazyLoad />
              <View><Text>{item.county}</Text><Text>{item.name}</Text><Text>建议停留 {item.minutes} 分钟</Text></View>
              <Text>→</Text>
            </View>
          ))}
        </View>
      )}

      <Text className='detail-disclaimer'>开放信息为演示期静态资料，出发前请核验官方通知。</Text>
    </View>
  )
}
