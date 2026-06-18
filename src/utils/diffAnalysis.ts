import type {
  AnnotationScheme,
  BladePath,
  Marker,
  DiffAnalysisResult,
  DiffDetail,
  DiffType
} from '../types'
import {
  PATH_OFFSET_THRESHOLD,
  WIDTH_DIFFERENCE_THRESHOLD
} from '../types/collaboration'
import { calculatePathLength } from './geometry'

function findMatchingPathByNumber(
  pathNumber: string,
  paths: BladePath[]
): BladePath | undefined {
  return paths.find((p) => p.pathNumber === pathNumber)
}

function calculateAveragePointOffset(
  pointsA: { x: number; y: number }[],
  pointsB: { x: number; y: number }[]
): number {
  if (pointsA.length === 0 || pointsB.length === 0) return Infinity

  const minLen = Math.min(pointsA.length, pointsB.length)
  let totalOffset = 0

  for (let i = 0; i < minLen; i++) {
    const dx = pointsA[i].x - pointsB[i].x
    const dy = pointsA[i].y - pointsB[i].y
    totalOffset += Math.sqrt(dx * dx + dy * dy)
  }

  return totalOffset / minLen
}

function checkMarkerConsistency(
  markersA: { start?: Marker; end?: Marker; revision: Marker[] },
  markersB: { start?: Marker; end?: Marker; revision: Marker[] }
): { missing: string[]; consistent: boolean } {
  const missing: string[] = []

  if (markersA.start && !markersB.start) {
    missing.push('start')
  }
  if (markersA.end && !markersB.end) {
    missing.push('end')
  }
  if (markersA.revision.length > markersB.revision.length) {
    missing.push(`revision:${markersA.revision.length - markersB.revision.length}`)
  }

  return {
    missing,
    consistent: missing.length === 0
  }
}

export function analyzeSchemeDiff(
  schemeA: AnnotationScheme,
  schemeB: AnnotationScheme
): DiffAnalysisResult {
  const diffs: DiffDetail[] = []

  const allPathNumbers = new Set<string>()
  schemeA.bladePaths.forEach((p) => allPathNumbers.add(p.pathNumber))
  schemeB.bladePaths.forEach((p) => allPathNumbers.add(p.pathNumber))

  const pathNumberCount = new Map<string, number>()
  schemeA.bladePaths.forEach((p) => {
    pathNumberCount.set(p.pathNumber, (pathNumberCount.get(p.pathNumber) || 0) + 1)
  })
  schemeB.bladePaths.forEach((p) => {
    pathNumberCount.set(p.pathNumber, (pathNumberCount.get(p.pathNumber) || 0) + 1)
  })

  pathNumberCount.forEach((count, pathNumber) => {
    if (count > 2) {
      diffs.push({
        type: 'number_conflict',
        pathNumber,
        sourceSchemeId: schemeA.id,
        targetSchemeId: schemeB.id,
        description: `编号 "${pathNumber}" 在两个方案中重复出现 ${count} 次，存在编号冲突`,
        severity: 'error',
        data: {
          expectedValue: '唯一编号',
          actualValue: `重复 ${count} 次`
        }
      })
    }
  })

  allPathNumbers.forEach((pathNumber) => {
    const pathA = findMatchingPathByNumber(pathNumber, schemeA.bladePaths)
    const pathB = findMatchingPathByNumber(pathNumber, schemeB.bladePaths)

    if (!pathA && pathB) {
      diffs.push({
        type: 'path_added',
        pathNumber,
        pathId: pathB.id,
        sourceSchemeId: schemeA.id,
        targetSchemeId: schemeB.id,
        description: `方案 "${schemeB.researcher}" 新增刀路 "${pathNumber}"`,
        severity: 'info'
      })
      return
    }

    if (pathA && !pathB) {
      diffs.push({
        type: 'path_removed',
        pathNumber,
        pathId: pathA.id,
        sourceSchemeId: schemeA.id,
        targetSchemeId: schemeB.id,
        description: `方案 "${schemeB.researcher}" 缺少刀路 "${pathNumber}"`,
        severity: 'warning'
      })
      return
    }

    if (!pathA || !pathB) return

    const offset = calculateAveragePointOffset(pathA.points, pathB.points)
    if (offset > PATH_OFFSET_THRESHOLD) {
      diffs.push({
        type: 'path_offset',
        pathNumber,
        pathId: pathA.id,
        sourceSchemeId: schemeA.id,
        targetSchemeId: schemeB.id,
        description: `刀路 "${pathNumber}" 路径偏移，平均偏差 ${offset.toFixed(2)} px，超过阈值 ${PATH_OFFSET_THRESHOLD} px`,
        severity: 'warning',
        data: {
          offsetDistance: offset,
          expectedValue: PATH_OFFSET_THRESHOLD,
          actualValue: offset
        }
      })
    }

    const widthDiff = Math.abs(pathA.bladeWidth - pathB.bladeWidth)
    if (widthDiff > WIDTH_DIFFERENCE_THRESHOLD) {
      diffs.push({
        type: 'width_difference',
        pathNumber,
        pathId: pathA.id,
        sourceSchemeId: schemeA.id,
        targetSchemeId: schemeB.id,
        description: `刀路 "${pathNumber}" 宽度差异：方案A ${pathA.bladeWidth}px vs 方案B ${pathB.bladeWidth}px，差异 ${widthDiff.toFixed(2)} px`,
        severity: 'warning',
        data: {
          expectedValue: pathA.bladeWidth,
          actualValue: pathB.bladeWidth
        }
      })
    }

    const markerCheck = checkMarkerConsistency(
      {
        start: pathA.startMarker,
        end: pathA.endMarker,
        revision: pathA.revisionMarkers
      },
      {
        start: pathB.startMarker,
        end: pathB.endMarker,
        revision: pathB.revisionMarkers
      }
    )

    if (!markerCheck.consistent) {
      markerCheck.missing.forEach((missingType) => {
        diffs.push({
          type: 'marker_missing',
          pathNumber,
          pathId: pathA.id,
          sourceSchemeId: schemeA.id,
          targetSchemeId: schemeB.id,
          description: `刀路 "${pathNumber}" 标记缺失：${missingType} 标记在方案B中不存在`,
          severity: 'warning',
          data: {
            missingMarkerType: missingType
          }
        })
      })
    }
  })

  const stats = {
    totalDiffs: diffs.length,
    numberConflicts: diffs.filter((d) => d.type === 'number_conflict').length,
    pathOffsets: diffs.filter((d) => d.type === 'path_offset').length,
    widthDifferences: diffs.filter((d) => d.type === 'width_difference').length,
    markerMissings: diffs.filter((d) => d.type === 'marker_missing').length,
    addedPaths: diffs.filter((d) => d.type === 'path_added').length,
    removedPaths: diffs.filter((d) => d.type === 'path_removed').length
  }

  return {
    schemeAId: schemeA.id,
    schemeBId: schemeB.id,
    schemeAResearcher: schemeA.researcher,
    schemeBResearcher: schemeB.researcher,
    diffs,
    stats
  }
}

export function filterDiffsByType(
  result: DiffAnalysisResult,
  types: DiffType[]
): DiffDetail[] {
  if (types.length === 0) return result.diffs
  return result.diffs.filter((d) => types.includes(d.type))
}

export function getDiffSeverityCount(
  result: DiffAnalysisResult,
  severity: 'error' | 'warning' | 'info'
): number {
  return result.diffs.filter((d) => d.severity === severity).length
}

export function hasConflicts(result: DiffAnalysisResult): boolean {
  return (
    getDiffSeverityCount(result, 'error') > 0 ||
    result.stats.numberConflicts > 0
  )
}

export function getConflictingPathIds(result: DiffAnalysisResult): string[] {
  const ids = new Set<string>()
  result.diffs
    .filter((d) => d.severity === 'error' || d.type === 'number_conflict')
    .forEach((d) => {
      if (d.pathId) ids.add(d.pathId)
    })
  return Array.from(ids)
}

export function calculatePathSimilarity(pathA: BladePath, pathB: BladePath): number {
  if (pathA.points.length === 0 || pathB.points.length === 0) return 0

  const lenA = calculatePathLength(pathA.points)
  const lenB = calculatePathLength(pathB.points)

  const lengthSimilarity = Math.min(lenA, lenB) / Math.max(lenA, lenB)

  const offset = calculateAveragePointOffset(pathA.points, pathB.points)
  const offsetSimilarity = Math.max(0, 1 - offset / 50)

  const widthDiff = Math.abs(pathA.bladeWidth - pathB.bladeWidth)
  const widthSimilarity = Math.max(0, 1 - widthDiff / 5)

  return (lengthSimilarity * 0.3 + offsetSimilarity * 0.5 + widthSimilarity * 0.2) * 100
}
