import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { BladePath, Marker, ValidationResult, Point } from '../types'
import { generateId, calculatePathLength } from '../utils/geometry'
import { validateBladePath, hasUnreviewedPaths, calculateTotalLength } from '../utils/validation'
import { useLayerStore } from './layerStore'
import { useCanvasStore } from './canvasStore'

export const useBladePathStore = defineStore('bladePath', () => {
  const bladePaths = ref<BladePath[]>([])
  const activeLayerId = ref<string | null>(null)

  const allBladePaths = computed(() => bladePaths.value)

  const visibleBladePaths = computed(() => {
    const layerStore = useLayerStore()
    return bladePaths.value.filter((p) => layerStore.visibleLayerIds.includes(p.layerId))
  })

  const unreviewedCount = computed(() => {
    return bladePaths.value.filter((p) => !p.isReviewed).length
  })

  const visibleUnreviewedCount = computed(() => {
    return visibleBladePaths.value.filter((p) => !p.isReviewed).length
  })

  const hasUnreviewed = computed(() => {
    return hasUnreviewedPaths(bladePaths.value)
  })

  const visibleHasUnreviewed = computed(() => {
    return visibleUnreviewedCount.value > 0
  })

  const totalLength = computed(() => {
    const layerStore = useLayerStore()
    return calculateTotalLength(bladePaths.value, layerStore.layers, true)
  })

  const totalPathCount = computed(() => bladePaths.value.length)

  const visiblePathCount = computed(() => visibleBladePaths.value.length)

  const hasDuplicateNumbers = computed(() => {
    const numbers = bladePaths.value.map((p) => p.pathNumber)
    const unique = new Set(numbers)
    return numbers.length !== unique.size
  })

  const visibleHasDuplicateNumbers = computed(() => {
    const numbers = visibleBladePaths.value.map((p) => p.pathNumber)
    const unique = new Set(numbers)
    return numbers.length !== unique.size
  })

  function getNextPathNumber(): string {
    const existingNumbers = bladePaths.value
      .map((p) => {
        const match = p.pathNumber.match(/^D-(\d+)$/)
        return match ? parseInt(match[1], 10) : 0
      })
      .filter((n) => n > 0)

    const maxNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0
    return `D-${String(maxNum + 1).padStart(3, '0')}`
  }

  function setActiveLayerId(id: string | null) {
    activeLayerId.value = id
  }

  function createBladePath(points: Point[], layerId?: string): BladePath {
    const targetLayerId = layerId || activeLayerId.value
    if (!targetLayerId) {
      throw new Error('请先选择一个图层')
    }

    const length = calculatePathLength(points)

    const newPath: BladePath = {
      id: generateId(),
      layerId: targetLayerId,
      pathNumber: getNextPathNumber(),
      points: [...points],
      bladeWidth: 2,
      isReviewed: false,
      notes: '',
      length,
      revisionMarkers: [],
      createdAt: Date.now()
    }

    return newPath
  }

  function addBladePath(path: BladePath): ValidationResult {
    const canvasStore = useCanvasStore()
    const result = validateBladePath(
      path,
      bladePaths.value,
      canvasStore.imageWidth,
      canvasStore.imageHeight
    )

    if (!result.valid) {
      return result
    }

    bladePaths.value.push(path)
    return { valid: true, errors: [] }
  }

  function isLayerLocked(layerId: string): boolean {
    const layerStore = useLayerStore()
    const layer = layerStore.getLayerById(layerId)
    return layer?.locked ?? false
  }

  function updateBladePath(id: string, updates: Partial<BladePath>): ValidationResult {
    const index = bladePaths.value.findIndex((p) => p.id === id)
    if (index === -1) {
      return { valid: false, errors: ['刀路不存在'] }
    }

    if (isLayerLocked(bladePaths.value[index].layerId)) {
      return { valid: false, errors: ['所属图层已锁定，无法修改'] }
    }

    const updatedPath = { ...bladePaths.value[index], ...updates }
    if (updates.points) {
      updatedPath.length = calculatePathLength(updates.points)
    }

    const canvasStore = useCanvasStore()
    const result = validateBladePath(
      updatedPath,
      bladePaths.value,
      canvasStore.imageWidth,
      canvasStore.imageHeight
    )

    if (!result.valid) {
      return result
    }

    bladePaths.value[index] = updatedPath
    return { valid: true, errors: [] }
  }

  function deleteBladePath(id: string): ValidationResult {
    const index = bladePaths.value.findIndex((p) => p.id === id)
    if (index === -1) {
      return { valid: false, errors: ['刀路不存在'] }
    }

    if (isLayerLocked(bladePaths.value[index].layerId)) {
      return { valid: false, errors: ['所属图层已锁定，无法删除'] }
    }

    bladePaths.value.splice(index, 1)
    return { valid: true, errors: [] }
  }

  function toggleReview(id: string): ValidationResult {
    const path = bladePaths.value.find((p) => p.id === id)
    if (!path) {
      return { valid: false, errors: ['刀路不存在'] }
    }

    if (isLayerLocked(path.layerId)) {
      return { valid: false, errors: ['所属图层已锁定，无法切换复核状态'] }
    }

    path.isReviewed = !path.isReviewed
    return { valid: true, errors: [] }
  }

  function addMarker(bladePathId: string, type: 'start' | 'end' | 'revision', x: number, y: number): { success: boolean; marker?: Marker; error?: string } {
    const path = bladePaths.value.find((p) => p.id === bladePathId)
    if (!path) {
      return { success: false, error: '刀路不存在' }
    }

    if (isLayerLocked(path.layerId)) {
      return { success: false, error: '所属图层已锁定，无法添加标注' }
    }

    const marker: Marker = {
      id: generateId(),
      bladePathId,
      type,
      x,
      y,
      createdAt: Date.now()
    }

    if (type === 'start') {
      path.startMarker = marker
    } else if (type === 'end') {
      path.endMarker = marker
    } else {
      path.revisionMarkers.push(marker)
    }

    return { success: true, marker }
  }

  function deleteMarker(markerId: string): ValidationResult {
    for (const path of bladePaths.value) {
      if (path.startMarker?.id === markerId) {
        if (isLayerLocked(path.layerId)) {
          return { valid: false, errors: ['所属图层已锁定，无法删除标注'] }
        }
        path.startMarker = undefined
        return { valid: true, errors: [] }
      }
      if (path.endMarker?.id === markerId) {
        if (isLayerLocked(path.layerId)) {
          return { valid: false, errors: ['所属图层已锁定，无法删除标注'] }
        }
        path.endMarker = undefined
        return { valid: true, errors: [] }
      }
      const revIndex = path.revisionMarkers.findIndex((m) => m.id === markerId)
      if (revIndex !== -1) {
        if (isLayerLocked(path.layerId)) {
          return { valid: false, errors: ['所属图层已锁定，无法删除标注'] }
        }
        path.revisionMarkers.splice(revIndex, 1)
        return { valid: true, errors: [] }
      }
    }
    return { valid: false, errors: ['标注不存在'] }
  }

  function getBladePathById(id: string): BladePath | undefined {
    return bladePaths.value.find((p) => p.id === id)
  }

  function getBladePathsByLayer(layerId: string): BladePath[] {
    return bladePaths.value.filter((p) => p.layerId === layerId)
  }

  function setBladePaths(paths: BladePath[]) {
    bladePaths.value = paths
  }

  function clearBladePaths() {
    bladePaths.value = []
  }

  function getDuplicateNumbers(): string[] {
    const countMap = new Map<string, number>()
    bladePaths.value.forEach((p) => {
      countMap.set(p.pathNumber, (countMap.get(p.pathNumber) || 0) + 1)
    })
    const duplicates: string[] = []
    countMap.forEach((count, num) => {
      if (count > 1) duplicates.push(num)
    })
    return duplicates
  }

  function getVisibleDuplicateNumbers(): string[] {
    const countMap = new Map<string, number>()
    visibleBladePaths.value.forEach((p) => {
      countMap.set(p.pathNumber, (countMap.get(p.pathNumber) || 0) + 1)
    })
    const duplicates: string[] = []
    countMap.forEach((count, num) => {
      if (count > 1) duplicates.push(num)
    })
    return duplicates
  }

  return {
    bladePaths,
    activeLayerId,
    allBladePaths,
    visibleBladePaths,
    unreviewedCount,
    visibleUnreviewedCount,
    hasUnreviewed,
    visibleHasUnreviewed,
    totalLength,
    totalPathCount,
    visiblePathCount,
    hasDuplicateNumbers,
    visibleHasDuplicateNumbers,
    setActiveLayerId,
    createBladePath,
    addBladePath,
    updateBladePath,
    deleteBladePath,
    toggleReview,
    addMarker,
    deleteMarker,
    getBladePathById,
    getBladePathsByLayer,
    setBladePaths,
    clearBladePaths,
    getNextPathNumber,
    getDuplicateNumbers,
    getVisibleDuplicateNumbers
  }
})
