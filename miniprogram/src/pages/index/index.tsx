import Taro from '@tarojs/taro'
import { Button, ScrollView, Text, View } from '@tarojs/components'
import { generatePlans, plannerDefaults, plannerQuery, regions, spots } from '@shared/domain'
import ActionPill from '../../components/action-pill'
import CloudImage from '../../components/cloud-image'
import RouteMap from '../../components/route-map'
import './index.scss'

const criteria = plannerDefaults()
const recommendedPlans = generatePlans(
  criteria.county,
  criteria.startDate,
  criteria.days,
  criteria.theme1,
  criteria.theme2,
  criteria.experience,
  criteria.purpose,
  criteria.travelMode
).slice(0, 5)

const landmarkColumns = Array.from(
  { length: Math.ceil(spots.length / 2) },
  (_, index) => spots.slice(index * 2, index * 2 + 2)
)

const switchTab = (url: string) => Taro.switchTab({ url })
const openDefaultRoutes = () => Taro.navigateTo({ url: `/pages/routes/index?${plannerQuery(criteria)}` })
const openSpotDetails = (spotId: string) => Taro.navigateTo({ url: `/pages/landmark-detail/index?spotId=${spotId}` })

export default function Index () {
  return (
    <View className='page-shell home-page'>
      <View className='hero-panel'>
        <View className='hero-meta'>
          <Text>JIANGXI · RED MEMORY</Text>
          <Text>江西红色文旅智导</Text>
        </View>

        <View className='hero-mark' aria-hidden='true'>
          <View className='hero-ring hero-ring-outer' />
          <View className='hero-ring hero-ring-inner' />
          <Text className='hero-star'>★</Text>
        </View>

        <View className='hero-glass'>
          <View className='hero-copy'>
            <View className='brand-seal'><Text>智</Text></View>
            <Text className='hero-kicker'>赣鄱红途 · 循迹而行</Text>
            <Text className='hero-title'>让革命史诗{`\n`}跃然掌中</Text>
            <Text className='hero-description'>从 44 处红色地标出发，结合时间、主题与出行方式，生成真正走得通、读得懂的江西路线。</Text>
          </View>

          <View className='hero-actions'>
            <Button className='tap-button primary-action' onClick={() => switchTab('/pages/planner/index')}>
              <Text>生成我的路线</Text><Text>→</Text>
            </Button>
            <Button className='tap-button text-action' onClick={() => switchTab('/pages/landmarks/index')}>先看看点位</Button>
          </View>
        </View>
      </View>

      <View className='data-strip'>
        <View><Text className='data-value'>{spots.length}</Text><Text className='data-label'>处红色点位</Text></View>
        <View><Text className='data-value'>{regions.length - 1}</Text><Text className='data-label'>个主题区域</Text></View>
        <View><Text className='data-value'>{recommendedPlans.length}</Text><Text className='data-label'>条今日推荐</Text></View>
      </View>

      <View className='home-map-section'>
        <View className='section-title-row'>
          <View>
            <Text className='section-kicker'>JIANGXI OVERVIEW / 00</Text>
            <Text className='section-heading'>44 处点位，一张图看全</Text>
          </View>
        </View>
        <View className='home-map-wrap'>
          <RouteMap spots={spots} title='江西红色点位总览' showPolyline={false} overviewMode onSpotTap={(spot) => openSpotDetails(spot.id)} />
        </View>
      </View>

      <View className='home-section route-section'>
        <View className='section-title-row'>
          <View>
            <Text className='section-kicker'>SMART JOURNEY / 01</Text>
            <Text className='section-heading'>从一条读得懂的路线开始</Text>
          </View>
          <Button className='tap-button section-link' onClick={openDefaultRoutes}>看 5 条</Button>
        </View>

        <ScrollView className='route-scroll' scrollX enhanced showScrollbar={false}>
          <View className='route-track'>
            {recommendedPlans.map((plan, index) => (
              <View className='route-card' key={plan.id}>
                <View className='route-card-top'>
                  <Text className='route-number'>0{index + 1}</Text>
                  <View className='route-score'><Text>{plan.score}</Text><Text>匹配</Text></View>
                </View>
                <Text className='route-angle'>{plan.angle}</Text>
                <Text className='route-name'>{plan.name}</Text>
                <View className='route-line' />
                <View className='route-stops'>
                  {plan.spots.slice(0, 4).map((spot, spotIndex) => (
                    <View className='route-stop' key={spot.id}>
                      <Text>{spotIndex + 1}</Text><Text>{spot.short}</Text>
                    </View>
                  ))}
                </View>
                <Text className='route-summary'>{plan.days.length} 天 · {plan.spots.length} 个点位 · {plan.criteria.travelMode === 'self' ? '自驾' : '团队出行'}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      <View className='home-section landmark-section'>
        <View className='section-title-row'>
          <View>
            <Text className='section-kicker'>RED LANDMARKS / 02</Text>
            <Text className='section-heading'>完整 44 处，循图走进江西记忆</Text>
          </View>
          <Button className='tap-button section-link' onClick={() => switchTab('/pages/landmarks/index')}>查看图鉴</Button>
        </View>

        <ScrollView className='landmark-scroll' scrollX enhanced showScrollbar={false}>
          <View className='landmark-gallery-track'>
            {landmarkColumns.map((column, columnIndex) => (
              <View className='landmark-column' key={`column-${columnIndex}`}>
                {column.map((spot, rowIndex) => (
                  <View className='landmark-card' key={spot.id} onClick={() => openSpotDetails(spot.id)}>
                    <CloudImage assetDirectory='landmarks' className='landmark-image' src={spot.image} mode='aspectFill' lazyLoad />
                    <View className='landmark-card-copy'>
                      <Text className='landmark-index'>{String(columnIndex * 2 + rowIndex + 1).padStart(2, '0')}</Text>
                      <View>
                        <Text className='landmark-region'>{spot.region} · {spot.county}</Text>
                        <Text className='landmark-name'>{spot.name}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      <View className='method-note'>
        <Text className='method-label'>路线为何适合你</Text>
        <Text className='method-title'>先判断能不能走，再决定值不值得走。</Text>
        <View className='method-steps'>
          <Text>时间可行</Text><Text>内容匹配</Text><Text>历史校验</Text><Text>路线去重</Text>
        </View>
        <View className='method-actions'>
          <ActionPill className='method-action' variant='primary' onClick={() => Taro.navigateTo({ url: '/pages/history/index' })}>阅读历史专题</ActionPill>
          <ActionPill className='method-action' variant='tonal' onClick={() => Taro.navigateTo({ url: '/pages/methodology/index' })}>查看匹配方法</ActionPill>
        </View>
      </View>
    </View>
  )
}
