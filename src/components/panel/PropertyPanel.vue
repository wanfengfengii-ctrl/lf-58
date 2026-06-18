<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useCanvasStore } from '../../stores/canvasStore'
import { useBladePathStore } from '../../stores/bladePathStore'
import { useLayerStore } from '../../stores/layerStore'
import { useMessage } from 'naive-ui'
import { formatLength } from '../../utils/geometry'

const canvasStore = useCanvasStore()
const bladePathStore = useBladePathStore()
const layerStore = useLayerStore()
const message = useMessage()

const localPathNumber = ref('')
const localBladeWidth = ref(2)
const localNotes = ref('')

const selectedPath = computed(() =>
  canvasStore.selectedPathId ? bladePathStore.getBladePathById(canvasStore.selectedPathId) : null
)

const layerOptions = computed(() =>
  layerStore.layers.map((l) => ({ label: l.name, value: l.id, color: l.color }))
)

watch(
  () => selectedPath.value,
  (path) => {
    if (path) {
      localPathNumber.value = path.pathNumber
      localBladeWidth.value = path.bladeWidth
      localNotes.value = path.notes
    }
  },
  { immediate: true }
)

function savePathNumber() {
  if (!selectedPath.value) return
  const result = bladePathStore.updateBladePath(selectedPath.value.id, {
    pathNumber: localPathNumber.value.trim()
  })
  if (!result.valid) {
    result.errors.forEach((err) => message.error(err))
    localPathNumber.value = selectedPath.value.pathNumber
  } else {
    message.success('刀路编号已更新')
  }
}

function saveBladeWidth() {
  if (!selectedPath.value) return
  const width = Number(localBladeWidth.value)
  const result = bladePathStore.updateBladePath(selectedPath.value.id, {
    bladeWidth: width
  })
  if (!result.valid) {
    result.errors.forEach((err) => message.error(err))
    localBladeWidth.value = selectedPath.value.bladeWidth
  } else {
    message.success('刀痕宽度已更新')
  }
}

function saveNotes() {
  if (!selectedPath.value) return
  bladePathStore.updateBladePath(selectedPath.value.id, {
    notes: localNotes.value
  })
  message.success('备注已更新')
}

function changeLayer(layerId: string) {
  if (!selectedPath.value) return
  bladePathStore.updateBladePath(selectedPath.value.id, { layerId })
  message.success('图层已变更')
}

function toggleReview() {
  if (!selectedPath.value) return
  bladePathStore.toggleReview(selectedPath.value.id)
  message.success(
    selectedPath.value.isReviewed ? '已标记为已复核' : '已取消复核标记'
  )
}
</script>

<template>
  <div class="property-panel h-full flex flex-col bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-[#D4C4A8] overflow-hidden">
    <div class="px-4 py-3 border-b border-[#D4C4A8] bg-[#F5F0E6]/50">
      <h3 class="font-medium text-[#3D2B1F] flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        刀路属性
      </h3>
    </div>

    <div v-if="selectedPath" class="flex-1 overflow-y-auto p-4 space-y-4">
      <div class="space-y-2">
        <label class="text-xs font-medium text-[#8B7355]">刀路编号</label>
        <input
          v-model="localPathNumber"
          class="w-full px-3 py-2 border border-[#D4C4A8] rounded-lg text-sm text-[#3D2B1F] focus:outline-none focus:border-[#1D4E89] focus:ring-1 focus:ring-[#1D4E89]"
          @blur="savePathNumber"
          @keyup.enter="savePathNumber"
        />
      </div>

      <div class="space-y-2">
        <label class="text-xs font-medium text-[#8B7355]">所属图层</label>
        <div class="flex items-center gap-2 px-3 py-2 border border-[#D4C4A8] rounded-lg">
          <div
            class="w-3 h-3 rounded-full"
            :style="{ backgroundColor: layerStore.getLayerColor(selectedPath.layerId) }"
          />
          <select
            :value="selectedPath.layerId"
            @change="changeLayer(($event.target as HTMLSelectElement).value)"
            class="flex-1 bg-transparent text-sm text-[#3D2B1F] focus:outline-none"
          >
            <option v-for="layer in layerOptions" :key="layer.value" :value="layer.value">
              {{ layer.label }}
            </option>
          </select>
        </div>
      </div>

      <div class="space-y-2">
        <label class="text-xs font-medium text-[#8B7355]">
          刀痕宽度：{{ localBladeWidth }} px
        </label>
        <input
          v-model.number="localBladeWidth"
          type="range"
          min="1"
          max="20"
          step="1"
          class="w-full accent-[#1D4E89]"
          @change="saveBladeWidth"
        />
        <div class="flex justify-between text-xs text-[#8B7355]">
          <span>1px</span>
          <span>20px</span>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="p-3 bg-[#F5F0E6] rounded-lg">
          <div class="text-xs text-[#8B7355]">刀路长度</div>
          <div class="text-lg font-semibold text-[#3D2B1F]">
            {{ formatLength(selectedPath.length) }}
          </div>
        </div>
        <div class="p-3 bg-[#F5F0E6] rounded-lg">
          <div class="text-xs text-[#8B7355]">点数量</div>
          <div class="text-lg font-semibold text-[#3D2B1F]">
            {{ selectedPath.points.length }}
          </div>
        </div>
      </div>

      <div class="space-y-2">
        <label class="text-xs font-medium text-[#8B7355]">复核状态</label>
        <button
          @click="toggleReview"
          :class="[
            'w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2',
            selectedPath.isReviewed
              ? 'bg-[#2E5D3B]/10 text-[#2E5D3B] border border-[#2E5D3B]/30'
              : 'bg-[#E8A838]/10 text-[#E8A838] border border-[#E8A838]/30'
          ]"
        >
          <svg v-if="selectedPath.isReviewed" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {{ selectedPath.isReviewed ? '已复核（点击取消）' : '待复核（点击标记）' }}
        </button>
      </div>

      <div class="space-y-2">
        <label class="text-xs font-medium text-[#8B7355]">标注信息</label>
        <div class="flex gap-2">
          <div class="flex-1 p-2 bg-[#2E5D3B]/10 rounded-lg text-center">
            <div class="text-xs text-[#2E5D3B]">起刀点</div>
            <div class="text-sm font-medium text-[#2E5D3B]">
              {{ selectedPath.startMarker ? '✓ 已标注' : '未标注' }}
            </div>
          </div>
          <div class="flex-1 p-2 bg-[#C41E3A]/10 rounded-lg text-center">
            <div class="text-xs text-[#C41E3A]">收刀点</div>
            <div class="text-sm font-medium text-[#C41E3A]">
              {{ selectedPath.endMarker ? '✓ 已标注' : '未标注' }}
            </div>
          </div>
          <div class="flex-1 p-2 bg-[#E8A838]/10 rounded-lg text-center">
            <div class="text-xs text-[#E8A838]">修版</div>
            <div class="text-sm font-medium text-[#E8A838]">
              {{ selectedPath.revisionMarkers.length }} 处
            </div>
          </div>
        </div>
      </div>

      <div class="space-y-2">
        <label class="text-xs font-medium text-[#8B7355]">备注信息</label>
        <textarea
          v-model="localNotes"
          rows="4"
          class="w-full px-3 py-2 border border-[#D4C4A8] rounded-lg text-sm text-[#3D2B1F] focus:outline-none focus:border-[#1D4E89] focus:ring-1 focus:ring-[#1D4E89] resize-none"
          placeholder="输入刀路备注信息..."
          @blur="saveNotes"
        />
      </div>

      <div class="text-xs text-[#8B7355] pt-2 border-t border-[#D4C4A8]">
        创建时间：{{ new Date(selectedPath.createdAt).toLocaleString('zh-CN') }}
      </div>
    </div>

    <div v-else class="flex-1 flex items-center justify-center text-[#8B7355] text-sm">
      <div class="text-center">
        <svg class="w-12 h-12 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
        </svg>
        <p>点击画布上的刀路</p>
        <p>查看和编辑属性</p>
      </div>
    </div>
  </div>
</template>
