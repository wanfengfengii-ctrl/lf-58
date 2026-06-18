import type { AnnotationScheme, BladePath } from './project'
import type { Marker } from './marker'

export type DiffType =
  | 'number_conflict'
  | 'path_offset'
  | 'width_difference'
  | 'marker_missing'
  | 'path_added'
  | 'path_removed'

export interface DiffDetail {
  type: DiffType
  pathNumber: string
  pathId?: string
  sourceSchemeId: string
  targetSchemeId: string
  description: string
  severity: 'warning' | 'error' | 'info'
  data?: {
    expectedValue?: number | string
    actualValue?: number | string
    offsetDistance?: number
    missingMarkerType?: string
  }
}

export interface DiffAnalysisResult {
  schemeAId: string
  schemeBId: string
  schemeAResearcher: string
  schemeBResearcher: string
  diffs: DiffDetail[]
  stats: {
    totalDiffs: number
    numberConflicts: number
    pathOffsets: number
    widthDifferences: number
    markerMissings: number
    addedPaths: number
    removedPaths: number
  }
}

export interface ReviewComment {
  id: string
  schemeId: string
  pathId?: string
  pathNumber?: string
  author: string
  content: string
  status: 'open' | 'resolved' | 'rejected'
  createdAt: number
  resolvedAt?: number
  resolvedBy?: string
  replies: ReviewComment[]
}

export interface SchemeVersion {
  id: string
  schemeId: string
  versionNumber: number
  name: string
  description: string
  researcher: string
  snapshot: AnnotationScheme
  createdAt: number
  parentVersionId?: string
  tags: string[]
}

export interface MergeProposal {
  id: string
  sourceSchemeId: string
  targetSchemeId: string
  title: string
  description: string
  createdBy: string
  createdAt: number
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'merged'
  diffResult?: DiffAnalysisResult
  selectedPathIds: string[]
  reviewers: string[]
  mergedAt?: number
  mergedBy?: string
}

export interface PublishValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  unreviewedPaths: string[]
  hiddenLayerPaths: string[]
  conflictingPaths: string[]
}

export interface CollaborationState {
  versions: SchemeVersion[]
  comments: ReviewComment[]
  mergeProposals: MergeProposal[]
  activeDiffResult: DiffAnalysisResult | null
  selectedDiffTypes: DiffType[]
}

export const PATH_OFFSET_THRESHOLD = 5
export const WIDTH_DIFFERENCE_THRESHOLD = 0.5
