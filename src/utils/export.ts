import type { AnnotationScheme } from '../types'

export function exportSchemeToJson(scheme: AnnotationScheme): string {
  const dataToExport = {
    ...scheme,
    exportedAt: Date.now()
  }
  return JSON.stringify(dataToExport, null, 2)
}

export function downloadJsonFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function generateExportFilename(projectName: string): string {
  const dateStr = new Date().toISOString().split('T')[0]
  const safeName = projectName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
  return `${safeName}_刀路标注方案_${dateStr}.json`
}
