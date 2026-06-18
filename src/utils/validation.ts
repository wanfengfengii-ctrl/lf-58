import type { BladePath, Point, ValidationResult, AnnotationScheme, Layer } from '../types'
import { pointInImage } from './geometry'

export function validateBladeWidth(width: number): boolean {
  return width > 0
}

export function validatePathNumberUnique(
  pathNumber: string,
  allPaths: BladePath[],
  excludeId?: string
): boolean {
  return !allPaths.some(
    (p) => p.pathNumber === pathNumber && p.id !== excludeId
  )
}

export function validatePointInImage(
  point: Point,
  imageWidth: number,
  imageHeight: number
): boolean {
  return pointInImage(point, imageWidth, imageHeight)
}

export function validateBladePath(
  path: BladePath,
  allPaths: BladePath[],
  imageWidth: number,
  imageHeight: number
): ValidationResult {
  const errors: string[] = []

  if (!validateBladeWidth(path.bladeWidth)) {
    errors.push('刀痕宽度必须大于 0')
  }

  if (!validatePathNumberUnique(path.pathNumber, allPaths, path.id)) {
    errors.push(`刀路编号 "${path.pathNumber}" 已存在，不能重复`)
  }

  if (path.points.length > 0) {
    const startPoint = path.points[0]
    if (!validatePointInImage(startPoint, imageWidth, imageHeight)) {
      errors.push('起刀点必须落在图像范围内')
    }

    const endPoint = path.points[path.points.length - 1]
    if (!validatePointInImage(endPoint, imageWidth, imageHeight)) {
      errors.push('收刀点必须落在图像范围内')
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

export function validateSchemeBounds(
  scheme: AnnotationScheme,
  imageWidth: number,
  imageHeight: number
): { valid: boolean; invalidPaths: string[] } {
  const invalidPaths: string[] = []

  for (const path of scheme.bladePaths) {
    if (path.points.length > 0) {
      const startPoint = path.points[0]
      const endPoint = path.points[path.points.length - 1]
      if (
        !pointInImage(startPoint, imageWidth, imageHeight) ||
        !pointInImage(endPoint, imageWidth, imageHeight)
      ) {
        invalidPaths.push(path.pathNumber)
      }
    }
  }

  return {
    valid: invalidPaths.length === 0,
    invalidPaths
  }
}

export function hasUnreviewedPaths(paths: BladePath[]): boolean {
  return paths.some((p) => !p.isReviewed)
}

export function calculateTotalLength(
  paths: BladePath[],
  layers: Layer[],
  onlyVisible: boolean = true
): number {
  const visibleLayerIds = onlyVisible
    ? layers.filter((l) => l.visible).map((l) => l.id)
    : layers.map((l) => l.id)

  return paths
    .filter((p) => visibleLayerIds.includes(p.layerId))
    .reduce((sum, p) => sum + p.length, 0)
}
