import type { Marker } from './marker'
import type { Layer } from './layer'
import type { Point } from './bladePath'

export interface BladePath {
  id: string
  layerId: string
  pathNumber: string
  points: Point[]
  bladeWidth: number
  isReviewed: boolean
  notes: string
  length: number
  startMarker?: Marker
  endMarker?: Marker
  revisionMarkers: Marker[]
  createdAt: number
}

export interface ProjectImage {
  url: string
  width: number
  height: number
  name: string
}

export interface AnnotationScheme {
  id: string
  researcher: string
  projectName: string
  image: ProjectImage
  layers: Layer[]
  bladePaths: BladePath[]
  isCompleted: boolean
  importedAt?: number
}

export interface ProjectState {
  currentScheme: AnnotationScheme | null
  compareSchemes: AnnotationScheme[]
}

export interface CanvasState {
  scale: number
  offsetX: number
  offsetY: number
  selectedPathId: string | null
  isDragging: boolean
  isPanning: boolean
}
