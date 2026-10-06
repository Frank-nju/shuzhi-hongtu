import { useMemo, useState } from 'react'
import Taro, { useLoad, useShareAppMessage } from '@tarojs/taro'
import { Button, ScrollView, Text, View } from '@tarojs/components'
import { historyStages, plannerDefaults, spots, type PlannerCriteria } from '@shared/domain'
import CloudImage from '../../components/cloud-image'
import RouteMap from '../../components/route-map'
import { setPlannerPreset } from '../../services/planner-preset'
import { openExternalLink } from '../../utils/external-link'
import './index.scss'

const stagePresets: Record<string, Partial<PlannerCriteria>> = {
  'stage-01': { county: '安源区', days: 1, theme1: '重大事件', theme2: '群众支前', experience: '现场观察', purpose: '思政学习', travelMode: 'charter' },
  'stage-02': { county: '井冈山市', days: 2, theme1: '军事斗争', theme2: '革命精神', experience: '深度讲解', purpose: '社会实践', travelMode: 'charter' },
  'stage-03': { county: '瑞金市', days: 3, theme1: '政权建设', theme2: '群众支前', experience: '深度讲解', purpose: '专题调研', travelMode: 'charter' },
  'stage-04': { county: '于都县', days: 3, theme1: '长征文化', theme2: '革命精神', experience: '现场观察', purpose: '思政学习', travelMode: 'charter' }
}

export default function HistoryPage () {
  const [activeStageId, setActiveStageId] = useState(historyStages[0].id)
  const [openQuestion, setOpenQuestion] = useState('')
  const stage = historyStages.find((item) => item.id === activeStageId) ?? historyStages[0]
  const stageSpots = useMemo(
    () => stage.spotIds.map((id) => spots.find((spot) => spot.id === id)).filter((spot): spot is typeof spots[number] => Boolean(spot)),
    [stage]
  )
  const featuredSpots = stage.featuredSpots
    .map((item) => spots.find((spot) => spot.id === item.id))
    .filter((spot): spot is typeof spots[number] => Boolean(spot))

  useLoad<{ stage?: string }>((params) => {
    if (historyStages.some((item) => item.id === params.stage)) setActiveStageId(params.stage!)
  })

  useShareAppMessage(() => ({ title: `${stage.shortTitle}｜江西红色历史专题`, path: `/pages/history/index?stage=${stage.id}` }))

  const planStage = () => {
    const historyContext = {
      id: stage.id,
      number: stage.number,
      shortTitle: stage.shortTitle,
      period: stage.period,
      intro: stage.intro,
      spotIds: stage.spotIds
    }
    setPlannerPreset({ ...plannerDefaults(), ...stagePresets[stage.id] }, historyContext)
    Taro.switchTab({ url: '/pages/planner/index' })
  }
  const openSpot = (spotId: string) => Taro.navigateTo({ url: `/pages/landmark-detail/index?spotId=${spotId}` })

  return (
    <View className='page-shell history-page'>
      <View className='history-hero'>
        <Text>HISTORY TRAIL</Text>
        <Text>你想从哪一段历史出发？</Text>
        <Text>四个专题串起工人运动、井冈山道路、中央苏区与长征出发，让点位回到历史进程中。</Text>
      </View>

      <ScrollView className='history-tabs' scrollX enhanced showScrollbar={false}>
        <View className='history-tab-track'>
          {historyStages.map((item) => (
            <View className={`history-tab ${item.id === stage.id ? 'history-tab-active' : ''}`} key={item.id} onClick={() => { setActiveStageId(item.id); setOpenQuestion('') }}>
              <Text>{item.number}</Text><Text>{item.shortTitle}</Text><Text>{item.period}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View className='history-chapter-head'>
        <Text>{stage.number} · {stage.period} · {stage.mapStyle}</Text>
        <Text>{stage.title}</Text>
        <Text>{stage.titleSource}</Text>
        <Text>{stage.intro}</Text>
        <View><Text>“{stage.stageQuote}”</Text><Text>{stage.stageQuoteSource}</Text></View>
        <Button className='tap-button history-plan-action' onClick={planStage}>规划本章路线 <Text>→</Text></Button>
      </View>

      <View className='history-artwork-panel'>
        <CloudImage assetDirectory='history' src={stage.artwork} mode='aspectFill' lazyLoad />
        <View><Text>专题艺术图</Text><Text>{stage.artworkCaption}</Text><Text>{stage.mapStyle} · {stage.representative}</Text></View>
      </View>

      <View className='history-map-wrap'>
        <View className='history-relative-map'>
          <View><Text>RELATIVE LOCATION</Text><Text>点位相对位置图</Text></View>
          <CloudImage assetDirectory='history' src={stage.mapImage} mode='widthFix' lazyLoad />
        </View>
        <RouteMap spots={stageSpots} title={`${stage.shortTitle} · 景点位置`} onSpotTap={(spot) => openSpot(spot.id)} />
        <View className='history-map-quote'><Text>“{stage.mapQuote}”</Text><Text>{stage.mapQuoteSource}</Text></View>
      </View>

      <View className='history-section'>
        <View className='history-section-title'><Text>HISTORICAL EVENTS</Text><Text>阶段事件</Text></View>
        <View className='event-list'>
          {stage.events.map((event) => (
            <View className='event-item' key={`${event.year}-${event.title}`}>
              <Text>{event.year}</Text><View><Text>{event.title}</Text><Text>{event.text}</Text></View>
            </View>
          ))}
        </View>
      </View>

      <View className='history-section'>
        <View className='history-section-title'><Text>REPRESENTATIVE SITES</Text><Text>代表景点</Text></View>
        <View className='history-featured-grid'>
          {featuredSpots.map((spot) => (
            <View className='history-featured-card' key={spot.id} onClick={() => openSpot(spot.id)}>
              <CloudImage assetDirectory='landmarks' src={spot.image} mode='aspectFill' lazyLoad />
              <View><Text>{spot.region}</Text><Text>{spot.name}</Text><Text>查看完整参观信息 →</Text></View>
            </View>
          ))}
        </View>
      </View>

      <View className='history-section'>
        <View className='history-section-title'><Text>STUDY QUESTIONS</Text><Text>研学问答</Text></View>
        {stage.qa.map((item) => (
          <View className='history-qa-item' key={item.question} onClick={() => setOpenQuestion((current) => current === item.question ? '' : item.question)}>
            <View><Text>{item.question}</Text><Text>{openQuestion === item.question ? '−' : '+'}</Text></View>
            {openQuestion === item.question && <Text>{item.answer}</Text>}
          </View>
        ))}
      </View>

      <View className='history-sources'>
        <View className='history-section-title'><Text>RELATED READING</Text><Text>相关文章与资料</Text></View>
        {stage.sources.map((source, index) => (
          <Button className='tap-button source-link' key={source.url} onClick={() => openExternalLink(source.url, '资料来源')}>
            <Text>{String(index + 1).padStart(2, '0')}</Text><Text>{source.label}</Text><Text>复制链接</Text>
          </Button>
        ))}
      </View>
    </View>
  )
}
