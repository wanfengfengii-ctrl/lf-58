import { ref, computed } from 'vue'
import { useCanvasStore } from '../stores/canvasStore'
import { useBladePathStore } from '../stores/bladePathStore'
import { useLayerStore } from '../stores/layerStore'
import type { Point, DrawMode, MarkerType } from '../types'
import { useMessage } from 'naive-ui'

export function useBladePathDrawing() {
  const canvasStore = useCanvasStore()
  const bladePathStore = useBladePathStore()
  const layerStore = useLayerStore()
  const message = useMessage()

  const isDrawing = ref(false)
  const currentPoints = ref<Point[]>([])
  const tempLinePoints = ref<Point[]>([])

  const activeLayer = computed(() => {
    return layerStore.getLayerById(bladePathStore.activeLayerId || '')
  })

  const activeLayerColor = computed(() => {
    return activeLayer.value?.color || '#C41E3A'
  })

  function startDrawing(point: Point) {
    if (!bladePathStore.activeLayerId) {
      message.warning('请先选择一个图层')
      return false
    }
    if (canvasStore.isPanning) return false

    const layer = layerStore.getLayerById(bladePathStore.activeLayerId)
    if (layer?.locked) {
      message.warning('该图层已锁定，无法绘制')
      return false
    }

    isDrawing.value = true
    currentPoints.value = [{ ...point }]
    tempLinePoints.value = [{ ...point }]
    return true
  }

  function continueDrawing(point: Point) {
    if (!isDrawing.value) return

    if (canvasStore.drawMode === 'free') {
      currentPoints.value.push({ ...point })
      tempLinePoints.value = [...currentPoints.value]
    } else if (canvasStore.drawMode === 'polyline') {
      tempLinePoints.value = [currentPoints.value[currentPoints.value.length - 1], { ...point }]
    }
  }

  function addPolylinePoint(point: Point) {
    if (canvasStore.drawMode !== 'polyline' || !isDrawing.value) return
    currentPoints.value.push({ ...point })
    tempLinePoints.value = [...currentPoints.value]
  }

  function finishDrawing() {
    if (!isDrawing.value || currentPoints.value.length < 2) {
      cancelDrawing()
      return
    }

    try {
      const newPath = bladePathStore.createBladePath(currentPoints.value)
      const result = bladePathStore.addBladePath(newPath)

      if (!result.valid) {
        result.errors.forEach((err) => message.error(err))
        cancelDrawing()
        return
      }

      canvasStore.selectPath(newPath.id)
      message.success(`刀路 ${newPath.pathNumber} 创建成功`)
    } catch (e: any) {
      message.error(e.message || '创建刀路失败')
    } finally {
      cancelDrawing()
    }
  }

  function cancelDrawing() {
    isDrawing.value = false
    currentPoints.value = []
    tempLinePoints.value = []
  }

  function placeMarker(point: Point, markerType: MarkerType) {
    if (!canvasStore.selectedPathId) {
      message.warning('请先选择一条刀路')
      return
    }

    const path = bladePathStore.getBladePathById(canvasStore.selectedPathId)
    if (!path) return

    const result = bladePathStore.addMarker(canvasStore.selectedPathId, markerType, point.x, point.y)
    if (!result.success) {
      message.error(result.error || '标注失败')
      return
    }
    message.success(
      markerType === 'start'
        ? '起刀点已标注'
        : markerType === 'end'
          ? '收刀点已标注'
          : '修版位置已标注'
    )
  }

  function handleStageClick(point: Point) {
    if (canvasStore.isMarking && canvasStore.markerMode !== 'none') {
      placeMarker(point, canvasStore.markerMode as MarkerType)
      return
    }

    if (canvasStore.drawMode === 'none') {
      canvasStore.selectPath(null)
    }
  }

  function handleStageDoubleClick() {
    if (canvasStore.drawMode === 'polyline' && isDrawing.value) {
      finishDrawing()
    }
  }

  function handleRightClick(e: MouseEvent) {
    e.preventDefault()
    if (isDrawing.value) {
      if (canvasStore.drawMode === 'polyline') {
        finishDrawing()
      } else {
        cancelDrawing()
      }
    }
  }

  return {
    isDrawing,
    currentPoints,
    tempLinePoints,
    activeLayerColor,
    startDrawing,
    continueDrawing,
    addPolylinePoint,
    finishDrawing,
    cancelDrawing,
    placeMarker,
    handleStageClick,
    handleStageDoubleClick,
    handleRightClick
  }
}
