<script setup lang="ts">
import { computed } from 'vue'
import { useCanvasStore } from '../../stores/canvasStore'
import { useProjectStore } from '../../stores/projectStore'
import { useBladePathStore } from '../../stores/bladePathStore'
import { useLayerStore } from '../../stores/layerStore'
import ToolButton from './ToolButton.vue'
import { useMessage, useDialog } from 'naive-ui'

const canvasStore = useCanvasStore()
const projectStore = useProjectStore()
const bladePathStore = useBladePathStore()
const layerStore = useLayerStore()
const message = useMessage()
const dialog = useDialog()

const hasImage = computed(() => projectStore.hasImage)
const selectedPath = computed(() =>
  canvasStore.selectedPathId ? bladePathStore.getBladePathById(canvasStore.selectedPathId) : null
)

const isSelectedPathLocked = computed(() => {
  if (!selectedPath.value) return false
  const layer = layerStore.getLayerById(selectedPath.value.layerId)
  return layer?.locked ?? false
})

function setDrawMode(mode: 'free' | 'polyline' | 'none') {
  if (!hasImage.value) {
    message.warning('请先导入图像')
    return
  }
  canvasStore.setDrawMode(canvasStore.drawMode === mode ? 'none' : mode)
}

function setMarkerMode(mode: 'start' | 'end' | 'revision' | 'none') {
  if (!hasImage.value) {
    message.warning('请先导入图像')
    return
  }
  if (!canvasStore.selectedPathId) {
    message.warning('请先选择一条刀路')
    return
  }
  if (isSelectedPathLocked.value) {
    message.warning('所属图层已锁定，无法添加标注')
    return
  }
  canvasStore.setMarkerMode(canvasStore.markerMode === mode ? 'none' : mode)
}

function deleteSelectedPath() {
  if (!canvasStore.selectedPathId) {
    message.warning('请先选择一条刀路')
    return
  }
  const path = bladePathStore.getBladePathById(canvasStore.selectedPathId)
  if (!path) return

  dialog.warning({
    title: '确认删除',
    content: `确定要删除刀路「${path.pathNumber}」吗？此操作不可撤销。`,
    positiveText: '删除',
    negativeText: '取消',
    positiveButtonProps: { type: 'error' },
    onPositiveClick: () => {
      const result = bladePathStore.deleteBladePath(canvasStore.selectedPathId!)
      if (!result.valid) {
        result.errors.forEach((err) => message.error(err))
        return
      }
      canvasStore.selectPath(null)
      message.success(`已删除刀路 ${path.pathNumber}`)
    }
  })
}

function toggleSelectedReview() {
  if (!canvasStore.selectedPathId) {
    message.warning('请先选择一条刀路')
    return
  }
  const result = bladePathStore.toggleReview(canvasStore.selectedPathId)
  if (!result.valid) {
    result.errors.forEach((err) => message.error(err))
    return
  }
  const path = bladePathStore.getBladePathById(canvasStore.selectedPathId)
  message.success(
    path?.isReviewed ? '已标记为已复核' : '已取消复核标记'
  )
}
</script>

<template>
  <div class="draw-toolbar flex flex-col gap-2 p-3 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-[#D4C4A8]">
    <div class="text-xs font-medium text-[#8B7355] mb-1 px-1">绘制模式</div>

    <ToolButton
      :active="canvasStore.drawMode === 'free'"
      :disabled="!hasImage"
      title="自由绘制 (F)"
      @click="setDrawMode('free')"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    </ToolButton>

    <ToolButton
      :active="canvasStore.drawMode === 'polyline'"
      :disabled="!hasImage"
      title="折线绘制 (P)"
      @click="setDrawMode('polyline')"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4v16" />
      </svg>
    </ToolButton>

    <div class="w-full h-px bg-[#D4C4A8] my-1" />

    <div class="text-xs font-medium text-[#8B7355] mb-1 px-1">标注工具</div>

    <ToolButton
      :active="canvasStore.markerMode === 'start'"
      :disabled="!hasImage || !selectedPath || isSelectedPathLocked"
      title="标注起刀点"
      @click="setMarkerMode('start')"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
    </ToolButton>

    <ToolButton
      :active="canvasStore.markerMode === 'end'"
      :disabled="!hasImage || !selectedPath || isSelectedPathLocked"
      title="标注收刀点"
      @click="setMarkerMode('end')"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </ToolButton>

    <ToolButton
      :active="canvasStore.markerMode === 'revision'"
      :disabled="!hasImage || !selectedPath || isSelectedPathLocked"
      title="标注修版位置"
      @click="setMarkerMode('revision')"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </ToolButton>

    <div class="w-full h-px bg-[#D4C4A8] my-1" />

    <div class="text-xs font-medium text-[#8B7355] mb-1 px-1">编辑操作</div>

    <ToolButton
      :disabled="!hasImage || !selectedPath || isSelectedPathLocked"
      title="切换复核状态"
      @click="toggleSelectedReview"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </ToolButton>

    <ToolButton
      :disabled="!hasImage || !selectedPath || isSelectedPathLocked"
      title="删除选中刀路 (Delete)"
      @click="deleteSelectedPath"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </ToolButton>

    <div class="w-full h-px bg-[#D4C4A8] my-1" />

    <ToolButton
      :disabled="!hasImage"
      title="取消当前操作 (ESC)"
      @click="() => { canvasStore.setDrawMode('none'); canvasStore.setMarkerMode('none') }"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </ToolButton>
  </div>
</template>
