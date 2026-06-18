<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useCanvasStore } from '../stores/canvasStore'
import { useBladePathStore } from '../stores/bladePathStore'
import KonvaCanvas from '../components/canvas/KonvaCanvas.vue'
import DrawToolbar from '../components/toolbar/DrawToolbar.vue'
import LayerPanel from '../components/panel/LayerPanel.vue'
import PropertyPanel from '../components/panel/PropertyPanel.vue'
import StatsPanel from '../components/panel/StatsPanel.vue'
import HeaderBar from '../components/common/HeaderBar.vue'
import CompareDialog from '../components/dialog/CompareDialog.vue'

const canvasStore = useCanvasStore()
const bladePathStore = useBladePathStore()

const showCompareDialog = ref(false)

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    canvasStore.setDrawMode('none')
    canvasStore.setMarkerMode('none')
    canvasStore.selectPath(null)
  }

  if (e.key === 'f' || e.key === 'F') {
    if (!e.metaKey && !e.ctrlKey) {
      canvasStore.setDrawMode(canvasStore.drawMode === 'free' ? 'none' : 'free')
    }
  }

  if (e.key === 'p' || e.key === 'P') {
    if (!e.metaKey && !e.ctrlKey) {
      canvasStore.setDrawMode(canvasStore.drawMode === 'polyline' ? 'none' : 'polyline')
    }
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (canvasStore.selectedPathId && document.activeElement?.tagName !== 'INPUT') {
      e.preventDefault()
      const pathId = canvasStore.selectedPathId
      bladePathStore.deleteBladePath(pathId)
      canvasStore.selectPath(null)
    }
  }
}

function openCompareDialog() {
  showCompareDialog.value = true
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('openCompareDialog', openCompareDialog)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('openCompareDialog', openCompareDialog)
})
</script>

<template>
  <div class="workbench h-screen flex flex-col bg-[#E8E0D0] overflow-hidden">
    <HeaderBar />

    <div class="flex-1 flex overflow-hidden p-4 gap-4">
      <div class="flex-shrink-0">
        <DrawToolbar />
      </div>

      <div class="flex-1 min-w-0 rounded-xl overflow-hidden shadow-lg border border-[#D4C4A8]">
        <KonvaCanvas />
      </div>

      <div class="w-80 flex-shrink-0 flex flex-col gap-4 overflow-hidden">
        <div class="h-[45%] min-h-0">
          <LayerPanel />
        </div>
        <div class="h-[35%] min-h-0">
          <PropertyPanel />
        </div>
        <div class="h-[20%] min-h-0">
          <StatsPanel />
        </div>
      </div>
    </div>

    <div class="px-6 py-2 bg-white/80 border-t border-[#D4C4A8] flex items-center justify-between text-xs text-[#8B7355]">
      <div class="flex items-center gap-4">
        <span>快捷键：F - 自由绘制 | P - 折线绘制 | Space + 拖拽 - 平移 | 滚轮 - 缩放 | Delete - 删除刀路 | ESC - 取消</span>
      </div>
      <div>
        <span v-if="canvasStore.selectedPathId">
          已选中刀路：{{ bladePathStore.getBladePathById(canvasStore.selectedPathId)?.pathNumber }}
        </span>
        <span v-else>点击刀路查看属性</span>
      </div>
    </div>

    <CompareDialog v-model:visible="showCompareDialog" />
  </div>
</template>

<style scoped>
.workbench {
  background-image:
    url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23D4C4A8' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
}
</style>
