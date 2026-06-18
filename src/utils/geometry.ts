import type { Point } from '../types'

export function calculatePathLength(points: Point[]): number {
  if (points.length < 2) return 0
  let length = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x
    const dy = points[i].y - points[i - 1].y
    length += Math.sqrt(dx * dx + dy * dy)
  }
  return length
}

export function pointInImage(
  point: Point,
  imageWidth: number,
  imageHeight: number,
  padding: number = 0
): boolean {
  return (
    point.x >= padding &&
    point.x <= imageWidth - padding &&
    point.y >= padding &&
    point.y <= imageHeight - padding
  )
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

export function formatLength(length: number): string {
  if (length < 1000) {
    return `${length.toFixed(1)} px`
  }
  return `${(length / 1000).toFixed(2)} kpx`
}
