import { useMemo, useState } from 'react'
import Taro from '@tarojs/taro'
import { Button, Input, ScrollView, Text, View } from '@tarojs/components'
import { regions, spots, type Spot } from '@shared/domain'
import CloudImage from '../../components/cloud-image'
import { filterSpots, leadingThemes } from '../../utils/catalogue'
import { spotToWechatMapPoint } from '../../utils/map-coordinates'
import './index.scss'

export default function LandmarksPage () {
  const [activeRegion, setActiveRegion] = useState('全部')
  const [keyword, setKeyword] = useState('')
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null)
  const filteredSpots = useMemo(
    () => filterSpots(spots, activeRegion, keyword),
    [activeRegion, keyword]
  )

  const toggleSpot = (spot: Spot) => {
    setSelectedSpot((current) => current?.id === spot.id ? null : spot)
  }

  const openLocation = (spot: Spot) => {
    const point = spotToWechatMapPoint(spot)
    Taro.openLocation({
      latitude: point.latitude,
      longitude: point.longitude,
      name: spot.name,
      address: `${spot.region} · ${spot.county}`,
      scale: 16
    }).catch(() => Taro.showToast({ title: '未能打开地图，请稍后重试', icon: 'none' }))
  }

  const openFullDetails = (spot: Spot) => Taro.navigateTo({ url: `/pages/landmark-detail/index?spotId=${spot.id}` })

  return (
    <View className='page-shell landmarks-page'>
      <View className='catalogue-hero'>
        <View className='catalogue-count'><Text>{spots.length}</Text><Text>处</Text></View>
        <Text className='catalogue-eyebrow'>JIANGXI RED LANDMARKS</Text>
        <Text className='catalogue-title'>江西红色点位图鉴</Text>
        <Text className='catalogue-intro'>按区域查找旧址与纪念场馆，展开卡片即可查看主题、停留时长与历史简介。</Text>
      </View>

      <View className='catalogue-tools'>
        <View className='search-box'>
          <Text>⌕</Text>
          <Input
            value={keyword}
            type='text'
            confirmType='search'
            placeholder='搜索点位、县区或历史内容'
            placeholderClass='search-placeholder'
            onInput={(event) => setKeyword(event.detail.value)}
          />
          {keyword && <Text className='search-clear' onClick={() => setKeyword('')}>清除</Text>}
        </View>

        <ScrollView className='region-scroll' scrollX enhanced showScrollbar={false}>
          <View className='region-track'>
            {regions.map((region) => (
              <View
                className={`tap-button region-chip ${activeRegion === region ? 'region-chip-active' : ''}`}
                key={region}
                onClick={() => setActiveRegion(region)}
              >
                <Text>{region}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      <View className='catalogue-summary'>
        <Text>{activeRegion === '全部' ? '全部点位' : `${activeRegion}区域`}</Text>
        <Text>{filteredSpots.length} 处结果</Text>
      </View>

      <View className='spot-list'>
        {filteredSpots.map((spot, index) => {
          const isOpen = selectedSpot?.id === spot.id
          return (
            <View className={`spot-card ${isOpen ? 'spot-card-open' : ''}`} key={spot.id}>
              <View className='spot-card-main' hoverClass='spot-card-active' onClick={() => toggleSpot(spot)}>
                <CloudImage assetDirectory='landmarks' className='spot-thumb' src={spot.image} mode='aspectFill' lazyLoad />
                <View className='spot-copy'>
                  <View className='spot-meta'>
                    <Text>{String(index + 1).padStart(2, '0')}</Text>
                    <Text>{spot.region} · {spot.county}</Text>
                    {spot.core && <Text>核心节点</Text>}
                  </View>
                  <Text className='spot-name'>{spot.name}</Text>
                  <Text className='spot-themes'>{leadingThemes(spot).join(' · ')}</Text>
                </View>
                <Text className='spot-toggle'>{isOpen ? '−' : '+'}</Text>
              </View>

              {isOpen && (
                <View className='spot-detail'>
                  <Text className='detail-intro'>{spot.intro}</Text>
                  <View className='detail-facts'>
                    <View><Text>建议停留</Text><Text>{spot.minutes} 分钟</Text></View>
                    <View><Text>节点属性</Text><Text>{spot.core ? '核心历史节点' : '辅助体验点位'}</Text></View>
                    <View><Text>闭馆提示</Text><Text>{spot.closed.length ? `每周${spot.closed.map((day) => '日一二三四五六'[day]).join('、')}` : '暂无固定闭馆日'}</Text></View>
                  </View>
                  <View className='theme-scores'>
                    {Object.entries(spot.themes)
                      .sort((left, right) => right[1] - left[1])
                      .slice(0, 4)
                      .map(([theme, score]) => (
                        <View key={theme}><Text>{theme}</Text><Text>{score}/5</Text></View>
                      ))}
                  </View>
                  <View className='detail-actions'>
                    <Button className='tap-button detail-map-action' onClick={() => openLocation(spot)}>地图查看</Button>
                    <Button className='tap-button detail-full-action' onClick={() => openFullDetails(spot)}>完整资料 <Text>→</Text></Button>
                  </View>
                </View>
              )}
            </View>
          )
        })}

        {filteredSpots.length === 0 && (
          <View className='catalogue-empty'>
            <Text>没有找到相关点位</Text>
            <Text>试试更短的关键词，或切换到“全部”区域。</Text>
          </View>
        )}
      </View>
    </View>
  )
}
