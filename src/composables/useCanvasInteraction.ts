import { ref, onMounted, onUnmounted } from 'vue'
import { useCanvasStore } from '../stores/canvasStore'
import type { Point } from '../types'

export function useCanvasInteraction() {
  const canvasStore = useCanvasStore()
  const lastMousePos = ref<Point | null>(null)
  const isMouseDown = ref(false)

  function getCanvasPoint(clientX: number, clientY: number, stage: any): Point {
    const stageRect = stage.getContainer().getBoundingClientRect()
    const x = (clientX - stageRect.left - canvasStore.offsetX) / canvasStore.scale
    const y = (clientY - stageRect.top - canvasStore.offsetY) / canvasStore.scale
    return { x, y }
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    canvasStore.setScale(canvasStore.scale * delta)
  }

  function handleMouseDown(e: MouseEvent, stage: any) {
    if (e.button === 1 || canvasStore.spacePressed) {
      canvasStore.isPanning = true
      lastMousePos.value = { x: e.clientX, y: e.clientY }
      stage.container().style.cursor = 'grabbing'
      return
    }
    isMouseDown.value = true
    lastMousePos.value = { x: e.clientX, y: e.clientY }
  }

  function handleMouseMove(e: MouseEvent, stage: any) {
    if (canvasStore.isPanning && lastMousePos.value) {
      const dx = e.clientX - lastMousePos.value.x
      const dy = e.clientY - lastMousePos.value.y
      canvasStore.pan(dx, dy)
      lastMousePos.value = { x: e.clientX, y: e.clientY }
      return
    }
    lastMousePos.value = { x: e.clientX, y: e.clientY }
  }

  function handleMouseUp(stage: any) {
    canvasStore.isPanning = false
    isMouseDown.value = false
    lastMousePos.value = null
    stage.container().style.cursor = 'default'
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.code === 'Space') {
      e.preventDefault()
      canvasStore.spacePressed = true
    }
    if (e.code === 'Delete' && canvasStore.selectedPathId) {
      e.preventDefault()
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (e.code === 'Space') {
      canvasStore.spacePressed = false
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
  })

  return {
    getCanvasPoint,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp
  }
}
