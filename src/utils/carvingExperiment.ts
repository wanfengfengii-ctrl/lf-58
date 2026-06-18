import type {
  CarvingExperiment,
  ExperimentRound,
  BladeToolParams,
  PathExecutionOrder,
  ParamChangeRecord,
  ParameterTraceEntry,
  ExperimentConclusion,
  SimulationContext,
  ExperimentConfig,
  AnnotationScheme,
  BladePath,
  Layer,
  ErrorHotspot
} from '../types'
import { generateId } from './geometry'
import {
  runCarvingSimulation,
  DEFAULT_PRESET_TOOLS,
  DEFAULT_EXPERIMENT_CONFIG,
  generateDefaultExecutionOrders
} from './carvingSimulation'

export function createNewExperiment(
  scheme: AnnotationScheme,
  createdBy: string = '研究员'
): CarvingExperiment {
  return {
    id: `exp-${generateId()}`,
    name: `${scheme.projectName} - 版刻复刻实验`,
    description: `基于「${scheme.projectName}」的已标注刀路数据，进行版刻工艺模拟与复刻实验`,
    createdAt: Date.now(),
    createdBy,
    schemeId: scheme.id,
    schemeName: scheme.projectName,
    referenceImageUrl: scheme.image.url,
    rounds: [],
    parameterTrace: [],
    isCompleted: false,
    currentRoundIndex: -1
  }
}

export function buildSimulationContext(
  scheme: AnnotationScheme,
  toolParams: BladeToolParams[],
  executionOrders: PathExecutionOrder[],
  config?: Partial<ExperimentConfig>
): SimulationContext {
  return {
    bladePaths: scheme.bladePaths || [],
    layers: scheme.layers || [],
    imageWidth: scheme.image.width,
    imageHeight: scheme.image.height,
    toolParams: toolParams.length > 0 ? toolParams : [...DEFAULT_PRESET_TOOLS],
    executionOrders: executionOrders.length > 0
      ? executionOrders
      : generateDefaultExecutionOrders(scheme.bladePaths || [], scheme.layers || []),
    config: { ...DEFAULT_EXPERIMENT_CONFIG, ...(config || {}) }
  }
}

function detectParamChanges(
  prevTools: BladeToolParams[],
  newTools: BladeToolParams[],
  prevOrders: PathExecutionOrder[],
  newOrders: PathExecutionOrder[]
): ParamChangeRecord[] {
  const changes: ParamChangeRecord[] = []
  const now = Date.now()

  const prevToolMap = new Map(prevTools.map((t) => [t.id, t]))
  newTools.forEach((tool) => {
    const prev = prevToolMap.get(tool.id)
    if (prev) {
      const fields: (keyof BladeToolParams)[] = ['nominalWidth', 'edgeAngle', 'tipSharpness', 'flexibility', 'wearLevel', 'bladeType']
      fields.forEach((f) => {
        if ((prev as any)[f] !== (tool as any)[f]) {
          changes.push({
            field: f,
            oldValue: (prev as any)[f],
            newValue: (tool as any)[f],
            targetType: 'tool',
            targetId: tool.id,
            changedAt: now
          })
        }
      })
    }
  })

  const prevOrderMap = new Map(prevOrders.map((o) => [o.pathId, o]))
  newOrders.forEach((order) => {
    const prev = prevOrderMap.get(order.pathId)
    if (prev) {
      if (prev.orderIndex !== order.orderIndex) {
        changes.push({
          field: 'orderIndex',
          oldValue: prev.orderIndex,
          newValue: order.orderIndex,
          targetType: 'order',
          targetId: order.pathId,
          changedAt: now
        })
      }
      if (prev.toolParamsId !== order.toolParamsId) {
        changes.push({
          field: 'toolParamsId',
          oldValue: prev.toolParamsId,
          newValue: order.toolParamsId,
          targetType: 'order',
          targetId: order.pathId,
          changedAt: now
        })
      }
      const strokeFields: (keyof typeof order.strokeConfig)[] = ['pressure', 'speed', 'angle', 'depth']
      strokeFields.forEach((f) => {
        if (prev.strokeConfig[f] !== order.strokeConfig[f]) {
          changes.push({
            field: `strokeConfig.${f}`,
            oldValue: prev.strokeConfig[f],
            newValue: order.strokeConfig[f],
            targetType: 'stroke',
            targetId: order.pathId,
            changedAt: now
          })
        }
      })
    }
  })

  return changes
}

export function executeExperimentRound(
  experiment: CarvingExperiment,
  scheme: AnnotationScheme,
  toolParams: BladeToolParams[],
  executionOrders: PathExecutionOrder[],
  config?: Partial<ExperimentConfig>,
  roundName?: string,
  notes?: string
): { experiment: CarvingExperiment; round: ExperimentRound } {
  const roundNumber = experiment.rounds.length + 1
  const parentRound = experiment.rounds[experiment.rounds.length - 1]

  const context = buildSimulationContext(scheme, toolParams, executionOrders, config)
  const result = runCarvingSimulation(context)

  const toolParamsMap: Record<string, BladeToolParams> = {}
  toolParams.forEach((t) => { toolParamsMap[t.id] = t })

  const paramChanges = parentRound
    ? detectParamChanges(
        Object.values(parentRound.toolParamsMap),
        toolParams,
        parentRound.executionOrders,
        executionOrders
      )
    : []

  const round: ExperimentRound = {
    roundId: `round-${generateId()}`,
    roundNumber,
    name: roundName || `第 ${roundNumber} 轮实验`,
    timestamp: Date.now(),
    toolParamsMap,
    executionOrders: JSON.parse(JSON.stringify(executionOrders)),
    layerResults: result.layerResults,
    simulatedBoard: result.board,
    hotspots: result.hotspots,
    overallQualityScore: result.scores.quality,
    overallSimilarity: result.scores.similarity,
    widthDeviation: result.scores.widthDev,
    depthDeviation: result.scores.depthDev,
    notes: notes || '',
    parentRoundId: parentRound?.roundId,
    paramChanges
  }

  const traceEntry: ParameterTraceEntry = {
    roundId: round.roundId,
    roundNumber,
    timestamp: round.timestamp,
    toolParams: JSON.parse(JSON.stringify(toolParams)),
    executionOrders: JSON.parse(JSON.stringify(executionOrders)),
    qualityScore: result.scores.quality,
    similarityScore: result.scores.similarity,
    keyDecisions: paramChanges.length > 0
      ? paramChanges.map((c) => `调整 ${c.targetType === 'tool' ? '刻刀' : c.targetType === 'stroke' ? '运刀' : '顺序'} 参数: ${c.field} ${c.oldValue} → ${c.newValue}`)
      : ['初始参数配置']
  }

  const updatedExperiment: CarvingExperiment = {
    ...experiment,
    rounds: [...experiment.rounds, round],
    parameterTrace: [...experiment.parameterTrace, traceEntry],
    currentRoundIndex: experiment.rounds.length
  }

  return { experiment: updatedExperiment, round }
}

export function suggestNextRoundParams(
  currentRound: ExperimentRound,
  toolParams: BladeToolParams[],
  executionOrders: PathExecutionOrder[]
): { toolParams: BladeToolParams[]; executionOrders: PathExecutionOrder[]; suggestions: string[] } {
  const suggestions: string[] = []
  const newTools = toolParams.map((t) => ({ ...t }))
  const newOrders = executionOrders.map((o) => ({
    ...o,
    strokeConfig: { ...o.strokeConfig }
  }))

  if (currentRound.widthDeviation > 0.15) {
    suggestions.push(`当前宽度偏差 ${(currentRound.widthDeviation * 100).toFixed(1)}% 偏高，建议微调刻刀宽度或运刀压力`)
    const hotPaths = new Set(
      currentRound.hotspots
        .filter((h) => h.category === 'width_deviation')
        .flatMap((h) => h.affectedPathIds)
    )
    newOrders.forEach((o) => {
      if (hotPaths.has(o.pathId)) {
        o.strokeConfig.pressure = Math.max(0.3, Math.min(0.95, o.strokeConfig.pressure - 0.05))
      }
    })
  }

  if (currentRound.depthDeviation > 0.2) {
    suggestions.push(`深度方差较大，建议调整下刀深度和运刀速度的一致性`)
    newOrders.forEach((o) => {
      o.strokeConfig.depth = Math.max(0.3, Math.min(0.9, o.strokeConfig.depth))
      o.strokeConfig.speed = 0.5
    })
  }

  const criticalHotspots = currentRound.hotspots.filter((h) => h.severity === 'critical')
  if (criticalHotspots.length > 0) {
    const edgeIssues = criticalHotspots.filter((h) => h.category === 'edge_quality')
    if (edgeIssues.length > 0) {
      suggestions.push(`检测到 ${edgeIssues.length} 处起收刀质量问题，建议使用锋度更高的刻刀或调整起收刀速度`)
      newTools.forEach((t) => {
        if (t.tipSharpness < 0.9) {
          t.tipSharpness = Math.min(0.99, t.tipSharpness + 0.05)
        }
      })
    }

    const overlapIssues = criticalHotspots.filter((h) => h.category === 'overlap')
    if (overlapIssues.length > 0) {
      suggestions.push(`检测到 ${overlapIssues.length} 处严重刀路重叠，建议调整下刀顺序或减少运刀次数`)
    }
  }

  if (currentRound.overallSimilarity < 0.7) {
    suggestions.push(`整体相似度 ${(currentRound.overallSimilarity * 100).toFixed(1)}% 较低，建议综合调整多项参数`)
  }

  if (suggestions.length === 0) {
    suggestions.push('当前参数表现良好，可尝试小幅度微调以追求更优效果')
  }

  return { toolParams: newTools, executionOrders: newOrders, suggestions }
}

function identifyErrorPatterns(rounds: ExperimentRound[]): { pattern: string; frequency: number; suggestion: string }[] {
  const patterns: { pattern: string; frequency: number; suggestion: string }[] = []
  const categoryCount = new Map<ErrorHotspot['category'], number>()

  rounds.forEach((r) => {
    r.hotspots.forEach((h) => {
      categoryCount.set(h.category, (categoryCount.get(h.category) || 0) + 1)
    })
  })

  const totalHotspots = rounds.reduce((s, r) => s + r.hotspots.length, 0)
  categoryCount.forEach((count, category) => {
    const freq = totalHotspots > 0 ? count / totalHotspots : 0
    let pattern = ''
    let suggestion = ''

    switch (category) {
      case 'width_deviation':
        pattern = '刀痕宽度一致性不足'
        suggestion = '统一刻刀型号，保持稳定的运刀压力与角度'
        break
      case 'depth_deviation':
        pattern = '下刀深度波动较大'
        suggestion = '控制运刀力度，使用辅助定位装置保持深度一致'
        break
      case 'overlap':
        pattern = '刀路重叠现象频繁'
        suggestion = '优化下刀顺序规划，减少重复刻划区域'
        break
      case 'edge_quality':
        pattern = '起收刀处刀痕毛糙'
        suggestion = '更换锋度更高的刻刀，起刀轻入、收刀慢提'
        break
      case 'missed_carve':
        pattern = '存在漏刻区域'
        suggestion = '刻前复核刀路完整性，注意细节区域的补刻'
        break
    }

    if (pattern) {
      patterns.push({ pattern, frequency: freq, suggestion })
    }
  })

  return patterns.sort((a, b) => b.frequency - a.frequency)
}

function extractKeyFindings(rounds: ExperimentRound[]): string[] {
  const findings: string[] = []

  if (rounds.length >= 2) {
    const first = rounds[0]
    const last = rounds[rounds.length - 1]
    const qualityGain = last.overallQualityScore - first.overallQualityScore
    const similarityGain = last.overallSimilarity - first.overallSimilarity

    if (qualityGain > 0.05) {
      findings.push(`经过 ${rounds.length} 轮参数迭代，版面质量评分从 ${(first.overallQualityScore * 100).toFixed(1)} 提升至 ${(last.overallQualityScore * 100).toFixed(1)}，提升 ${(qualityGain * 100).toFixed(1)} 个百分点`)
    }
    if (similarityGain > 0.05) {
      findings.push(`与原版相似度从 ${(first.overallSimilarity * 100).toFixed(1)}% 提升至 ${(last.overallSimilarity * 100).toFixed(1)}%`)
    }

    const bestRound = rounds.reduce((best, r) => r.overallSimilarity > best.overallSimilarity ? r : best, rounds[0])
    if (bestRound.roundNumber !== rounds.length) {
      findings.push(`第 ${bestRound.roundNumber} 轮实验取得最佳相似度 ${(bestRound.overallSimilarity * 100).toFixed(1)}%`)
    }
  }

  const avgWidthDev = rounds.reduce((s, r) => s + r.widthDeviation, 0) / rounds.length
  findings.push(`${rounds.length} 轮实验的平均宽度偏差为 ${(avgWidthDev * 100).toFixed(1)}%`)

  const totalHotspots = rounds.reduce((s, r) => s + r.hotspots.length, 0)
  findings.push(`累计检测到 ${totalHotspots} 处误差热区`)

  return findings
}

export function generateExperimentConclusion(
  experiment: CarvingExperiment
): ExperimentConclusion {
  const rounds = experiment.rounds
  if (rounds.length === 0) {
    throw new Error('至少需要完成一轮实验才能生成结论')
  }

  const bestRound = rounds.reduce((best, r) =>
    r.overallSimilarity > best.overallSimilarity ? r : best
  )

  const optimalTools = Object.values(bestRound.toolParamsMap)
  const optimalStrategy = bestRound.executionOrders

  const qualityTrend = rounds.map((r) => r.overallQualityScore)
  const similarityTrend = rounds.map((r) => r.overallSimilarity)

  const patterns = identifyErrorPatterns(rounds)
  const findings = extractKeyFindings(rounds)

  const recommendations: string[] = []
  if (bestRound.overallSimilarity >= 0.85) {
    recommendations.push('当前参数组合已达到较高复刻精度，可作为标准工艺方案使用')
  } else if (bestRound.overallSimilarity >= 0.7) {
    recommendations.push('建议针对主要误差类型进行针对性参数调优，预期可进一步提升 5-10% 的相似度')
  } else {
    recommendations.push('建议重新评估刻刀选型与基础工艺参数，考虑更换刀型或调整运刀手法')
  }
  recommendations.push(`推荐参考第 ${bestRound.roundNumber} 轮实验参数进行实物试刻`)
  if (patterns.length > 0) {
    recommendations.push(`重点关注「${patterns[0].pattern}」问题：${patterns[0].suggestion}`)
  }

  const summary = `本实验针对「${experiment.schemeName}」共完成 ${rounds.length} 轮版刻工艺模拟。${bestRound.overallSimilarity >= 0.8 ? '实验取得良好效果，' : ''}最佳复刻相似度为 ${(bestRound.overallSimilarity * 100).toFixed(1)}%（第 ${bestRound.roundNumber} 轮）。${findings.length > 0 ? findings[0] : ''}`

  return {
    id: `conclusion-${generateId()}`,
    generatedAt: Date.now(),
    experimentName: experiment.name,
    totalRounds: rounds.length,
    bestRoundId: bestRound.roundId,
    bestRoundNumber: bestRound.roundNumber,
    optimalToolParams: optimalTools,
    optimalExecutionStrategy: optimalStrategy,
    keyFindings: findings,
    errorPatterns: patterns,
    qualityTrend,
    similarityTrend,
    recommendations,
    summary
  }
}

export function finalizeExperiment(
  experiment: CarvingExperiment
): CarvingExperiment {
  if (experiment.rounds.length === 0) {
    throw new Error('至少需要完成一轮实验才能结项')
  }
  const conclusion = generateExperimentConclusion(experiment)
  return {
    ...experiment,
    conclusion,
    isCompleted: true
  }
}

export function compareRounds(
  roundA: ExperimentRound,
  roundB: ExperimentRound
): {
  qualityDelta: number
  similarityDelta: number
  widthDevDelta: number
  depthDevDelta: number
  hotspotDelta: number
  improvements: string[]
  regressions: string[]
} {
  const qualityDelta = roundB.overallQualityScore - roundA.overallQualityScore
  const similarityDelta = roundB.overallSimilarity - roundA.overallSimilarity
  const widthDevDelta = roundB.widthDeviation - roundA.widthDeviation
  const depthDevDelta = roundB.depthDeviation - roundA.depthDeviation
  const hotspotDelta = roundB.hotspots.length - roundA.hotspots.length

  const improvements: string[] = []
  const regressions: string[] = []

  if (similarityDelta > 0.01) improvements.push(`相似度提升 ${(similarityDelta * 100).toFixed(1)}%`)
  else if (similarityDelta < -0.01) regressions.push(`相似度下降 ${(Math.abs(similarityDelta) * 100).toFixed(1)}%`)

  if (qualityDelta > 0.01) improvements.push(`版面质量提升 ${(qualityDelta * 100).toFixed(1)}%`)
  else if (qualityDelta < -0.01) regressions.push(`版面质量下降 ${(Math.abs(qualityDelta) * 100).toFixed(1)}%`)

  if (widthDevDelta < -0.01) improvements.push(`宽度偏差减小 ${(Math.abs(widthDevDelta) * 100).toFixed(1)}%`)
  else if (widthDevDelta > 0.01) regressions.push(`宽度偏差增大 ${(widthDevDelta * 100).toFixed(1)}%`)

  if (hotspotDelta < 0) improvements.push(`误差热区减少 ${Math.abs(hotspotDelta)} 处`)
  else if (hotspotDelta > 0) regressions.push(`误差热区增加 ${hotspotDelta} 处`)

  return { qualityDelta, similarityDelta, widthDevDelta, depthDevDelta, hotspotDelta, improvements, regressions }
}
