import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DrawMode, MarkerMode } from '../types'

export const useCanvasStore = defineStore('canvas', () => {
  const scale = ref(1)
  const offsetX = ref(0)
  const offsetY = ref(0)
  const selectedPathId = ref<string | null>(null)
  const drawMode = ref<DrawMode>('none')
  const markerMode = ref<MarkerMode>('none')
  const isPanning = ref(false)
  const spacePressed = ref(false)
  const imageWidth = ref(0)
  const imageHeight = ref(0)

  const isDrawing = computed(() => drawMode.value !== 'none')
  const isMarking = computed(() => markerMode.value !== 'none')
  const isInInteractiveMode = computed(() => isDrawing.value || isMarking.value)

  function setScale(newScale: number) {
    scale.value = Math.max(0.1, Math.min(10, newScale))
  }

  function setOffset(x: number, y: number) {
    offsetX.value = x
    offsetY.value = y
  }

  function pan(dx: number, dy: number) {
    offsetX.value += dx
    offsetY.value += dy
  }

  function selectPath(id: string | null) {
    selectedPathId.value = id
  }

  function setDrawMode(mode: DrawMode) {
    drawMode.value = mode
    if (mode !== 'none') {
      markerMode.value = 'none'
    }
  }

  function setMarkerMode(mode: MarkerMode) {
    markerMode.value = mode
    if (mode !== 'none') {
      drawMode.value = 'none'
    }
  }

  function resetView() {
    scale.value = 1
    offsetX.value = 0
    offsetY.value = 0
  }

  function setImageSize(width: number, height: number) {
    imageWidth.value = width
    imageHeight.value = height
  }

  function zoomIn() {
    setScale(scale.value * 1.2)
  }

  function zoomOut() {
    setScale(scale.value / 1.2)
  }

  return {
    scale,
    offsetX,
    offsetY,
    selectedPathId,
    drawMode,
    markerMode,
    isPanning,
    spacePressed,
    imageWidth,
    imageHeight,
    isDrawing,
    isMarking,
    isInInteractiveMode,
    setScale,
    setOffset,
    pan,
    selectPath,
    setDrawMode,
    setMarkerMode,
    resetView,
    setImageSize,
    zoomIn,
    zoomOut
  }
})
