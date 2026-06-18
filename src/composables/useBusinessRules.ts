import { computed } from 'vue'
import { useBladePathStore } from '../stores/bladePathStore'
import { useLayerStore } from '../stores/layerStore'
import { useProjectStore } from '../stores/projectStore'
import { useMessage } from 'naive-ui'

export function useBusinessRules() {
  const bladePathStore = useBladePathStore()
  const layerStore = useLayerStore()
  const projectStore = useProjectStore()
  const message = useMessage()

  const hasUnreviewedPaths = computed(() => bladePathStore.visibleHasUnreviewed)
  const unreviewedCount = computed(() => bladePathStore.visibleUnreviewedCount)
  const hasDuplicatePathNumbers = computed(() => bladePathStore.visibleHasDuplicateNumbers)
  const duplicateNumbers = computed(() => bladePathStore.getVisibleDuplicateNumbers())

  const hiddenPathCount = computed(() =>
    bladePathStore.totalPathCount - bladePathStore.visiblePathCount
  )
  const hiddenUnreviewedCount = computed(() =>
    bladePathStore.unreviewedCount - bladePathStore.visibleUnreviewedCount
  )

  const reviewProgress = computed(() => {
    if (bladePathStore.visiblePathCount === 0) return 100
    return Math.round(
      ((bladePathStore.visiblePathCount - bladePathStore.visibleUnreviewedCount) /
        bladePathStore.visiblePathCount) *
        100
    )
  })

  const totalVisibleLength = computed(() => bladePathStore.totalLength)
  const totalPathCount = computed(() => bladePathStore.totalPathCount)
  const visiblePathCount = computed(() => bladePathStore.visiblePathCount)

  function canMarkComplete(): { canComplete: boolean; reason?: string } {
    if (bladePathStore.visiblePathCount === 0) {
      return {
        canComplete: false,
        reason: '没有可见的刀路图层，无法标记完成。'
      }
    }

    if (hasUnreviewedPaths.value) {
      let reason = `可见图层中存在 ${unreviewedCount.value} 条未复核刀路，请先完成所有复核。`
      if (hiddenPathCount.value > 0) {
        reason += `（隐藏图层有 ${hiddenPathCount.value} 条刀路，不参与统计）`
      }
      return { canComplete: false, reason }
    }

    if (hasDuplicatePathNumbers.value) {
      return {
        canComplete: false,
        reason: `可见图层中存在重复的刀路编号：${duplicateNumbers.value.join(', ')}，请修正后再标记完成。`
      }
    }

    return { canComplete: true }
  }

  function tryMarkComplete(): boolean {
    const result = projectStore.markAsComplete()

    if (!result.valid) {
      result.errors.forEach((err) => message.error(err))
      return false
    }

    message.success('已标记为复原完成')
    return true
  }

  function tryUnmarkComplete(): void {
    projectStore.unmarkComplete()
    message.info('已取消完成标记')
  }

  function validateBeforeSave(): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (hasDuplicatePathNumbers.value) {
      errors.push(`存在重复的刀路编号：${duplicateNumbers.value.join(', ')}`)
    }

    if (hasUnreviewedPaths.value) {
      errors.push(`存在 ${unreviewedCount.value} 条未复核刀路`)
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  return {
    hasUnreviewedPaths,
    unreviewedCount,
    hasDuplicatePathNumbers,
    duplicateNumbers,
    hiddenPathCount,
    hiddenUnreviewedCount,
    reviewProgress,
    totalVisibleLength,
    totalPathCount,
    visiblePathCount,
    canMarkComplete,
    tryMarkComplete,
    tryUnmarkComplete,
    validateBeforeSave
  }
}
