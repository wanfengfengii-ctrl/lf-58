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

  const hasUnreviewedPaths = computed(() => bladePathStore.hasUnreviewed)
  const unreviewedCount = computed(() => bladePathStore.unreviewedCount)
  const hasDuplicatePathNumbers = computed(() => bladePathStore.hasDuplicateNumbers)
  const duplicateNumbers = computed(() => bladePathStore.getDuplicateNumbers())

  const reviewProgress = computed(() => {
    if (bladePathStore.totalPathCount === 0) return 100
    return Math.round(
      ((bladePathStore.totalPathCount - bladePathStore.unreviewedCount) /
        bladePathStore.totalPathCount) *
        100
    )
  })

  const totalVisibleLength = computed(() => bladePathStore.totalLength)
  const totalPathCount = computed(() => bladePathStore.totalPathCount)

  function canMarkComplete(): { canComplete: boolean; reason?: string } {
    if (hasUnreviewedPaths.value) {
      return {
        canComplete: false,
        reason: `存在 ${unreviewedCount.value} 条未复核刀路，请先完成所有复核。`
      }
    }

    if (hasDuplicatePathNumbers.value) {
      return {
        canComplete: false,
        reason: `存在重复的刀路编号：${duplicateNumbers.value.join(', ')}，请修正后再标记完成。`
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
    reviewProgress,
    totalVisibleLength,
    totalPathCount,
    canMarkComplete,
    tryMarkComplete,
    tryUnmarkComplete,
    validateBeforeSave
  }
}
