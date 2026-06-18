import type { BladePath, Layer, Point, Marker } from './index'

export type BladeType = 'flat' | 'round' | 'angled' | 'spear' | 'diamond'

export type CuttingDirection = 'top_to_bottom' | 'bottom_to_top' | 'left_to_right' | 'right_to_left' | 'mixed'

export type SimulationStatus = 'idle' | 'running' | 'completed' | 'failed'

export interface BladeToolParams {
  id: string
  name: string
  bladeType: BladeType
  nominalWidth: number
  edgeAngle: number
  tipSharpness: number
  flexibility: number
  wearLevel: number
}

export interface CuttingStrokeConfig {
  pressure: number
  speed: number
  angle: number
  depth: number
}

export interface PathExecutionOrder {
  pathId: string
  orderIndex: number
  layerId: string
  strokeConfig: CuttingStrokeConfig
  toolParamsId: string
}

export interface SimulatedCarvePoint extends Point {
  depth: number
  width: number
  pressure: number
  timestamp: number
}

export interface SimulatedBladePath {
  originalPathId: string
  pathNumber: string
  executedPoints: SimulatedCarvePoint[]
  toolParamsId: string
  strokeConfig: CuttingStrokeConfig
  orderIndex: number
  layerId: string
  effectiveWidth: number
  startEffect: BladeCutEffect
  endEffect: BladeCutEffect
  revisionEffects: RevisionSimEffect[]
}

export type BladeCutEffect = 'clean' | 'torn' | 'rounded' | 'chipped' | 'overcut' | 'undercut'

export interface RevisionSimEffect {
  markerId: string
  position: Point
  effectType: 'fill' | 'recarve' | 'smooth' | 'patch'
  qualityScore: number
}

export interface LayerCarvingResult {
  layerId: string
  layerName: string
  layerOrder: number
  simulatedPaths: SimulatedBladePath[]
  coverageRate: number
  overlapRate: number
  layerQualityScore: number
}

export interface CarvingBoardPixel {
  x: number
  y: number
  depth: number
  carveCount: number
  pathIds: string[]
  errorValue: number
}

export interface SimulatedBoard {
  width: number
  height: number
  pixels: CarvingBoardPixel[][]
  totalCarvedArea: number
  averageDepth: number
  depthVariance: number
}

export interface ErrorHotspot {
  id: string
  x: number
  y: number
  radius: number
  errorScore: number
  severity: 'minor' | 'moderate' | 'critical'
  category: 'width_deviation' | 'depth_deviation' | 'overlap' | 'missed_carve' | 'edge_quality'
  affectedPathIds: string[]
  description: string
}

export interface ExperimentRound {
  roundId: string
  roundNumber: number
  name: string
  timestamp: number
  toolParamsMap: Record<string, BladeToolParams>
  executionOrders: PathExecutionOrder[]
  layerResults: LayerCarvingResult[]
  simulatedBoard: SimulatedBoard
  hotspots: ErrorHotspot[]
  overallQualityScore: number
  overallSimilarity: number
  widthDeviation: number
  depthDeviation: number
  notes: string
  parentRoundId?: string
  paramChanges: ParamChangeRecord[]
}

export interface ParamChangeRecord {
  field: string
  oldValue: any
  newValue: any
  targetType: 'tool' | 'stroke' | 'order'
  targetId: string
  changedAt: number
}

export interface ParameterTraceEntry {
  roundId: string
  roundNumber: number
  timestamp: number
  toolParams: BladeToolParams[]
  executionOrders: PathExecutionOrder[]
  qualityScore: number
  similarityScore: number
  keyDecisions: string[]
}

export interface ExperimentConclusion {
  id: string
  generatedAt: number
  experimentName: string
  totalRounds: number
  bestRoundId: string
  bestRoundNumber: number
  optimalToolParams: BladeToolParams[]
  optimalExecutionStrategy: PathExecutionOrder[]
  keyFindings: string[]
  errorPatterns: { pattern: string; frequency: number; suggestion: string }[]
  qualityTrend: number[]
  similarityTrend: number[]
  recommendations: string[]
  summary: string
}

export interface CarvingExperiment {
  id: string
  name: string
  description: string
  createdAt: number
  createdBy: string
  schemeId: string
  schemeName: string
  referenceImageUrl?: string
  rounds: ExperimentRound[]
  parameterTrace: ParameterTraceEntry[]
  conclusion?: ExperimentConclusion
  isCompleted: boolean
  currentRoundIndex: number
}

export interface ExperimentConfig {
  targetWidthDeviation: number
  targetDepthDeviation: number
  hotspotSeverityThreshold: number
  maxRounds: number
  autoOptimize: boolean
}

export interface SimulationContext {
  bladePaths: BladePath[]
  layers: Layer[]
  imageWidth: number
  imageHeight: number
  toolParams: BladeToolParams[]
  executionOrders: PathExecutionOrder[]
  config: ExperimentConfig
}
