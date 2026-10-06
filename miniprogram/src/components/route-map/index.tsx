import { useEffect, useMemo, useState } from 'react'
import { Map, ScrollView, Text, View } from '@tarojs/components'
import type { Spot } from '@shared/domain'
import { loadRouteGeometry } from '../../services/route-geometry'
import { countyPolygons, coverageCountyNames } from '../../utils/county-polygons'
import { spotToWechatMapPoint } from '../../utils/map-coordinates'
import { buildRoutePolylines, type RouteGeometryPairs } from '../../utils/route-geometry'
import './index.scss'

type RouteMapProps = {
  spots: Spot[]
  title?: string
  showPolyline?: boolean
  compact?: boolean
  overviewMode?: boolean
  onSpotTap?: (spot: Spot) => void
}

export default function RouteMap ({
  spots,
  title = '点位地图',
  showPolyline = true,
  compact = false,
  overviewMode = false,
  onSpotTap
}: RouteMapProps) {
  const [mapScale, setMapScale] = useState(overviewMode ? 7 : 8)
  const [geometryPairs, setGeometryPairs] = useState<RouteGeometryPairs | null | undefined>(undefined)
  const polygons = useMemo(() => countyPolygons(spots), [spots])
  const countyNames = useMemo(() => coverageCountyNames(spots), [spots])
  const routeLines = useMemo(() => buildRoutePolylines(spots, geometryPairs), [spots, geometryPairs])

  useEffect(() => {
    if (!showPolyline || spots.length < 2) {
      setGeometryPairs(null)
      return
    }
    let active = true
    setGeometryPairs(undefined)
    void loadRouteGeometry().then((pairs) => {
      if (active) setGeometryPairs(pairs)
    })
    return () => { active = false }
  }, [showPolyline, spots.length])

  if (spots.length === 0) return null

  const points = spots.map(spotToWechatMapPoint)
  const center = points.reduce(
    (result, point) => ({ latitude: result.latitude + point.latitude / points.length, longitude: result.longitude + point.longitude / points.length }),
    { latitude: 0, longitude: 0 }
  )
  const indexedSpots = spots.map((spot, sourceIndex) => ({ spot, sourceIndex }))
  const visibleSpots = overviewMode
    ? mapScale < 8
      ? []
      : mapScale < 9
        ? indexedSpots.filter(({ spot }) => spot.core)
        : indexedSpots
    : indexedSpots
  const markers = visibleSpots.map(({ spot, sourceIndex }) => {
    const point = points[sourceIndex]
    return {
      id: sourceIndex + 1,
      latitude: point.latitude,
      longitude: point.longitude,
      title: `${sourceIndex + 1}. ${spot.short}`,
      iconPath: '/map/marker-anchor.png',
      width: 1,
      height: 1,
      anchor: { x: 0.5, y: 0.5 },
      ariaLabel: `第 ${sourceIndex + 1} 处，${spot.name}`,
      label: {
        content: String(sourceIndex + 1),
        color: '#ffffff',
        fontSize: compact ? 10 : 11,
        anchorX: compact ? -8 : -9,
        anchorY: compact ? -8 : -9,
        borderRadius: compact ? 9 : 10,
        borderWidth: 1,
        borderColor: '#ffffff',
        bgColor: '#da291c',
        padding: compact ? 3 : 4,
        textAlign: 'center' as const
      },
      callout: {
        content: spot.short,
        color: '#a71911',
        fontSize: 12,
        anchorX: 0,
        anchorY: -28,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#f2b8b3',
        bgColor: '#fffaf7',
        padding: 5,
        display: overviewMode && mapScale >= 9 ? 'ALWAYS' as const : 'BYCLICK' as const,
        textAlign: 'center' as const
      }
    }
  })
  const openMarker = (markerId: number | string) => {
    const spot = spots[Number(markerId) - 1]
    if (spot) onSpotTap?.(spot)
  }
  const legendLimit = compact ? 4 : 8
  const legendSpots = overviewMode ? spots : spots.slice(0, legendLimit)
  const legendItems = (
    <View className='route-map-legend-grid'>
      {legendSpots.map((spot, index) => (
        <View className='route-map-legend-item' key={spot.id} onClick={() => onSpotTap?.(spot)}>
          <Text className='route-map-legend-index'>{index + 1}</Text>
          <View className='route-map-legend-copy'>
            <Text className='route-map-legend-name'>{spot.short}</Text>
            <Text className='route-map-legend-county'>{spot.region} · {spot.county}</Text>
          </View>
        </View>
      ))}
    </View>
  )
  const polyline = showPolyline ? routeLines.polylines : []
  const routeStatus = geometryPairs === undefined
    ? '正在加载道路路线…'
    : routeLines.matchedSegments === routeLines.totalSegments
      ? `真实道路路线 · ${routeLines.totalSegments} 段`
      : routeLines.matchedSegments > 0
        ? `道路路线 ${routeLines.matchedSegments}/${routeLines.totalSegments} 段 · 其余为直线示意`
        : '直线示意 · 云端道路数据未加载'

  return (
    <View className={`route-map-shell ${compact ? 'route-map-compact' : ''} ${overviewMode ? 'route-map-overview' : ''}`}>
      <View className='route-map-head'>
        <View><Text>MAP OVERVIEW</Text><Text>{title}</Text></View>
        <Text>{spots.length} 个点位</Text>
      </View>
      <Map
        className='route-map'
        longitude={center.longitude}
        latitude={center.latitude}
        scale={overviewMode ? mapScale : 8}
        markers={markers}
        polygons={polygons}
        polyline={polyline}
        includePoints={overviewMode && mapScale > 7 ? undefined : showPolyline ? routeLines.includePoints : points}
        showScale
        enableZoom
        enableScroll
        onError={() => undefined}
        onRegionChange={(event) => {
          const detail = event.detail as unknown as { type?: string; scale?: number; detail?: { scale?: number } }
          if (!overviewMode || detail.type !== 'end') return
          const nextScale = Number(detail.scale ?? detail.detail?.scale)
          if (Number.isFinite(nextScale)) setMapScale(nextScale)
        }}
        onMarkerTap={(event) => {
          openMarker(event.detail.markerId)
        }}
        onLabelTap={(event) => {
          openMarker(event.detail.markerId)
        }}
      />
      <View className='route-map-coverage'>
        <Text>资源覆盖县区 · {countyNames.length}</Text>
        <Text>{overviewMode ? mapScale < 8 ? '放大查看核心点位' : mapScale < 9 ? '核心点位模式' : '全部点位与名称' : showPolyline && points.length > 1 ? routeStatus : countyNames.join('、')}</Text>
      </View>
      <View className='route-map-legend'>
        {overviewMode && <View className='route-map-legend-head'><Text>全部 {spots.length} 处点位</Text><Text>编号与地图一致</Text></View>}
        {overviewMode
          ? <ScrollView className='route-map-legend-scroll' scrollY enhanced showScrollbar ariaLabel='全部点位列表，上下滑动查看'>{legendItems}</ScrollView>
          : legendItems}
        {overviewMode && <Text className='route-map-legend-hint'>上下滑动查看全部 {spots.length} 处点位</Text>}
        {!overviewMode && spots.length > legendLimit && <Text className='route-map-more'>另有 {spots.length - legendLimit} 处点位，可在地图中缩放查看</Text>}
      </View>
    </View>
  )
}
