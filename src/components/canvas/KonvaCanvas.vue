<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useCanvasStore } from '../../stores/canvasStore'
import { useBladePathStore } from '../../stores/bladePathStore'
import { useProjectStore } from '../../stores/projectStore'
import { useLayerStore } from '../../stores/layerStore'
import { useCanvasInteraction } from '../../composables/useCanvasInteraction'
import { useBladePathDrawing } from '../../composables/useBladePathDrawing'
import ImageLayer from './ImageLayer.vue'
import BladePathRenderer from './BladePathRenderer.vue'

const canvasStore = useCanvasStore()
const bladePathStore = useBladePathStore()
const projectStore = useProjectStore()
const layerStore = useLayerStore()

const stageRef = ref<any>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const containerSize = ref({ width: 800, height: 600 })

const { getCanvasPoint, handleWheel, handleMouseDown, handleMouseMove, handleMouseUp } =
  useCanvasInteraction()

const {
  isDrawing,
  currentPoints,
  tempLinePoints,
  activeLayerColor,
  startDrawing,
  continueDrawing,
  addPolylinePoint,
  finishDrawing,
  cancelDrawing,
  handleStageClick,
  handleStageDoubleClick,
  handleRightClick
} = useBladePathDrawing()

const stageConfig = computed(() => ({
  width: containerSize.value.width,
  height: containerSize.value.height,
  scaleX: canvasStore.scale,
  scaleY: canvasStore.scale,
  x: canvasStore.offsetX,
  y: canvasStore.offsetY
}))

const drawingLinePoints = computed(() => {
  if (canvasStore.drawMode === 'free') {
    return currentPoints.value.flatMap((p) => [p.x, p.y])
  }
  return tempLinePoints.value.flatMap((p) => [p.x, p.y])
})

const visibleBladePaths = computed(() => {
  return bladePathStore.visibleBladePaths
})

const sortedPathsByLayer = computed(() => {
  const layerOrder = layerStore.sortedLayers.map((l) => l.id)
  return [...visibleBladePaths.value].sort((a, b) => {
    const aOrder = layerOrder.indexOf(a.layerId)
    const bOrder = layerOrder.indexOf(b.layerId)
    return aOrder - bOrder
  })
})

const canvasSize = computed(() => ({
  width: canvasStore.imageWidth || 800,
  height: canvasStore.imageHeight || 600
}))

function onStageMouseDown(e: any) {
  if (!stageRef.value) return
  const evt = e.evt as MouseEvent

  handleMouseDown(evt, stageRef.value)

  if (canvasStore.isPanning) return
  if (evt.button !== 0) return

  const pos = getCanvasPoint(evt.clientX, evt.clientY, stageRef.value)

  if (canvasStore.drawMode === 'free') {
    startDrawing(pos)
  } else if (canvasStore.drawMode === 'polyline') {
    if (!isDrawing.value) {
      startDrawing(pos)
    } else {
      addPolylinePoint(pos)
    }
  }
}

function onStageMouseMove(e: any) {
  if (!stageRef.value) return
  const evt = e.evt as MouseEvent

  handleMouseMove(evt, stageRef.value)

  if (canvasStore.isPanning || !isDrawing.value) return

  const pos = getCanvasPoint(evt.clientX, evt.clientY, stageRef.value)
  continueDrawing(pos)
}

function onStageMouseUp(e: any) {
  if (!stageRef.value) return
  const evt = e.evt as MouseEvent

  handleMouseUp(stageRef.value)

  if (canvasStore.isPanning) return

  if (canvasStore.drawMode === 'free' && isDrawing.value) {
    finishDrawing()
  }
}

function onStageClick(e: any) {
  if (!stageRef.value || canvasStore.isPanning || isDrawing.value) return
  const evt = e.evt as MouseEvent
  const pos = getCanvasPoint(evt.clientX, evt.clientY, stageRef.value)
  handleStageClick(pos)
}

function onStageDblClick() {
  handleStageDoubleClick()
}

function onStageContextMenu(e: any) {
  const evt = e.evt as MouseEvent
  handleRightClick(evt)
}

function selectPath(id: string) {
  canvasStore.selectPath(id)
}

function updateContainerSize() {
  if (containerRef.value) {
    containerSize.value = {
      width: containerRef.value.clientWidth,
      height: containerRef.value.clientHeight
    }
  }
}

function onWheel(e: any) {
  const evt = e.evt as WheelEvent
  handleWheel(evt)
}

onMounted(() => {
  updateContainerSize()
  window.addEventListener('resize', updateContainerSize)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateContainerSize)
})
</script>

<template>
  <div ref="containerRef" class="canvas-container w-full h-full relative overflow-hidden">
    <v-stage
      ref="stageRef"
      v-bind="stageConfig"
      @mousedown="onStageMouseDown"
      @mousemove="onStageMouseMove"
      @mouseup="onStageMouseUp"
      @click="onStageClick"
      @dblclick="onStageDblClick"
      @contextmenu="onStageContextMenu"
      @wheel="onWheel"
    >
      <ImageLayer v-if="projectStore.hasImage" :width="canvasSize.width" :height="canvasSize.height" />

      <v-layer v-if="projectStore.hasImage">
        <BladePathRenderer
          v-for="path in sortedPathsByLayer"
          :key="path.id"
          :blade-path="path"
          @select="selectPath"
        />

        <v-line
          v-if="isDrawing && drawingLinePoints.length >= 4"
          :points="drawingLinePoints"
          :stroke="activeLayerColor"
          :stroke-width="2"
          :line-cap="'round'"
          :line-join="'round'"
          :opacity="0.7"
          :dash="[5, 3]"
        />
      </v-layer>
    </v-stage>

    <div
      v-if="!projectStore.hasImage"
      class="absolute inset-0 flex items-center justify-center bg-[#F5F0E6] border-2 border-dashed border-[#8B7355] rounded-lg"
    >
      <div class="text-center">
        <div class="text-6xl mb-4">📜</div>
        <p class="text-[#3D2B1F] text-lg font-medium">请导入古籍版刻图像开始标注</p>
        <p class="text-[#8B7355] text-sm mt-2">点击顶部「导入图像」按钮</p>
      </div>
    </div>

    <div class="absolute bottom-4 left-4 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md border border-[#D4C4A8]">
      <button
        @click="canvasStore.zoomOut"
        class="w-8 h-8 flex items-center justify-center hover:bg-[#F5F0E6] rounded transition-colors"
      >
        −
      </button>
      <span class="text-sm text-[#3D2B1F] min-w-[60px] text-center">
        {{ Math.round(canvasStore.scale * 100) }}%
      </span>
      <button
        @click="canvasStore.zoomIn"
        class="w-8 h-8 flex items-center justify-center hover:bg-[#F5F0E6] rounded transition-colors"
      >
        +
      </button>
      <div class="w-px h-5 bg-[#D4C4A8] mx-1" />
      <button
        @click="canvasStore.resetView"
        class="text-xs text-[#8B7355] hover:text-[#3D2B1F] px-2 py-1 hover:bg-[#F5F0E6] rounded transition-colors"
      >
        重置视图
      </button>
    </div>

    <div
      v-if="canvasStore.drawMode !== 'none'"
      class="absolute top-4 left-1/2 -translate-x-1/2 bg-[#C41E3A] text-white px-4 py-2 rounded-full text-sm shadow-lg"
    >
      {{ canvasStore.drawMode === 'free' ? '自由绘制模式' : '折线绘制模式' }}
      <span class="opacity-80 ml-2">
        {{ canvasStore.drawMode === 'free' ? '按住鼠标拖动绘制' : '点击添加点，双击完成' }}
      </span>
    </div>

    <div
      v-if="canvasStore.markerMode !== 'none'"
      class="absolute top-4 left-1/2 -translate-x-1/2 bg-[#1D4E89] text-white px-4 py-2 rounded-full text-sm shadow-lg"
    >
      {{
        canvasStore.markerMode === 'start'
          ? '标注起刀点'
          : canvasStore.markerMode === 'end'
            ? '标注收刀点'
            : '标注修版位置'
      }}
      <span class="opacity-80 ml-2">点击画布放置标记</span>
    </div>

    <div
      v-if="isDrawing && currentPoints.length > 0"
      class="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md border border-[#D4C4A8] text-sm"
    >
      <span class="text-[#3D2B1F]">点数：{{ currentPoints.length }}</span>
      <span class="text-[#8B7355] mx-2">|</span>
      <span class="text-[#8B7355] text-xs">右键取消</span>
    </div>
  </div>
</template>

<style scoped>
.canvas-container {
  background:
    linear-gradient(135deg, #F5F0E6 0%, #E8E0D0 100%);
  background-image:
    url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23D4C4A8' fill-opacity='0.3'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
}
</style>
