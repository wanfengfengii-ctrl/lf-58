import type { AnnotationScheme, BladePath, Layer, Point } from './index'

export type PathMorphologyType = 'smooth' | 'angular' | 'mixed'
export type BladeCutStyle = 'steady' | 'abrupt' | 'gradual'
export type RevisionDensityLevel = 'low' | 'medium' | 'high'
export type ConfidenceLevel = 'low' | 'medium' | 'high'

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
