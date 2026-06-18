export interface Point {
  x: number
  y: number
}

export type DrawMode = 'free' | 'polyline' | 'none'
export type MarkerMode = 'start' | 'end' | 'revision' | 'none'

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings?: string[]
}
