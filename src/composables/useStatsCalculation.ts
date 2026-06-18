import { computed } from 'vue'
import { useBladePathStore } from '../stores/bladePathStore'
import { useLayerStore } from '../stores/layerStore'
import { formatLength } from '../utils/geometry'

export function useStatsCalculation() {
  const bladePathStore = useBladePathStore()
  const layerStore = useLayerStore()

  const statsByLayer = computed(() => {
    return layerStore.sortedLayers.map((layer) => {
      const paths = bladePathStore.getBladePathsByLayer(layer.id)
      const totalLength = paths.reduce((sum, p) => sum + p.length, 0)
      const reviewedCount = paths.filter((p) => p.isReviewed).length

      return {
        layerId: layer.id,
        layerName: layer.name,
        layerColor: layer.color,
        visible: layer.visible,
        pathCount: paths.length,
        totalLength,
        totalLengthFormatted: formatLength(totalLength),
        reviewedCount,
        unreviewedCount: paths.length - reviewedCount,
        reviewProgress:
          paths.length > 0 ? Math.round((reviewedCount / paths.length) * 100) : 100
      }
    })
  })

  const overallStats = computed(() => {
    const allPaths = bladePathStore.allBladePaths
    const visiblePaths = bladePathStore.visibleBladePaths

    const visibleLength = visiblePaths.reduce((sum, p) => sum + p.length, 0)
    const totalLength = allPaths.reduce((sum, p) => sum + p.length, 0)
    const reviewedCount = allPaths.filter((p) => p.isReviewed).length

    return {
      totalPathCount: allPaths.length,
      visiblePathCount: visiblePaths.length,
      totalLength,
      totalLengthFormatted: formatLength(totalLength),
      visibleLength,
      visibleLengthFormatted: formatLength(visibleLength),
      reviewedCount,
      unreviewedCount: allPaths.length - reviewedCount,
      reviewProgress:
        allPaths.length > 0 ? Math.round((reviewedCount / allPaths.length) * 100) : 100
    }
  })

  const widthDistribution = computed(() => {
    const widthMap = new Map<number, number>()
    bladePathStore.allBladePaths.forEach((p) => {
      const width = p.bladeWidth
      widthMap.set(width, (widthMap.get(width) || 0) + 1)
    })
    return Array.from(widthMap.entries())
      .map(([width, count]) => ({ width, count }))
      .sort((a, b) => a.width - b.width)
  })

  function getLayerStats(layerId: string) {
    return statsByLayer.value.find((s) => s.layerId === layerId)
  }

  return {
    statsByLayer,
    overallStats,
    widthDistribution,
    getLayerStats
  }
}
