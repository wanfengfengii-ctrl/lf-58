import type { AnnotationScheme, BladePath, Layer, Point } from './index'

export type PathMorphologyType = 'smooth' | 'angular' | 'mixed'
export type BladeCutStyle = 'steady' | 'abrupt' | 'gradual'
export type RevisionDensityLevel = 'low' | 'medium' | 'high'
export type ConfidenceLevel = 'low' | 'medium' | 'high'

export type GraphNodeType =
  | 'scheme'
  | 'style_profile'
  | 'blade_path'
  | 'marker'
  | 'version_diff'
  | 'association'
  | 'evidence'
  | 'revision'
  | 'researcher'

export type GraphEdgeType =
  | 'belongs_to'
  | 'has_feature'
  | 'references'
  | 'supports'
  | 'contradicts'
  | 'revises'
  | 'similar_to'
  | 'different_from'
  | 'derived_from'
  | 'authored_by'

export interface GraphNode {
  id: string
  type: GraphNodeType
  label: string
  description?: string
  metadata?: Record<string, any>
  x?: number
  y?: number
  color?: string
  size?: number
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  type: GraphEdgeType
  label?: string
  weight?: number
  metadata?: Record<string, any>
}

export interface KnowledgeGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  generatedAt: number
}

export interface ConfidenceSnapshot {
  id: string
  targetType: 'style_profile' | 'version_diff' | 'association'
  targetId: string
  confidenceValue: number
  confidenceLevel: ConfidenceLevel
  recordedAt: number
  recordedBy: string
  reason?: string
  evidenceIds: string[]
  revisionIds: string[]
}

export interface ResearcherOpinion {
  researcher: string
  targetType: 'style_profile' | 'version_diff' | 'association'
  targetId: string
  judgment: string
  confidence: ConfidenceLevel
  confidenceValue: number
  reasoning: string
  evidenceIds: string[]
  createdAt: number
}

export interface DissentGroup {
  id: string
  targetType: 'style_profile' | 'version_diff' | 'association'
  targetId: string
  targetLabel: string
  opinions: ResearcherOpinion[]
  consensusLevel: number
  dominantJudgment?: string
}

export interface VersionEvolutionNode {
  schemeId: string
  schemeName: string
  order: number
  generation: number
  predecessors: string[]
  successors: string[]
  relationType?: 'same_edition' | 'revised_edition' | 'derived_edition' | 'different_work'
  similarityToPredecessor?: number
}

export interface VersionEvolutionChain {
  id: string
  rootSchemeId: string
  rootSchemeName: string
  nodes: VersionEvolutionNode[]
  totalGenerations: number
  description?: string
}

export interface GraphReport extends ResearchReport {
  knowledgeGraph: KnowledgeGraph
  confidenceHistory: ConfidenceSnapshot[]
  dissents: DissentGroup[]
  evolutionChains: VersionEvolutionChain[]
  graphSvgData?: string
}

export interface PathMorphologyFeature {
  totalPaths: number
  smoothPaths: number
  angularPaths: number
  mixedPaths: number
  avgPathLength: number
  avgSegmentLength: number
  avgTurningAngle: number
  curvatureDistribution: number[]
  dominantType: PathMorphologyType
}

export interface BladeWidthDistribution {
  minWidth: number
  maxWidth: number
  avgWidth: number
  medianWidth: number
  stdDev: number
  widthHistogram: { range: string; count: number }[]
  consistencyScore: number
}

export interface BladeCutHabit {
  startMarkerCount: number
  endMarkerCount: number
  startEndCoverageRate: number
  avgStartAngle: number
  avgEndAngle: number
  startStyle: BladeCutStyle
  endStyle: BladeCutStyle
  directionalPreference: string
}

export interface RevisionDensityFeature {
  totalRevisionMarkers: number
  avgRevisionPerPath: number
  revisionDensityPerUnitArea: number
  revisionDensityLevel: RevisionDensityLevel
  revisionHotspots: { x: number; y: number; count: number }[]
}

export interface LayerStructureFeature {
  totalLayers: number
  layerDistribution: { layerName: string; pathCount: number; totalLength: number }[]
  avgPathsPerLayer: number
  layerComplexityScore: number
  interLayerSimilarity: number
}

export interface EngraverStyleProfile {
  schemeId: string
  schemeName: string
  researcher: string
  generatedAt: number
  pathMorphology: PathMorphologyFeature
  widthDistribution: BladeWidthDistribution
  cutHabit: BladeCutHabit
  revisionDensity: RevisionDensityFeature
  layerStructure: LayerStructureFeature
  overallStyleDescription: string
  styleTags: string[]
}

export interface VersionDiffItem {
  category: string
  description: string
  severity: 'minor' | 'moderate' | 'significant'
  affectedFeatures: string[]
  quantitativeData?: Record<string, number>
}

export interface VersionDiffSummary {
  schemeAId: string
  schemeAName: string
  schemeBId: string
  schemeBName: string
  generatedAt: number
  overallSimilarity: number
  diffItems: VersionDiffItem[]
  summaryText: string
  suspectedVersionRelation: string
}

export interface SameEngraverAssociation {
  schemeIds: string[]
  schemeNames: string[]
  similarityScore: number
  confidence: ConfidenceLevel
  sharedFeatures: string[]
  distinctiveFeatures: string[]
  analysisNotes: string
}

export interface ManualRevision {
  id: string
  targetType: 'style_profile' | 'version_diff' | 'association'
  targetId: string
  fieldName: string
  originalValue: string
  revisedValue: string
  revisedBy: string
  revisedAt: number
  reason: string
}

export interface JudgmentEvidence {
  id: string
  targetType: 'style_profile' | 'version_diff' | 'association'
  targetId: string
  content: string
  evidenceType: 'text_note' | 'path_reference' | 'marker_reference'
  referencedIds: string[]
  createdBy: string
  createdAt: number
}

export interface StyleAnalysisResult {
  styleProfiles: EngraverStyleProfile[]
  versionDiffs: VersionDiffSummary[]
  associations: SameEngraverAssociation[]
  manualRevisions: ManualRevision[]
  evidences: JudgmentEvidence[]
}

export interface ResearchReport {
  title: string
  generatedAt: number
  generatedBy: string
  styleProfiles: EngraverStyleProfile[]
  versionDiffs: VersionDiffSummary[]
  associations: SameEngraverAssociation[]
  manualRevisions: ManualRevision[]
  evidences: JudgmentEvidence[]
  additionalNotes: string
}

export interface AnalysisState {
  isAnalyzing: boolean
  currentResult: StyleAnalysisResult | null
  selectedProfileId: string | null
  selectedDiffId: string | null
  selectedAssociationId: string | null
  importedSchemes: AnnotationScheme[]
}
