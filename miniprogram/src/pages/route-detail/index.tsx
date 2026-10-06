import { useState } from 'react'
import Taro, { useLoad, useShareAppMessage } from '@tarojs/taro'
import { Button, Canvas, Progress, Text, View } from '@tarojs/components'
import { dateAt, travelModes, type Plan, type Spot } from '@shared/domain'
import ActionPill from '../../components/action-pill'
import RouteMap from '../../components/route-map'
import {
  getActiveRoute,
  loadCompletedSpotIds,
  loadSavedRoutes,
  saveRoute,
  setActiveRoute,
  toggleCompletedSpot
} from '../../services/route-storage'
import { openExternalLink } from '../../utils/external-link'
import { spotToWechatMapPoint } from '../../utils/map-coordinates'
import { miniPlanPath, resolvePlanFromParams } from '../../utils/route-link'
import {
  formatDuration,
  moveRouteSpot,
  removeRouteSpot,
  replaceRouteSpot,
  routeSummary
} from '../../utils/route-plan'
import { routeProgress } from '../../utils/route-state'
import './index.scss'

type RouteParams = Record<string, string | string[] | undefined>
type PosterContext = ReturnType<typeof Taro.createCanvasContext>

const dayLabel = (startDate: string, offset: number) => {
  const date = dateAt(startDate, offset)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

const openSpotLocation = (spot: Spot) => {
  const point = spotToWechatMapPoint(spot)
  Taro.openLocation({
    latitude: point.latitude,
    longitude: point.longitude,
    name: spot.name,
    address: `${spot.region} · ${spot.county}`,
    scale: 16
  }).catch(() => Taro.showToast({ title: '未能打开地图，请稍后重试', icon: 'none' }))
}

const openSpotDetails = (spot: Spot) => {
  Taro.navigateTo({ url: `/pages/landmark-detail/index?spotId=${spot.id}` })
}

const sameRoute = (left: Plan, right: Plan) => (
  left.id === right.id &&
  left.spots.map((spot) => spot.id).join(',') === right.spots.map((spot) => spot.id).join(',')
)

function drawWrappedText (context: PosterContext, text: string, x: number, startY: number, maxWidth: number, lineHeight: number, maxLines = 3): number {
  const lines: string[] = []
  let current = ''
  for (const character of text) {
    if (context.measureText(current + character).width > maxWidth && current) {
      lines.push(current)
      current = character
      if (lines.length === maxLines) break
    } else {
      current += character
    }
  }
  if (current && lines.length < maxLines) lines.push(current)
  lines.forEach((line, index) => context.fillText(line, x, startY + index * lineHeight))
  return startY + lines.length * lineHeight
}

export default function RouteDetailPage () {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [completedIds, setCompletedIds] = useState<string[]>([])
  const [isSaved, setIsSaved] = useState(false)

  useLoad<RouteParams>((params) => {
    const nextPlan = resolvePlanFromParams(params) ?? getActiveRoute()
    if (!nextPlan) return
    setPlan(nextPlan)
    setActiveRoute(nextPlan)
    setCompletedIds(loadCompletedSpotIds(nextPlan))
    setIsSaved(loadSavedRoutes().some((item) => sameRoute(item.plan, nextPlan)))
    Taro.setNavigationBarTitle({ title: nextPlan.name })
  })

  useShareAppMessage(() => ({
    title: plan ? `${plan.name}｜数智-红途` : '数智-红途｜江西红色路线',
    path: plan ? miniPlanPath(plan) : '/pages/index/index'
  }))

  const saveCurrentRoute = () => {
    if (!plan) return
    saveRoute(plan)
    setIsSaved(true)
    Taro.showToast({ title: '已保存到我的路线', icon: 'success' })
  }

  const toggleSpot = (spotId: string) => {
    if (!plan) return
    setCompletedIds(toggleCompletedSpot(plan, spotId))
  }

  const applyEditedPlan = (nextPlan: Plan, message: string) => {
    if (nextPlan === plan) {
      Taro.showToast({ title: '当前操作不可用', icon: 'none' })
      return
    }
    setPlan(nextPlan)
    setActiveRoute(nextPlan)
    setCompletedIds((current) => current.filter((id) => nextPlan.spots.some((spot) => spot.id === id)))
    setIsSaved(false)
    Taro.showToast({ title: message, icon: 'none' })
  }

  const generatePoster = () => {
    if (!plan) return
    Taro.showLoading({ title: '生成路线海报' })
    const context = Taro.createCanvasContext('route-poster')
    context.setFillStyle('#f5eddf')
    context.fillRect(0, 0, 600, 900)
    context.setFillStyle('#67151b')
    context.fillRect(0, 0, 600, 245)
    context.setFillStyle('#d6a45b')
    context.setFontSize(18)
    context.fillText('JIANGXI · RED MEMORY', 38, 48)
    context.setFillStyle('#fff8eb')
    context.setFontSize(38)
    const titleBottom = drawWrappedText(context, plan.name, 38, 100, 520, 48, 2)
    context.setFillStyle('rgba(255,248,235,.72)')
    context.setFontSize(18)
    drawWrappedText(context, plan.angle, 38, titleBottom + 12, 520, 28, 2)
    context.setFillStyle('#2d211d')
    context.setFontSize(24)
    context.fillText(`${plan.days.length} 天 · ${plan.spots.length} 个点位 · ${plan.score} 分匹配`, 38, 292)
    context.setStrokeStyle('#d8c6af')
    context.beginPath()
    context.moveTo(38, 318)
    context.lineTo(562, 318)
    context.stroke()
    let stopY = 360
    plan.spots.slice(0, 9).forEach((spot, index) => {
      context.setFillStyle('#851f25')
      context.beginPath()
      context.arc(55, stopY - 7, 13, 0, Math.PI * 2)
      context.fill()
      context.setFillStyle('#fff8eb')
      context.setFontSize(13)
      context.fillText(String(index + 1), 51, stopY - 2)
      context.setFillStyle('#33241f')
      context.setFontSize(21)
      context.fillText(spot.short, 82, stopY)
      context.setFillStyle('#927d71')
      context.setFontSize(15)
      context.fillText(`${spot.region} · ${spot.county} · ${spot.minutes}分钟`, 82, stopY + 24)
      stopY += 57
    })
    if (plan.spots.length > 9) {
      context.setFillStyle('#927d71')
      context.setFontSize(16)
      context.fillText(`另有 ${plan.spots.length - 9} 个点位，请在小程序内查看`, 82, stopY)
    }
    context.setFillStyle('#2c211e')
    context.fillRect(0, 836, 600, 64)
    context.setFillStyle('#d6a45b')
    context.setFontSize(18)
    context.fillText('数智-红途 · 江西红色文旅智导', 38, 875)
    context.draw(false, async () => {
      try {
        const result = await Taro.canvasToTempFilePath({ canvasId: 'route-poster', width: 600, height: 900, destWidth: 1200, destHeight: 1800 })
        Taro.hideLoading()
        const action = await Taro.showModal({ title: '路线海报已生成', content: '可先预览，或直接保存到手机相册。', cancelText: '预览', confirmText: '保存相册', confirmColor: '#851f25' })
        if (action.confirm) {
          await Taro.saveImageToPhotosAlbum({ filePath: result.tempFilePath })
          Taro.showToast({ title: '海报已保存', icon: 'success' })
        } else {
          await Taro.previewImage({ urls: [result.tempFilePath], current: result.tempFilePath })
        }
      } catch {
        Taro.hideLoading()
        Taro.showModal({ title: '海报未能保存', content: '请在系统设置中允许访问相册后重试。', showCancel: false })
      }
    })
  }

  if (!plan) {
    return (
      <View className='page-shell route-detail-page route-missing'>
        <Text>路线没有找到</Text>
        <Text>分享链接可能已失效，也可以回到规划页重新生成。</Text>
        <Button className='tap-button missing-action' onClick={() => Taro.switchTab({ url: '/pages/planner/index' })}>返回智能规划</Button>
      </View>
    )
  }

  const progress = routeProgress(plan, completedIds)
  const travelLabel = travelModes.find((mode) => mode.value === plan.criteria.travelMode)?.label ?? '自驾'
  const summary = routeSummary(plan.spots, plan.criteria.travelMode)

  return (
    <View className='page-shell route-detail-page'>
      <View className='route-detail-hero'>
        <View className='route-detail-meta'><Text>YOUR RED JOURNEY</Text><Text>{plan.score} / 100</Text></View>
        <Text className='route-detail-angle'>{plan.angle}</Text>
        <Text className='route-detail-title'>{plan.name}</Text>
        <Text className='route-detail-reason'>{plan.reason}</Text>
        <View className='route-detail-facts'>
          <View><Text>{plan.days.length}</Text><Text>行程天数</Text></View>
          <View><Text>{plan.spots.length}</Text><Text>红色点位</Text></View>
          <View><Text>{travelLabel}</Text><Text>交通方式</Text></View>
        </View>
      </View>

      <View className='execution-card'>
        <View className='execution-title'>
          <View><Text>路线执行进度</Text><Text>到达后勾选点位，进度仅保存在本机</Text></View>
          <Text>{progress.percent}%</Text>
        </View>
        <Progress percent={progress.percent} strokeWidth={6} activeColor='#b77f3f' backgroundColor='#eadcca' borderRadius={0} />
        <Text className='execution-count'>已完成 {progress.completed} / {progress.total} 站</Text>
      </View>

      <View className='route-dimensions'>
        <View className='route-block-title'><Text>MATCH SCORE</Text><Text>路线为何适合你</Text></View>
        {plan.dimensions.map((item) => (
          <View className='route-dimension-row' key={item.label}>
            <Text>{item.label}</Text><View><View style={{ width: `${item.value}%` }} /></View><Text>{item.value}%</Text>
          </View>
        ))}
      </View>

      <View className='route-map-wrap'>
        <RouteMap spots={plan.spots} title='路线点位与行进顺序' onSpotTap={openSpotDetails} />
      </View>

      <View className='travel-board'>
        <View className='travel-board-head'>
          <View className='route-block-title'><Text>ROUTE PLAN</Text><Text>路段摘要 · {travelLabel}</Text></View>
          <View className='travel-stats'>
            <View><Text>{summary.driveKm.toFixed(0)}</Text><Text>公里车程</Text></View>
            <View><Text>{formatDuration(summary.driveMinutes)}</Text><Text>路上时间</Text></View>
            <View><Text>{formatDuration(summary.visitMinutes)}</Text><Text>参观时长</Text></View>
          </View>
        </View>
        <View className='travel-legs'>
          {summary.legs.map((leg, index) => (
            <View className='travel-leg' key={`${leg.from.id}-${leg.to.id}`}>
              <Text>{index + 1}</Text>
              <View className='travel-leg-copy'>
                <Text>{leg.from.short} → {leg.to.short}</Text>
                <Text>{leg.result.km.toFixed(1)} km · {formatDuration(leg.result.minutes)}</Text>
                {leg.result.segments?.map((segment, segmentIndex) => (
                  <View className='travel-segment' key={`${segment.kind}-${segmentIndex}`}>
                    <Text>{segment.kind === 'rail' ? '高铁/火车' : segment.kind === 'coach' ? '客运大巴' : '接驳'}</Text>
                    <Text>{segment.from} → {segment.to}</Text>
                    <Text>{formatDuration(segment.minutes)}</Text>
                  </View>
                ))}
                {leg.result.source === 'intercity-fallback' && <Text className='travel-warning'>跨市段暂无班次数据，暂按公路里程估算。</Text>}
              </View>
            </View>
          ))}
        </View>
      </View>

      <View className='route-days-detail'>
        {plan.days.map((day, dayIndex) => (
          <View className='route-day-card' key={`${plan.id}-${dayIndex}`}>
            <View className='route-day-head'>
              <View><Text>DAY</Text><Text>0{dayIndex + 1}</Text></View>
              <View><Text>{dayLabel(plan.criteria.startDate, dayIndex)}</Text><Text>{day.length} 处点位</Text></View>
            </View>

            <View className='route-day-stops'>
              {day.map((spot, stopIndex) => {
                const completed = completedIds.includes(spot.id)
                const routeIndex = plan.spots.findIndex((item) => item.id === spot.id)
                return (
                  <View className={`execution-stop ${completed ? 'execution-stop-complete' : ''}`} key={spot.id}>
                    <Button className='tap-button completion-button' onClick={() => toggleSpot(spot.id)}>{completed ? '✓' : stopIndex + 1}</Button>
                    <View className='execution-stop-copy'>
                      <Text className='stop-name'>{spot.name}</Text>
                      <Text className='stop-meta'>{spot.region} · {spot.county} · 建议 {spot.minutes} 分钟</Text>
                      <Text className='stop-intro'>{spot.intro}</Text>
                      <View className='edit-actions'>
                        <ActionPill className='route-edit-action' compact disabled={routeIndex === 0} onClick={() => applyEditedPlan(moveRouteSpot(plan, routeIndex, -1), '已上移点位')}>上移</ActionPill>
                        <ActionPill className='route-edit-action' compact disabled={routeIndex === plan.spots.length - 1} onClick={() => applyEditedPlan(moveRouteSpot(plan, routeIndex, 1), '已下移点位')}>下移</ActionPill>
                        <ActionPill className='route-edit-action' compact variant='primary' disabled={spot.core} onClick={() => applyEditedPlan(replaceRouteSpot(plan, routeIndex), '已替换同区域点位')}>替换</ActionPill>
                        <ActionPill className='route-edit-action' compact variant='danger' disabled={spot.core} onClick={() => applyEditedPlan(removeRouteSpot(plan, routeIndex), '已删除点位')}>删除</ActionPill>
                      </View>
                      {spot.core && <Text className='core-lock-note'>核心节点为保证路线叙事完整，不支持替换或删除</Text>}
                      <View className='spot-quick-actions'>
                        <ActionPill className='spot-quick-action' variant='tonal' onClick={() => openSpotLocation(spot)}>地图导航</ActionPill>
                        <ActionPill className='spot-quick-action' variant='primary' onClick={() => openSpotDetails(spot)}>查看详情</ActionPill>
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>
          </View>
        ))}
      </View>

      <View className='route-background'>
        <Text>路线导读</Text>
        <Text>{plan.background}</Text>
      </View>

      <View className='route-services'>
        <View className='service-column'>
          <View className='route-block-title'><Text>STAY</Text><Text>住宿参考</Text></View>
          {plan.services.hotels.map((link) => (
            <Button className='tap-button service-link' key={link.href} onClick={() => openExternalLink(link.href, link.label)}>
              <View><Text>{link.label}</Text><Text>{link.note}</Text></View><Text>复制链接 →</Text>
            </Button>
          ))}
        </View>
        <View className='service-column'>
          <View className='route-block-title'><Text>TRANSFER</Text><Text>包车与接驳</Text></View>
          {plan.services.charters.map((link) => (
            <Button className='tap-button service-link' key={link.href} onClick={() => openExternalLink(link.href, link.label)}>
              <View><Text>{link.label}</Text><Text>{link.note}</Text></View><Text>复制链接 →</Text>
            </Button>
          ))}
        </View>
      </View>

      <View className='route-detail-actions'>
        <Button className={`tap-button route-save ${isSaved ? 'route-saved' : ''}`} onClick={saveCurrentRoute}>{isSaved ? '已保存' : '保存路线'}</Button>
        <Button className='tap-button route-share' openType='share'>分享给同行人</Button>
        <Button className='tap-button route-poster' onClick={generatePoster}>生成路线海报</Button>
      </View>

      <Canvas canvasId='route-poster' className='route-poster-canvas' style={{ width: '600px', height: '900px' }} />
      <Text className='route-disclaimer'>开放时间与通行时间为演示资料，出发前请以场馆公告和实时路况为准。</Text>
    </View>
  )
}
