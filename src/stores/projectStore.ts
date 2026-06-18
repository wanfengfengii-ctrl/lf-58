import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AnnotationScheme, ProjectImage, ValidationResult } from '../types'
import { generateId } from '../utils/geometry'
import { exportSchemeToJson, downloadJsonFile, generateExportFilename } from '../utils/export'
import {
  parseSchemeJson,
  readJsonFile,
  readImageFile,
  validateAndImportScheme
} from '../utils/import'
import { useLayerStore } from './layerStore'
import { useBladePathStore } from './bladePathStore'
import { useCanvasStore } from './canvasStore'

export const useProjectStore = defineStore('project', () => {
  const currentScheme = ref<AnnotationScheme | null>(null)
  const compareSchemes = ref<AnnotationScheme[]>([])
  const researcher = ref('研究员')

  const isCompleted = computed(() => currentScheme.value?.isCompleted || false)
  const hasImage = computed(() => currentScheme.value?.image !== null && currentScheme.value?.image !== undefined)

  async function importImage(file: File): Promise<void> {
    const imageData = await readImageFile(file)
    const projectId = generateId()

    const scheme: AnnotationScheme = {
      id: projectId,
      researcher: researcher.value,
      projectName: file.name.replace(/\.[^/.]+$/, ''),
      image: imageData as ProjectImage,
      layers: [],
      bladePaths: [],
      isCompleted: false
    }

    currentScheme.value = scheme

    const canvasStore = useCanvasStore()
    canvasStore.setImageSize(imageData.width, imageData.height)
    canvasStore.resetView()

    const layerStore = useLayerStore()
    layerStore.setProjectId(projectId)
    layerStore.clearLayers()
    layerStore.addLayer('主刀路层')

    const bladePathStore = useBladePathStore()
    bladePathStore.clearBladePaths()
    bladePathStore.setActiveLayerId(layerStore.layers[0]?.id || null)
  }

  function exportScheme(): void {
    if (!currentScheme.value) return

    const layerStore = useLayerStore()
    const bladePathStore = useBladePathStore()

    const schemeToExport: AnnotationScheme = {
      ...currentScheme.value,
      layers: layerStore.sortedLayers,
      bladePaths: bladePathStore.allBladePaths
    }

    const json = exportSchemeToJson(schemeToExport)
    const filename = generateExportFilename(schemeToExport.projectName)
    downloadJsonFile(json, filename)
  }

  async function importScheme(file: File): Promise<ValidationResult> {
    const content = await readJsonFile(file)
    const parsed = parseSchemeJson(content)

    if (!parsed) {
      return { valid: false, errors: ['无效的方案文件格式'] }
    }

    if (!currentScheme.value) {
      currentScheme.value = {
        ...parsed,
        id: generateId()
      }
      const canvasStore = useCanvasStore()
      canvasStore.setImageSize(parsed.image.width, parsed.image.height)
      canvasStore.resetView()

      const layerStore = useLayerStore()
      layerStore.setProjectId(parsed.id)
      layerStore.setLayers(parsed.layers)

      const bladePathStore = useBladePathStore()
      bladePathStore.setBladePaths(parsed.bladePaths)
      if (parsed.layers.length > 0) {
        bladePathStore.setActiveLayerId(parsed.layers[0].id)
      }

      return { valid: true, errors: [] }
    }

    const canvasStore = useCanvasStore()
    const result = validateAndImportScheme(
      parsed,
      canvasStore.imageWidth,
      canvasStore.imageHeight
    )

    if (!result.success) {
      return { valid: false, errors: result.errors }
    }

    return { valid: true, errors: [] }
  }

  function addCompareScheme(scheme: AnnotationScheme): void {
    const exists = compareSchemes.value.some((s) => s.id === scheme.id)
    if (!exists) {
      compareSchemes.value.push({
        ...scheme,
        importedAt: Date.now()
      })
    }
  }

  function removeCompareScheme(id: string): void {
    const index = compareSchemes.value.findIndex((s) => s.id === id)
    if (index !== -1) {
      compareSchemes.value.splice(index, 1)
    }
  }

  function markAsComplete(): ValidationResult {
    const bladePathStore = useBladePathStore()

    if (bladePathStore.hasUnreviewed) {
      return {
        valid: false,
        errors: [`存在 ${bladePathStore.unreviewedCount} 条未复核刀路，请先完成所有复核。`]
      }
    }

    if (bladePathStore.hasDuplicateNumbers) {
      const duplicates = bladePathStore.getDuplicateNumbers()
      return {
        valid: false,
        errors: [`存在重复的刀路编号：${duplicates.join(', ')}，请修正后再标记完成。`]
      }
    }

    if (currentScheme.value) {
      currentScheme.value.isCompleted = true
    }

    return { valid: true, errors: [] }
  }

  function unmarkComplete(): void {
    if (currentScheme.value) {
      currentScheme.value.isCompleted = false
    }
  }

  function setResearcher(name: string): void {
    researcher.value = name
    if (currentScheme.value) {
      currentScheme.value.researcher = name
    }
  }

  function clearProject(): void {
    currentScheme.value = null
    compareSchemes.value = []

    const layerStore = useLayerStore()
    layerStore.clearLayers()

    const bladePathStore = useBladePathStore()
    bladePathStore.clearBladePaths()

    const canvasStore = useCanvasStore()
    canvasStore.resetView()
    canvasStore.setImageSize(0, 0)
  }

  return {
    currentScheme,
    compareSchemes,
    researcher,
    isCompleted,
    hasImage,
    importImage,
    exportScheme,
    importScheme,
    addCompareScheme,
    removeCompareScheme,
    markAsComplete,
    unmarkComplete,
    setResearcher,
    clearProject
  }
})
