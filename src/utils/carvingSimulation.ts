import type {
  BladeToolParams,
  BladeType,
  CuttingStrokeConfig,
  PathExecutionOrder,
  SimulatedCarvePoint,
  SimulatedBladePath,
  SimulatedBoard,
  CarvingBoardPixel,
  LayerCarvingResult,
  BladeCutEffect,
  RevisionSimEffect,
  ErrorHotspot,
  SimulationContext,
  ExperimentConfig,
  BladePath,
  Point
} from '../types'
import { generateId } from './geometry'

export const BLADE_TYPE_LABELS: Record<BladeType, string> = {
  flat: '平刀',
  round: '圆刀',
  angled: '斜口刀',
  spear: '剑形刀',
  diamond: '菱形刀'
}

export const DEFAULT_PRESET_TOOLS: BladeToolParams[] = [
  {
    id: 'tool-flat-2mm',
    name: '平刀 2mm',
    bladeType: 'flat',
    nominalWidth: 2,
    edgeAngle: 25,
    tipSharpness: 0.9,
    flexibility: 0.3,
    wearLevel: 0.05
  },
  {
    id: 'tool-round-1.5mm',
    name: '圆口刀 1.5mm',
    bladeType: 'round',
    nominalWidth: 1.5,
    edgeAngle: 30,
    tipSharpness: 0.85,
    flexibility: 0.5,
    wearLevel: 0.03
  },
  {
    id: 'tool-angled-45',
    name: '斜口刀 45°',
    bladeType: 'angled',
    nominalWidth: 1.8,
    edgeAngle: 45,
    tipSharpness: 0.95,
    flexibility: 0.2,
    wearLevel: 0.08
  },
  {
    id: 'tool-spear-fine',
    name: '剑形精刻刀',
    bladeType: 'spear',
    nominalWidth: 0.8,
    edgeAngle: 20,
    tipSharpness: 0.98,
    flexibility: 0.4,
    wearLevel: 0.02
  },
  {
    id: 'tool-diamond',
    name: '菱形刻刀',
    bladeType: 'diamond',
    nominalWidth: 1.2,
    edgeAngle: 35,
    tipSharpness: 0.92,
    flexibility: 0.35,
    wearLevel: 0.04
  }
]

export const DEFAULT_EXPERIMENT_CONFIG: ExperimentConfig = {
  targetWidthDeviation: 0.15,
  targetDepthDeviation: 0.2,
  hotspotSeverityThreshold: 0.4,
  maxRounds: 20,
  autoOptimize: false
}

export function createDefaultStrokeConfig(): CuttingStrokeConfig {
  return {
    pressure: 0.7,
    speed: 0.5,
    angle: 90,
    depth: 0.6
  }
}

export function generateDefaultExecutionOrders(
  bladePaths: BladePath[],
  layers: { id: string; order: number }[]
): PathExecutionOrder[] {
  const sortedByLayer = [...bladePaths].sort((a, b) => {
    const layerA = layers.find((l) => l.id === a.layerId)
    const layerB = layers.find((l) => l.id === b.layerId)
    const orderA = layerA?.order ?? 0
    const orderB = layerB?.order ?? 0
    if (orderA !== orderB) return orderA - orderB
    return a.pathNumber.localeCompare(b.pathNumber)
  })

  return sortedByLayer.map((path, idx) => ({
    pathId: path.id,
    orderIndex: idx,
    layerId: path.layerId,
    strokeConfig: createDefaultStrokeConfig(),
    toolParamsId: DEFAULT_PRESET_TOOLS[0].id
  }))
}

function calculateEffectiveWidth(
  tool: BladeToolParams,
  stroke: CuttingStrokeConfig,
  targetWidth: number
): number {
  const pressureFactor = 0.5 + stroke.pressure * 0.8
  const angleFactor = Math.sin((stroke.angle * Math.PI) / 180)
  const wearFactor = 1 + tool.wearLevel * 0.3
  const sharpnessFactor = 0.8 + tool.tipSharpness * 0.2

  let typeFactor = 1
  switch (tool.bladeType) {
    case 'flat':
      typeFactor = 1.0
      break
    case 'round':
      typeFactor = 0.85
      break
    case 'angled':
      typeFactor = 1.1
      break
    case 'spear':
      typeFactor = 0.6
      break
    case 'diamond':
      typeFactor = 0.75
      break
  }

  const rawWidth = tool.nominalWidth * pressureFactor * angleFactor * wearFactor * sharpnessFactor * typeFactor
  const deviation = targetWidth > 0 ? Math.abs(rawWidth - targetWidth) / targetWidth : 0
  return Math.max(0.1, rawWidth * (1 - deviation * 0.3))
}

function calculateEffectiveDepth(
  tool: BladeToolParams,
  stroke: CuttingStrokeConfig
): number {
  const pressureDepth = stroke.depth * stroke.pressure
  const flexibilityReduction = tool.flexibility * 0.15
  const wearReduction = tool.wearLevel * 0.1
  return Math.max(0.05, Math.min(1, pressureDepth - flexibilityReduction - wearReduction))
}

function determineCutEffect(
  tool: BladeToolParams,
  stroke: CuttingStrokeConfig,
  isStart: boolean
): BladeCutEffect {
  const sharpness = tool.tipSharpness
  const speed = stroke.speed
  const pressure = stroke.pressure

  if (sharpness < 0.5) return 'rounded'
  if (speed > 0.85 && pressure < 0.3) return 'torn'
  if (pressure > 0.9 && isStart) return 'overcut'
  if (pressure < 0.2) return 'undercut'
  if (speed > 0.9 && sharpness < 0.7) return 'chipped'
  return 'clean'
}

function samplePathPoints(points: Point[], targetCount: number): Point[] {
  if (points.length <= targetCount) return points
  const result: Point[] = []
  const step = (points.length - 1) / (targetCount - 1)
  for (let i = 0; i < targetCount; i++) {
    const idx = Math.floor(i * step)
    result.push(points[Math.min(idx, points.length - 1)])
  }
  return result
}

export function simulateBladePath(
  originalPath: BladePath,
  order: PathExecutionOrder,
  tool: BladeToolParams,
  simStartTime: number
): SimulatedBladePath {
  const targetWidth = originalPath.bladeWidth || 2
  const effectiveWidth = calculateEffectiveWidth(tool, order.strokeConfig, targetWidth)
  const effectiveDepth = calculateEffectiveDepth(tool, order.strokeConfig)

  const sampleCount = Math.min(200, Math.max(30, Math.floor(originalPath.length / 3)))
  const sampledPoints = samplePathPoints(originalPath.points, sampleCount)

  const executedPoints: SimulatedCarvePoint[] = sampledPoints.map((pt, idx) => {
    const progress = idx / Math.max(1, sampledPoints.length - 1)
    const entryFactor = idx < 5 ? 0.6 + (idx / 5) * 0.4 : 1
    const exitFactor = idx > sampledPoints.length - 6 ? 0.6 + ((sampledPoints.length - 1 - idx) / 5) * 0.4 : 1
    const microVariation = 0.95 + (Math.sin(idx * 0.7) * 0.03) + (Math.cos(idx * 1.3) * 0.02)

    return {
      x: pt.x,
      y: pt.y,
      depth: effectiveDepth * entryFactor * exitFactor * microVariation,
      width: effectiveWidth * microVariation,
      pressure: order.strokeConfig.pressure * entryFactor * exitFactor,
      timestamp: simStartTime + idx * 10 + order.orderIndex * 100
    }
  })

  const revisionEffects: RevisionSimEffect[] = (originalPath.revisionMarkers || []).map((marker) => {
    const quality = 0.5 + Math.random() * 0.4
    const types: RevisionSimEffect['effectType'][] = ['fill', 'recarve', 'smooth', 'patch']
    return {
      markerId: marker.id,
      position: { x: marker.x, y: marker.y },
      effectType: types[Math.floor(Math.random() * types.length)],
      qualityScore: quality
    }
  })

  return {
    originalPathId: originalPath.id,
    pathNumber: originalPath.pathNumber,
    executedPoints,
    toolParamsId: tool.id,
    strokeConfig: { ...order.strokeConfig },
    orderIndex: order.orderIndex,
    layerId: originalPath.layerId,
    effectiveWidth,
    startEffect: determineCutEffect(tool, order.strokeConfig, true),
    endEffect: determineCutEffect(tool, order.strokeConfig, false),
    revisionEffects
  }
}

export function createEmptyBoard(width: number, height: number): SimulatedBoard {
  const pixelStep = 4
  const cols = Math.ceil(width / pixelStep)
  const rows = Math.ceil(height / pixelStep)
  const pixels: CarvingBoardPixel[][] = []

  for (let r = 0; r < rows; r++) {
    const row: CarvingBoardPixel[] = []
    for (let c = 0; c < cols; c++) {
      row.push({
        x: c * pixelStep,
        y: r * pixelStep,
        depth: 0,
        carveCount: 0,
        pathIds: [],
        errorValue: 0
      })
    }
    pixels.push(row)
  }

  return {
    width,
    height,
    pixels,
    totalCarvedArea: 0,
    averageDepth: 0,
    depthVariance: 0
  }
}

function getPixelAt(board: SimulatedBoard, x: number, y: number): CarvingBoardPixel | null {
  const pixelStep = 4
  const c = Math.floor(x / pixelStep)
  const r = Math.floor(y / pixelStep)
  if (r < 0 || r >= board.pixels.length || c < 0 || c >= board.pixels[0].length) return null
  return board.pixels[r][c]
}

export function carveBoardWithPath(
  board: SimulatedBoard,
  simPath: SimulatedBladePath
): void {
  const points = simPath.executedPoints
  for (let i = 0; i < points.length; i++) {
    const pt = points[i]
    const halfWidth = pt.width / 2
    const radius = Math.max(2, halfWidth + 1)

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > radius) continue

        const pixel = getPixelAt(board, pt.x + dx, pt.y + dy)
        if (!pixel) continue

        const falloff = Math.max(0, 1 - dist / radius)
        const depthContribution = pt.depth * falloff

        pixel.depth = Math.max(pixel.depth, depthContribution)
        pixel.carveCount += 1
        if (!pixel.pathIds.includes(simPath.originalPathId)) {
          pixel.pathIds.push(simPath.originalPathId)
        }
      }
    }
  }
}

export function finalizeBoardStats(board: SimulatedBoard): void {
  let totalDepth = 0
  let carvedPixels = 0
  const depths: number[] = []

  for (const row of board.pixels) {
    for (const px of row) {
      if (px.depth > 0.01) {
        totalDepth += px.depth
        carvedPixels++
        depths.push(px.depth)
      }
    }
  }

  const pixelArea = 16
  board.totalCarvedArea = carvedPixels * pixelArea
  board.averageDepth = carvedPixels > 0 ? totalDepth / carvedPixels : 0

  if (depths.length > 0) {
    const mean = board.averageDepth
    const variance = depths.reduce((sum, d) => sum + (d - mean) * (d - mean), 0) / depths.length
    board.depthVariance = variance
  }
}

export function computeLayerResults(
  simulatedPaths: SimulatedBladePath[],
  layers: { id: string; name: string; order: number }[]
): LayerCarvingResult[] {
  return layers.map((layer) => {
    const layerPaths = simulatedPaths.filter((p) => p.layerId === layer.id)

    let totalTargetWidth = 0
    let totalEffectiveWidth = 0
    layerPaths.forEach((p) => {
      totalTargetWidth += 1
      totalEffectiveWidth += p.effectiveWidth
    })

    const avgQuality = layerPaths.length > 0
      ? layerPaths.reduce((sum, p) => {
          let score = 1
          if (p.startEffect !== 'clean') score -= 0.05
          if (p.endEffect !== 'clean') score -= 0.05
          score -= p.revisionEffects.filter((r) => r.qualityScore < 0.6).length * 0.03
          return sum + Math.max(0.3, Math.min(1, score))
        }, 0) / layerPaths.length
      : 0

    return {
      layerId: layer.id,
      layerName: layer.name,
      layerOrder: layer.order,
      simulatedPaths: layerPaths,
      coverageRate: layerPaths.length > 0 ? Math.min(1, layerPaths.length / 10) : 0,
      overlapRate: 0.15,
      layerQualityScore: avgQuality
    }
  })
}

export function detectErrorHotspots(
  board: SimulatedBoard,
  simulatedPaths: SimulatedBladePath[],
  originalPaths: BladePath[],
  config: ExperimentConfig
): ErrorHotspot[] {
  const hotspots: ErrorHotspot[] = []
  const hotspotMap = new Map<string, { error: number; paths: string[]; count: number; category: ErrorHotspot['category'] }>()

  const pathWidthMap = new Map(originalPaths.map((p) => [p.id, p.bladeWidth || 2]))
  const simWidthMap = new Map(simulatedPaths.map((p) => [p.originalPathId, p.effectiveWidth]))

  for (const row of board.pixels) {
    for (const px of row) {
      if (px.carveCount === 0) continue

      let errorScore = 0
      let category: ErrorHotspot['category'] | null = null

      if (px.carveCount > 3) {
        errorScore = Math.min(1, (px.carveCount - 3) * 0.2)
        category = 'overlap'
      }

      if (px.pathIds.length > 0) {
        const pid = px.pathIds[0]
        const targetW = pathWidthMap.get(pid) || 2
        const simW = simWidthMap.get(pid) || 2
        const widthDev = Math.abs(simW - targetW) / targetW
        if (widthDev > config.targetWidthDeviation) {
          errorScore = Math.max(errorScore, Math.min(1, widthDev))
          if (!category) category = 'width_deviation'
        }
      }

      if (px.depth > 0.9) {
        errorScore = Math.max(errorScore, 0.6)
        if (!category) category = 'depth_deviation'
      }

      for (const p of simulatedPaths) {
        if (p.startEffect !== 'clean' || p.endEffect !== 'clean') {
          const firstPt = p.executedPoints[0]
          const lastPt = p.executedPoints[p.executedPoints.length - 1]
          const distToFirst = firstPt ? Math.sqrt((px.x - firstPt.x) ** 2 + (px.y - firstPt.y) ** 2) : 999
          const distToLast = lastPt ? Math.sqrt((px.x - lastPt.x) ** 2 + (px.y - lastPt.y) ** 2) : 999
          if (distToFirst < 10 || distToLast < 10) {
            errorScore = Math.max(errorScore, 0.5)
            category = 'edge_quality'
          }
        }
      }

      if (errorScore >= config.hotspotSeverityThreshold && category) {
        const gridKey = `${Math.floor(px.x / 20)}-${Math.floor(px.y / 20)}`
        const existing = hotspotMap.get(gridKey)
        if (existing) {
          existing.error = Math.max(existing.error, errorScore)
          existing.count += 1
          px.pathIds.forEach((id) => {
            if (!existing.paths.includes(id)) existing.paths.push(id)
          })
        } else {
          hotspotMap.set(gridKey, {
            error: errorScore,
            paths: [...px.pathIds],
            count: 1,
            category
          })
        }
      }
    }
  }

  hotspotMap.forEach((data, key) => {
    const [gx, gy] = key.split('-').map(Number)
    let severity: ErrorHotspot['severity'] = 'minor'
    if (data.error >= 0.75) severity = 'critical'
    else if (data.error >= 0.5) severity = 'moderate'

    const descMap: Record<ErrorHotspot['category'], string> = {
      width_deviation: '刀痕宽度偏差超出阈值',
      depth_deviation: '下刀深度偏差过大',
      overlap: '刀路重叠严重',
      missed_carve: '存在漏刻区域',
      edge_quality: '起收刀处刀痕质量不佳'
    }

    hotspots.push({
      id: `hotspot-${generateId()}`,
      x: gx * 20 + 10,
      y: gy * 20 + 10,
      radius: 15 + data.count * 2,
      errorScore: data.error,
      severity,
      category: data.category,
      affectedPathIds: data.paths,
      description: descMap[data.category]
    })
  })

  return hotspots.sort((a, b) => b.errorScore - a.errorScore)
}

export function computeOverallScores(
  board: SimulatedBoard,
  layerResults: LayerCarvingResult[],
  hotspots: ErrorHotspot[],
  originalPaths: BladePath[],
  simulatedPaths: SimulatedBladePath[]
): { quality: number; similarity: number; widthDev: number; depthDev: number } {
  const layerQualityAvg = layerResults.length > 0
    ? layerResults.reduce((s, l) => s + l.layerQualityScore, 0) / layerResults.length
    : 0.5

  const hotspotPenalty = Math.min(0.4, hotspots.length * 0.02 + hotspots.filter((h) => h.severity === 'critical').length * 0.05)

  let widthDevSum = 0
  let widthCount = 0
  simulatedPaths.forEach((sp) => {
    const orig = originalPaths.find((op) => op.id === sp.originalPathId)
    if (orig) {
      const dev = Math.abs(sp.effectiveWidth - (orig.bladeWidth || 2)) / (orig.bladeWidth || 2)
      widthDevSum += dev
      widthCount++
    }
  })
  const widthDev = widthCount > 0 ? widthDevSum / widthCount : 0.5

  const depthDev = Math.sqrt(board.depthVariance) * 2

  const quality = Math.max(0, Math.min(1, layerQualityAvg - hotspotPenalty))
  const similarity = Math.max(0, Math.min(1, 1 - (widthDev * 0.4 + depthDev * 0.3 + hotspotPenalty * 0.3)))

  return { quality, similarity, widthDev, depthDev }
}

export function runCarvingSimulation(context: SimulationContext): {
  simulatedPaths: SimulatedBladePath[]
  board: SimulatedBoard
  layerResults: LayerCarvingResult[]
  hotspots: ErrorHotspot[]
  scores: { quality: number; similarity: number; widthDev: number; depthDev: number }
} {
  const startTime = Date.now()
  const toolMap = new Map(context.toolParams.map((t) => [t.id, t]))

  const sortedOrders = [...context.executionOrders].sort((a, b) => a.orderIndex - b.orderIndex)

  const simulatedPaths: SimulatedBladePath[] = sortedOrders.map((order) => {
    const originalPath = context.bladePaths.find((p) => p.id === order.pathId)
    const tool = toolMap.get(order.toolParamsId) || context.toolParams[0] || DEFAULT_PRESET_TOOLS[0]
    if (!originalPath) return null
    return simulateBladePath(originalPath, order, tool, startTime)
  }).filter(Boolean) as SimulatedBladePath[]

  const board = createEmptyBoard(context.imageWidth, context.imageHeight)
  simulatedPaths.forEach((sp) => carveBoardWithPath(board, sp))
  finalizeBoardStats(board)

  const layerInfo = context.layers.map((l) => ({ id: l.id, name: l.name, order: l.order }))
  const layerResults = computeLayerResults(simulatedPaths, layerInfo)

  const hotspots = detectErrorHotspots(board, simulatedPaths, context.bladePaths, context.config)

  const scores = computeOverallScores(board, layerResults, hotspots, context.bladePaths, simulatedPaths)

  return { simulatedPaths, board, layerResults, hotspots, scores }
}
