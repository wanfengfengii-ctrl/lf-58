import type {
  AnnotationScheme,
  BladePath,
  Layer,
  PublishValidationResult
} from '../types'
import { calculateTotalLength } from './validation'

export function getVisibleLayerPaths(
  bladePaths: BladePath[],
  layers: Layer[]
): BladePath[] {
  const visibleLayerIds = layers.filter((l) => l.visible).map((l) => l.id)
  return bladePaths.filter((p) => visibleLayerIds.includes(p.layerId))
}

export function getHiddenLayerPaths(
  bladePaths: BladePath[],
  layers: Layer[]
): BladePath[] {
  const hiddenLayerIds = layers.filter((l) => !l.visible).map((l) => l.id)
  return bladePaths.filter((p) => hiddenLayerIds.includes(p.layerId))
}

export function getUnreviewedPaths(bladePaths: BladePath[]): BladePath[] {
  return bladePaths.filter((p) => !p.isReviewed)
}

export function getDuplicateNumberPaths(bladePaths: BladePath[]): BladePath[] {
  const numberCount = new Map<string, number>()
  bladePaths.forEach((p) => {
    numberCount.set(p.pathNumber, (numberCount.get(p.pathNumber) || 0) + 1)
  })

  return bladePaths.filter((p) => (numberCount.get(p.pathNumber) || 0) > 1)
}

export function validatePublish(
  scheme: AnnotationScheme,
  layers: Layer[]
): PublishValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const allBladePaths = scheme.bladePaths
  const visiblePaths = getVisibleLayerPaths(allBladePaths, layers)
  const hiddenPaths = getHiddenLayerPaths(allBladePaths, layers)
  const unreviewedPaths = getUnreviewedPaths(visiblePaths)
  const duplicatePaths = getDuplicateNumberPaths(visiblePaths)

  if (unreviewedPaths.length > 0) {
    errors.push(
      `存在 ${unreviewedPaths.length} 条未复核的刀路，请先完成所有复核。`
    )
  }

  if (duplicatePaths.length > 0) {
    const duplicateNumbers = Array.from(
      new Set(duplicatePaths.map((p) => p.pathNumber))
    )
    errors.push(
      `存在重复的刀路编号：${duplicateNumbers.join(', ')}，请修正后再发布。`
    )
  }

  if (visiblePaths.length === 0) {
    errors.push('没有可见的刀路图层，无法发布。')
  }

  if (hiddenPaths.length > 0) {
    const hiddenLayerNames = Array.from(
      new Set(
        hiddenPaths
          .map((p) => layers.find((l) => l.id === p.layerId)?.name)
          .filter(Boolean)
      )
    )
    warnings.push(
      `隐藏图层（${hiddenLayerNames.join(', ')}）包含 ${hiddenPaths.length} 条刀路，统计时将自动忽略这些刀路。`
    )
  }

  const totalVisibleLength = calculateTotalLength(allBladePaths, layers, true)
  const totalAllLength = calculateTotalLength(allBladePaths, layers, false)

  if (hiddenPaths.length > 0 && Math.abs(totalVisibleLength - totalAllLength) > 0.1) {
    warnings.push(
      `发布统计将仅计算可见图层，总长度 ${totalVisibleLength.toFixed(1)} px（排除隐藏图层 ${(totalAllLength - totalVisibleLength).toFixed(1)} px）。`
    )
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    unreviewedPaths: unreviewedPaths.map((p) => p.pathNumber),
    hiddenLayerPaths: hiddenPaths.map((p) => p.pathNumber),
    conflictingPaths: duplicatePaths.map((p) => p.pathNumber)
  }
}

export function validateMerge(
  sourceScheme: AnnotationScheme,
  targetScheme: AnnotationScheme,
  hasConflicts: boolean
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  if (hasConflicts) {
    errors.push(
      '方案存在冲突（编号重复或严重差异），禁止一键合并。请先手动解决所有冲突。'
    )
  }

  if (
    sourceScheme.image.width !== targetScheme.image.width ||
    sourceScheme.image.height !== targetScheme.image.height
  ) {
    errors.push('两个方案的图像尺寸不一致，无法合并。')
  }

  const sourceUnreviewed = getUnreviewedPaths(sourceScheme.bladePaths)
  if (sourceUnreviewed.length > 0) {
    warnings.push(
      `源方案存在 ${sourceUnreviewed.length} 条未复核刀路，合并后需要重新复核。`
    )
  }

  const targetUnreviewed = getUnreviewedPaths(targetScheme.bladePaths)
  if (targetUnreviewed.length > 0) {
    warnings.push(
      `目标方案存在 ${targetUnreviewed.length} 条未复核刀路，合并后需要重新复核。`
    )
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

export function calculatePublishStats(
  scheme: AnnotationScheme,
  layers: Layer[]
): {
  totalPaths: number
  visiblePaths: number
  hiddenPaths: number
  reviewedPaths: number
  unreviewedPaths: number
  totalLength: number
  visibleLength: number
  hiddenLength: number
  reviewProgress: number
} {
  const visiblePaths = getVisibleLayerPaths(scheme.bladePaths, layers)
  const hiddenPaths = getHiddenLayerPaths(scheme.bladePaths, layers)
  const reviewedPaths = visiblePaths.filter((p) => p.isReviewed)

  const visibleLength = visiblePaths.reduce((sum, p) => sum + p.length, 0)
  const hiddenLength = hiddenPaths.reduce((sum, p) => sum + p.length, 0)

  return {
    totalPaths: scheme.bladePaths.length,
    visiblePaths: visiblePaths.length,
    hiddenPaths: hiddenPaths.length,
    reviewedPaths: reviewedPaths.length,
    unreviewedPaths: visiblePaths.length - reviewedPaths.length,
    totalLength: visibleLength + hiddenLength,
    visibleLength,
    hiddenLength,
    reviewProgress:
      visiblePaths.length > 0
        ? Math.round((reviewedPaths.length / visiblePaths.length) * 100)
        : 100
  }
}
