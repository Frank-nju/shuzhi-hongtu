import { useMemo, useState } from 'react'
import Taro, { useDidShow, useLoad } from '@tarojs/taro'
import { Button, Text, View } from '@tarojs/components'
import {
  generatePlans,
  historyStages,
  parsePlannerCriteria,
  plannerDefaults,
  type HistoryStage,
  type Plan,
  type PlannerCriteria
} from '@shared/domain'
import { loadSavedRoutes, saveRoute, setActiveRoute } from '../../services/route-storage'
import { miniPlanPath } from '../../utils/route-link'
import './index.scss'

type RouteParams = Record<string, string | string[] | undefined>

export default function RoutesPage () {
  const [criteria, setCriteria] = useState<PlannerCriteria>(() => plannerDefaults())
  const [historyStage, setHistoryStage] = useState<HistoryStage | null>(null)
  const [savedPlanIds, setSavedPlanIds] = useState<string[]>([])

  useLoad<RouteParams>((params) => {
    setCriteria(parsePlannerCriteria(params))
    const stageId = Array.isArray(params.historyStage) ? params.historyStage[0] : params.historyStage
    setHistoryStage(historyStages.find((stage) => stage.id === stageId) ?? null)
  })

  useDidShow(() => {
    setSavedPlanIds(loadSavedRoutes().map((item) => item.plan.id))
  })

  const plans = useMemo(() => generatePlans(
    criteria.county,
    criteria.startDate,
    criteria.days,
    criteria.theme1,
    criteria.theme2,
    criteria.experience,
    criteria.purpose,
    criteria.travelMode
  ).slice(0, 5), [criteria])

  const savePlan = (plan: Plan) => {
    const saved = saveRoute(plan)
    setSavedPlanIds(saved.map((item) => item.plan.id))
    Taro.showToast({ title: '已保存新版本', icon: 'success' })
  }

  const openPlan = (plan: Plan) => {
    setActiveRoute(plan)
    Taro.navigateTo({ url: miniPlanPath(plan) })
  }

  return (
    <View className='page-shell routes-page'>
      <View className='routes-hero'>
        <Text>RECOMMENDED ROUTES / 推荐路线</Text>
        <Text>五条差异方案，{`\n`}选出最适合此行的一条</Text>
        <View className='criteria-summary'>
          <Text>{criteria.county}出发</Text><Text>{criteria.startDate}</Text><Text>{criteria.days} 天</Text>
          <Text>{criteria.theme1} × {criteria.theme2}</Text>
        </View>
        <Button className='tap-button replan-button' onClick={() => Taro.switchTab({ url: '/pages/planner/index' })}>← 重新规划</Button>
      </View>

      {historyStage && (
        <View className='history-route-summary'>
          <Text>{historyStage.number}</Text>
          <View>
            <Text>历史专题</Text>
            <Text>{historyStage.shortTitle}</Text>
            <Text>{historyStage.intro}</Text>
            <View><Text>{historyStage.period}</Text><Text>{historyStage.spotIds.length} 个专题点位</Text></View>
          </View>
          <Button className='tap-button history-return-button' onClick={() => Taro.navigateTo({ url: `/pages/history/index?stage=${historyStage.id}` })}>返回专题 →</Button>
        </View>
      )}

      <View className='routes-results'>
        {plans.length === 0 && (
          <View className='routes-empty'>
            <Text>暂无可行路线</Text>
            <Text>当前条件过于紧凑，请增加游览天数或调整出发日期。</Text>
          </View>
        )}

        {plans.length > 0 && <Text className='results-kicker'>为你找到 {plans.length} 条可行路线</Text>}
        {plans.map((plan, planIndex) => (
          <View className='plan-card' key={plan.id}>
            <View className='plan-head'>
              <Text className='plan-index'>0{planIndex + 1}</Text>
              <View className='plan-score'><Text>{plan.score}</Text><Text>综合匹配</Text></View>
            </View>
            <Text className='plan-angle'>{plan.angle}</Text>
            <Text className='plan-name'>{plan.name}</Text>
            <Text className='plan-reason'>{plan.reason}</Text>

            <View className='plan-days'>
              {plan.days.map((day, dayIndex) => (
                <View className='plan-day' key={`${plan.id}-${dayIndex}`}>
                  <View className='day-label'><Text>DAY</Text><Text>0{dayIndex + 1}</Text></View>
                  <View className='day-stops'>
                    {day.map((spot, stopIndex) => (
                      <View className='day-stop' key={spot.id}>
                        <Text>{stopIndex + 1}</Text>
                        <View><Text>{spot.name}</Text><Text>{spot.region} · 建议 {spot.minutes} 分钟</Text></View>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>

            <View className='plan-card-actions'>
              <Button className={`tap-button plan-save-button ${savedPlanIds.includes(plan.id) ? 'plan-saved-button' : ''}`} onClick={() => savePlan(plan)}>
                {savedPlanIds.includes(plan.id) ? '再存一版' : '保存路线'}
              </Button>
              <Button className='tap-button plan-open-button' onClick={() => openPlan(plan)}>查看行程 <Text>→</Text></Button>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}
