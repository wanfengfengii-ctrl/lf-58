export type MarkerType = 'start' | 'end' | 'revision'

export interface Marker {
  id: string
  bladePathId: string
  type: MarkerType
  x: number
  y: number
  label?: string
  createdAt: number
}
