<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useProjectStore } from '../../stores/projectStore'
import { useCanvasStore } from '../../stores/canvasStore'
import { useBladePathStore } from '../../stores/bladePathStore'
import { useLayerStore } from '../../stores/layerStore'
import { useMessage } from 'naive-ui'
import { readJsonFile, parseSchemeJson, validateAndImportScheme } from '../../utils/import'
import type { AnnotationScheme, BladePath } from '../../types'
import { formatLength } from '../../utils/geometry'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const projectStore = useProjectStore()
const canvasStore = useCanvasStore()
const bladePathStore = useBladePathStore()
const layerStore = useLayerStore()
const message = useMessage()

const compareSchemes = ref<AnnotationScheme[]>([])
const selectedSchemeIds = ref<string[]>([])
const compareInputRef = ref<HTMLInputElement | null>(null)

const currentScheme = computed(() => projectStore.currentScheme)

const compareColors = [
  { hue: 0, color: '#C41E3A' },
  { hue: 220, color: '#1D4E89' },
  { hue: 120, color: '#2E5D3B' },
  { hue: 40, color: '#E8A838' },
  { hue: 280, color: '#6B4E71' },
  { hue: 16, color: '#D35400' }
]

const allSchemes = computed(() => {
  const schemes: Array<{ scheme: AnnotationScheme; color: string; isCurrent: boolean }> = []
  if (currentScheme.value) {
    schemes.push({
      scheme: currentScheme.value,
      color: '#C41E3A',
      isCurrent: true
    })
  }
  compareSchemes.value.forEach((scheme, idx) => {
    schemes.push({
      scheme,
      color: compareColors[(idx + 1) % compareColors.length].color,
      isCurrent: false
    })
  })
  return schemes
})

const visibleSchemes = computed(() => {
  return allSchemes.value.filter((s) =>
    selectedSchemeIds.value.includes(s.scheme.id)
  )
})

watch(
  () => props.visible,
  (val) => {
    if (val && currentScheme.value) {
      selectedSchemeIds.value = [currentScheme.value.id]
    }
  }
)

function triggerImport() {
  compareInputRef.value?.click()
}

async function handleImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    const content = await readJsonFile(file)
    const parsed = parseSchemeJson(content)

    if (!parsed) {
      message.error('无效的方案文件')
      return
    }

    if (!canvasStore.imageWidth || !canvasStore.imageHeight) {
      message.error('请先导入图像')
      return
    }

    const result = validateAndImportScheme(
      parsed,
      canvasStore.imageWidth,
      canvasStore.imageHeight
    )

    if (!result.success) {
      result.errors.forEach((err) => message.error(err))
      return
    }

    if (result.scheme) {
      const exists = compareSchemes.value.some((s) => s.id === result.scheme!.id)
      if (exists) {
        message.warning('该方案已在对比列表中')
        return
      }
      compareSchemes.value.push(result.scheme)
      selectedSchemeIds.value.push(result.scheme.id)
      message.success(`已添加对比方案：${parsed.projectName}`)
    }
  } catch (err: any) {
    message.error(err.message || '导入失败')
  } finally {
    input.value = ''
  }
}

function removeScheme(id: string) {
  const idx = compareSchemes.value.findIndex((s) => s.id === id)
  if (idx !== -1) {
    compareSchemes.value.splice(idx, 1)
  }
  selectedSchemeIds.value = selectedSchemeIds.value.filter((i) => i !== id)
}

function toggleScheme(id: string) {
  const idx = selectedSchemeIds.value.indexOf(id)
  if (idx === -1) {
    selectedSchemeIds.value.push(id)
  } else {
    if (currentScheme.value && id === currentScheme.value.id) {
      message.warning('当前方案必须显示')
      return
    }
    selectedSchemeIds.value.splice(idx, 1)
  }
}

function getSchemeStats(scheme: AnnotationScheme) {
  const totalLength = scheme.bladePaths.reduce((sum, p) => sum + p.length, 0)
  const reviewedCount = scheme.bladePaths.filter((p) => p.isReviewed).length
  return {
    pathCount: scheme.bladePaths.length,
    totalLength,
    totalLengthFormatted: formatLength(totalLength),
    reviewedCount,
    reviewProgress:
      scheme.bladePaths.length > 0
        ? Math.round((reviewedCount / scheme.bladePaths.length) * 100)
        : 100
  }
}

function getFlattenedPoints(path: BladePath): number[] {
  return path.points.flatMap((p) => [p.x, p.y])
}

function close() {
  emit('update:visible', false)
}
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    @click.self="close"
  >
    <div class="bg-white rounded-2xl shadow-2xl w-[90vw] h-[85vh] max-w-[1400px] overflow-hidden flex flex-col">
      <div class="px-6 py-4 border-b border-[#D4C4A8] flex items-center justify-between bg-[#F5F0E6]/50">
        <div>
          <h2 class="text-lg font-bold text-[#3D2B1F] flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            多方案对比
          </h2>
          <p class="text-xs text-[#8B7355] mt-1">叠加对比不同研究人员的标注方案</p>
        </div>
        <button
          @click="close"
          class="p-2 hover:bg-[#F5F0E6] rounded-lg transition-colors"
        >
          <svg class="w-5 h-5 text-[#8B7355]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="flex-1 flex overflow-hidden">
        <div class="w-72 border-r border-[#D4C4A8] flex flex-col bg-white">
          <div class="p-3 border-b border-[#D4C4A8]">
            <button
              @click="triggerImport"
              class="w-full py-2 bg-[#1D4E89] text-white rounded-lg hover:bg-[#1a4374] transition-colors text-sm font-medium flex items-center justify-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              导入对比方案
            </button>
            <input
              ref="compareInputRef"
              type="file"
              accept=".json"
              class="hidden"
              @change="handleImport"
            />
          </div>

          <div class="flex-1 overflow-y-auto p-3 space-y-2">
            <div
              v-for="item in allSchemes"
              :key="item.scheme.id"
              :class="[
                'p-3 rounded-lg border transition-all cursor-pointer',
                selectedSchemeIds.includes(item.scheme.id)
                  ? 'border-[#1D4E89]/30 bg-[#1D4E89]/5'
                  : 'border-[#D4C4A8] bg-white hover:bg-[#F5F0E6]'
              ]"
              @click="toggleScheme(item.scheme.id)"
            >
              <div class="flex items-center gap-2 mb-2">
                <div
                  class="w-4 h-4 rounded-full"
                  :style="{ backgroundColor: item.color }"
                />
                <span class="font-medium text-sm text-[#3D2B1F] truncate flex-1">
                  {{ item.scheme.projectName }}
                  <span v-if="item.isCurrent" class="text-xs text-[#C41E3A] ml-1">(当前)</span>
                </span>
                <button
                  v-if="!item.isCurrent"
                  @click.stop="removeScheme(item.scheme.id)"
                  class="p-1 hover:bg-red-100 rounded"
                >
                  <svg class="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div class="text-xs text-[#8B7355]">
                研究员：{{ item.scheme.researcher }}
              </div>
              <div class="text-xs text-[#8B7355]">
                {{ getSchemeStats(item.scheme).pathCount }} 条刀路 ·
                {{ getSchemeStats(item.scheme).totalLengthFormatted }}
              </div>
              <div class="mt-2 h-1.5 bg-[#F5F0E6] rounded-full overflow-hidden">
                <div
                  class="h-full transition-all"
                  :style="{
                    width: `${getSchemeStats(item.scheme).reviewProgress}%`,
                    backgroundColor: item.color
                  }"
                />
              </div>
            </div>
          </div>

          <div class="p-3 border-t border-[#D4C4A8] text-xs text-[#8B7355]">
            <div class="font-medium mb-1">图例</div>
            <div v-for="item in visibleSchemes" :key="item.scheme.id" class="flex items-center gap-2 py-1">
              <div
                class="w-3 h-3 rounded-full"
                :style="{ backgroundColor: item.color }"
              />
              <span class="truncate">{{ item.scheme.researcher }}</span>
            </div>
          </div>
        </div>

        <div class="flex-1 bg-[#F5F0E6] overflow-auto p-6">
          <div
            v-if="currentScheme"
            class="relative mx-auto bg-white rounded-xl shadow-lg overflow-hidden"
            :style="{
              width: currentScheme.image.width + 'px',
              height: currentScheme.image.height + 'px',
              maxWidth: '100%'
            }"
          >
            <img
              :src="currentScheme.image.url"
              class="w-full h-full object-contain opacity-60"
              :alt="currentScheme.projectName"
            />

            <svg
              class="absolute inset-0 w-full h-full"
              :viewBox="`0 0 ${currentScheme.image.width} ${currentScheme.image.height}`"
            >
              <template v-for="item in visibleSchemes" :key="item.scheme.id">
                <path
                  v-for="path in item.scheme.bladePaths"
                  :key="`${item.scheme.id}-${path.id}`"
                  :d="(() => {
                    const pts = path.points
                    if (pts.length < 2) return ''
                    let d = `M ${pts[0].x} ${pts[0].y}`
                    for (let i = 1; i < pts.length; i++) {
                      d += ` L ${pts[i].x} ${pts[i].y}`
                    }
                    return d
                  })()"
                  fill="none"
                  :stroke="item.color"
                  :stroke-width="path.bladeWidth"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  opacity="0.7"
                />
              </template>
            </svg>
          </div>

          <div
            v-else
            class="h-full flex items-center justify-center text-[#8B7355]"
          >
            请先导入图像
          </div>
        </div>
      </div>

      <div class="px-6 py-3 border-t border-[#D4C4A8] flex items-center justify-between bg-[#F5F0E6]/50">
        <div class="text-sm text-[#8B7355]">
          共 {{ visibleSchemes.length }} 个方案参与对比
        </div>
        <button
          @click="close"
          class="px-6 py-2 bg-[#3D2B1F] text-white rounded-lg hover:bg-[#2d2017] transition-colors text-sm font-medium"
        >
          关闭
        </button>
      </div>
    </div>
  </div>
</template>
