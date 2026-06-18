<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLayerStore } from '../../stores/layerStore'
import { useBladePathStore } from '../../stores/bladePathStore'
import { useCanvasStore } from '../../stores/canvasStore'
import { useMessage, useDialog } from 'naive-ui'

const layerStore = useLayerStore()
const bladePathStore = useBladePathStore()
const canvasStore = useCanvasStore()
const message = useMessage()
const dialog = useDialog()

const editingLayerId = ref<string | null>(null)
const editingName = ref('')

const sortedLayers = computed(() => layerStore.sortedLayers)

const layerStats = computed(() => {
  return sortedLayers.value.map((layer) => {
    const paths = bladePathStore.getBladePathsByLayer(layer.id)
    return {
      ...layer,
      pathCount: paths.length,
      isActive: bladePathStore.activeLayerId === layer.id
    }
  })
})

function selectLayer(id: string) {
  bladePathStore.setActiveLayerId(id)
  canvasStore.selectPath(null)
}

function startEditName(layer: any) {
  editingLayerId.value = layer.id
  editingName.value = layer.name
}

function saveLayerName(id: string) {
  if (editingName.value.trim()) {
    layerStore.updateLayer(id, { name: editingName.value.trim() })
    message.success('图层名称已更新')
  }
  editingLayerId.value = null
}

function deleteLayer(id: string) {
  const layer = layerStore.getLayerById(id)
  const paths = bladePathStore.getBladePathsByLayer(id)

  dialog.warning({
    title: '删除图层',
    content: `确定要删除图层「${layer?.name}」吗？该图层下的 ${paths.length} 条刀路也将被删除。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => {
      paths.forEach((p) => bladePathStore.deleteBladePath(p.id))
      layerStore.deleteLayer(id)
      if (bladePathStore.activeLayerId === id) {
        bladePathStore.setActiveLayerId(layerStore.layers[0]?.id || null)
      }
      message.success('图层已删除')
    }
  })
}

function addLayer() {
  const newLayer = layerStore.addLayer()
  bladePathStore.setActiveLayerId(newLayer.id)
  message.success(`已创建图层「${newLayer.name}」`)
}
</script>

<template>
  <div class="layer-panel h-full flex flex-col bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-[#D4C4A8] overflow-hidden">
    <div class="px-4 py-3 border-b border-[#D4C4A8] flex items-center justify-between bg-[#F5F0E6]/50">
      <h3 class="font-medium text-[#3D2B1F] flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        图层管理
      </h3>
      <button
        @click="addLayer"
        class="w-7 h-7 flex items-center justify-center rounded-lg bg-[#1D4E89] text-white hover:bg-[#1a4374] transition-colors"
        title="新建图层"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto p-2 space-y-1">
      <div
        v-for="layer in layerStats"
        :key="layer.id"
        :class="[
          'group relative rounded-lg p-2 cursor-pointer transition-all duration-200',
          layer.isActive
            ? 'bg-[#1D4E89]/10 border border-[#1D4E89]/30'
            : 'hover:bg-[#F5F0E6] border border-transparent'
        ]"
        @click="selectLayer(layer.id)"
      >
        <div class="flex items-center gap-2">
          <div
            class="w-4 h-4 rounded-full border-2 border-white shadow-sm flex-shrink-0"
            :style="{ backgroundColor: layer.color }"
          />

          <div v-if="editingLayerId === layer.id" class="flex-1" @click.stop>
            <input
              v-model="editingName"
              class="w-full px-2 py-1 text-sm border border-[#1D4E89] rounded focus:outline-none"
              @blur="saveLayerName(layer.id)"
              @keyup.enter="saveLayerName(layer.id)"
              @keyup.escape="editingLayerId = null"
              autofocus
            />
          </div>
          <div v-else class="flex-1 min-w-0">
            <div
              class="text-sm font-medium truncate"
              :class="layer.isActive ? 'text-[#1D4E89]' : 'text-[#3D2B1F]'"
              @dblclick.stop="startEditName(layer)"
            >
              {{ layer.name }}
            </div>
            <div class="text-xs text-[#8B7355]">
              {{ layer.pathCount }} 条刀路
            </div>
          </div>

          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              @click.stop="layerStore.toggleVisibility(layer.id)"
              class="p-1.5 rounded hover:bg-white/80 transition-colors"
              :title="layer.visible ? '隐藏图层' : '显示图层'"
            >
              <svg v-if="layer.visible" class="w-4 h-4 text-[#3D2B1F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <svg v-else class="w-4 h-4 text-[#8B7355]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            </button>

            <button
              @click.stop="layerStore.toggleLock(layer.id)"
              class="p-1.5 rounded hover:bg-white/80 transition-colors"
              :title="layer.locked ? '解锁图层' : '锁定图层'"
            >
              <svg v-if="layer.locked" class="w-4 h-4 text-[#8B7355]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <svg v-else class="w-4 h-4 text-[#3D2B1F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            </button>

            <button
              @click.stop="layerStore.moveLayer(layer.id, 'up')"
              class="p-1.5 rounded hover:bg-white/80 transition-colors"
              title="上移"
            >
              <svg class="w-4 h-4 text-[#3D2B1F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
              </svg>
            </button>

            <button
              @click.stop="layerStore.moveLayer(layer.id, 'down')"
              class="p-1.5 rounded hover:bg-white/80 transition-colors"
              title="下移"
            >
              <svg class="w-4 h-4 text-[#3D2B1F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <button
              @click.stop="deleteLayer(layer.id)"
              class="p-1.5 rounded hover:bg-red-100 transition-colors"
              title="删除图层"
            >
              <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div v-if="layerStats.length === 0" class="text-center py-8 text-[#8B7355] text-sm">
        暂无图层，点击上方按钮新建
      </div>
    </div>
  </div>
</template>
