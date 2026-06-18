<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useProjectStore } from '../../stores/projectStore'
import { useCollaborationStore } from '../../stores/collaborationStore'
import { useLayerStore } from '../../stores/layerStore'
import { useMessage } from 'naive-ui'
import { readJsonFile, parseSchemeJson, validateAndImportScheme } from '../../utils/import'
import type { AnnotationScheme, DiffType, DiffDetail } from '../../types'
import { hasConflicts, getConflictingPathIds } from '../../utils/diffAnalysis'
import { formatLength } from '../../utils/geometry'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const projectStore = useProjectStore()
const collaborationStore = useCollaborationStore()
const layerStore = useLayerStore()
const message = useMessage()

const compareSchemes = ref<AnnotationScheme[]>([])
const selectedSchemeAId = ref<string>('')
const selectedSchemeBId = ref<string>('')
const compareInputRef = ref<HTMLInputElement | null>(null)
const isAnalyzing = ref(false)
const hoveredDiff = ref<DiffDetail | null>(null)

const currentScheme = computed(() => projectStore.currentScheme)
const activeDiffResult = computed(() => collaborationStore.activeDiffResult)
const selectedDiffTypes = computed(() => collaborationStore.selectedDiffTypes)
const filteredDiffs = computed(() => collaborationStore.getFilteredDiffs())

const allSchemes = computed(() => {
  const schemes: AnnotationScheme[] = []
  if (currentScheme.value) {
    schemes.push(currentScheme.value)
  }
  schemes.push(...compareSchemes.value)
  return schemes
})

const schemeA = computed(() =>
  allSchemes.value.find((s) => s.id === selectedSchemeAId.value)
)

const schemeB = computed(() =>
  allSchemes.value.find((s) => s.id === selectedSchemeBId.value)
)

const diffTypeOptions: { value: DiffType; label: string; color: string }[] = [
  { value: 'number_conflict', label: '编号冲突', color: '#C41E3A' },
  { value: 'path_offset', label: '路径偏移', color: '#E8A838' },
  { value: 'width_difference', label: '宽度差异', color: '#6B4E71' },
  { value: 'marker_missing', label: '标记缺失', color: '#D35400' },
  { value: 'path_added', label: '新增刀路', color: '#2E5D3B' },
  { value: 'path_removed', label: '缺失刀路', color: '#1D4E89' }
]

watch(
  () => props.visible,
  (val) => {
    if (val && currentScheme.value) {
      selectedSchemeAId.value = currentScheme.value.id
      collaborationStore.clearDiffResult()
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

    const exists = compareSchemes.value.some((s) => s.id === parsed.id)
    if (exists) {
      message.warning('该方案已在列表中')
      return
    }

    compareSchemes.value.push({ ...parsed, importedAt: Date.now() })
    if (!selectedSchemeBId.value) {
      selectedSchemeBId.value = parsed.id
    }
    message.success(`已添加方案：${parsed.projectName}`)
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
  if (selectedSchemeBId.value === id) {
    selectedSchemeBId.value = ''
  }
  if (selectedSchemeAId.value === id && currentScheme.value) {
    selectedSchemeAId.value = currentScheme.value.id
  }
}

async function runAnalysis() {
  if (!schemeA.value || !schemeB.value) {
    message.warning('请选择两个方案进行对比')
    return
  }

  if (schemeA.value.id === schemeB.value.id) {
    message.warning('请选择两个不同的方案')
    return
  }

  isAnalyzing.value = true
  try {
    collaborationStore.analyzeDiff(schemeA.value, schemeB.value)
    message.success('差异分析完成')
  } catch (err: any) {
    message.error(err.message || '分析失败')
  } finally {
    isAnalyzing.value = false
  }
}

function toggleDiffType(type: DiffType) {
  collaborationStore.toggleDiffType(type)
}

function getDiffSeverityColor(severity: string): string {
  switch (severity) {
    case 'error':
      return 'text-red-600 bg-red-50 border-red-200'
    case 'warning':
      return 'text-amber-700 bg-amber-50 border-amber-200'
    case 'info':
      return 'text-blue-700 bg-blue-50 border-blue-200'
    default:
      return 'text-gray-700 bg-gray-50 border-gray-200'
  }
}

function getDiffTypeLabel(type: DiffType): string {
  return diffTypeOptions.find((o) => o.value === type)?.label || type
}

function getDiffTypeColor(type: DiffType): string {
  return diffTypeOptions.find((o) => o.value === type)?.color || '#888'
}

function getPathHighlight(diff: DiffDetail, scheme: AnnotationScheme): {
  highlight: boolean
  color: string
} {
  if (hoveredDiff.value?.pathNumber !== diff.pathNumber) {
    return { highlight: false, color: '' }
  }

  const isInScheme =
    (diff.sourceSchemeId === scheme.id && diff.type !== 'path_added') ||
    (diff.targetSchemeId === scheme.id && diff.type !== 'path_removed')

  if (!isInScheme) {
    return { highlight: false, color: '' }
  }

  return {
    highlight: true,
    color: getDiffTypeColor(diff.type)
  }
}

function getFlattenedPoints(points: { x: number; y: number }[]): number[] {
  return points.flatMap((p) => [p.x, p.y])
}

function exportDiffReport() {
  if (!activeDiffResult.value) return

  const report = {
    title: '差异分析报告',
    generatedAt: new Date().toISOString(),
    schemeA: {
      name: activeDiffResult.value.schemeAResearcher,
      id: activeDiffResult.value.schemeAId
    },
    schemeB: {
      name: activeDiffResult.value.schemeBResearcher,
      id: activeDiffResult.value.schemeBId
    },
    statistics: activeDiffResult.value.stats,
    details: activeDiffResult.value.diffs
  }

  const json = JSON.stringify(report, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `diff-report-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
  message.success('报告已导出')
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
    <div class="bg-white rounded-2xl shadow-2xl w-[95vw] h-[90vh] max-w-[1600px] overflow-hidden flex flex-col">
      <div class="px-6 py-4 border-b border-[#D4C4A8] flex items-center justify-between bg-[#F5F0E6]/50">
        <div>
          <h2 class="text-lg font-bold text-[#3D2B1F] flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            差异分析与协同复核
          </h2>
          <p class="text-xs text-[#8B7355] mt-1">对比不同研究人员的标注方案，自动检测差异并高亮显示</p>
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
        <div class="w-80 border-r border-[#D4C4A8] flex flex-col bg-white">
          <div class="p-3 border-b border-[#D4C4A8] space-y-3">
            <div>
              <label class="block text-xs font-medium text-[#3D2B1F] mb-1">基准方案（方案A）</label>
              <select
                v-model="selectedSchemeAId"
                class="w-full px-3 py-2 border border-[#D4C4A8] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4E89]/30"
              >
                <option v-for="scheme in allSchemes" :key="scheme.id" :value="scheme.id">
                  {{ scheme.researcher }} - {{ scheme.projectName }}
                </option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-medium text-[#3D2B1F] mb-1">对比方案（方案B）</label>
              <select
                v-model="selectedSchemeBId"
                class="w-full px-3 py-2 border border-[#D4C4A8] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4E89]/30"
              >
                <option value="">请选择对比方案</option>
                <option v-for="scheme in allSchemes" :key="scheme.id" :value="scheme.id">
                  {{ scheme.researcher }} - {{ scheme.projectName }}
                </option>
              </select>
            </div>

            <button
              @click="triggerImport"
              class="w-full py-2 border border-dashed border-[#D4C4A8] text-[#8B7355] rounded-lg hover:bg-[#F5F0E6] transition-colors text-sm flex items-center justify-center gap-2"
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

            <button
              @click="runAnalysis"
              :disabled="!schemeA || !schemeB || schemeA?.id === schemeB?.id || isAnalyzing"
              class="w-full py-2.5 bg-[#1D4E89] text-white rounded-lg hover:bg-[#1a4374] transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg v-if="isAnalyzing" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              {{ isAnalyzing ? '分析中...' : '开始差异分析' }}
            </button>
          </div>

          <div v-if="activeDiffResult" class="p-3 border-b border-[#D4C4A8] bg-[#F5F0E6]/30">
            <div class="text-xs font-medium text-[#3D2B1F] mb-2">差异类型筛选</div>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="opt in diffTypeOptions"
                :key="opt.value"
                @click="toggleDiffType(opt.value)"
                :class="[
                  'px-2 py-1 text-xs rounded-full border transition-all',
                  selectedDiffTypes.includes(opt.value)
                    ? 'text-white border-transparent'
                    : 'bg-white text-[#8B7355] border-[#D4C4A8] hover:bg-[#F5F0E6]'
                ]"
                :style="selectedDiffTypes.includes(opt.value) ? { backgroundColor: opt.color } : {}"
              >
                {{ opt.label }}
                <span class="ml-1 opacity-75">
                  ({{ activeDiffResult.stats[opt.value + 's' as keyof typeof activeDiffResult.stats] || 0 }})
                </span>
              </button>
            </div>
          </div>

          <div v-if="activeDiffResult" class="p-3 border-b border-[#D4C4A8]">
            <div class="grid grid-cols-3 gap-2 text-center">
              <div class="p-2 bg-red-50 rounded-lg">
                <div class="text-lg font-bold text-red-600">{{ activeDiffResult.stats.numberConflicts }}</div>
                <div class="text-[10px] text-red-700">编号冲突</div>
              </div>
              <div class="p-2 bg-amber-50 rounded-lg">
                <div class="text-lg font-bold text-amber-600">{{ activeDiffResult.stats.pathOffsets + activeDiffResult.stats.widthDifferences + activeDiffResult.stats.markerMissings }}</div>
                <div class="text-[10px] text-amber-700">差异项</div>
              </div>
              <div class="p-2 bg-blue-50 rounded-lg">
                <div class="text-lg font-bold text-blue-600">{{ activeDiffResult.stats.addedPaths + activeDiffResult.stats.removedPaths }}</div>
                <div class="text-[10px] text-blue-700">增删项</div>
              </div>
            </div>

            <div
              v-if="hasConflicts(activeDiffResult)"
              class="mt-3 p-2 bg-red-100 border border-red-300 rounded-lg text-xs text-red-700 flex items-start gap-2"
            >
              <svg class="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>存在严重冲突，禁止一键合并。请先手动解决所有编号冲突问题。</span>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-3">
            <div v-if="!activeDiffResult" class="text-center py-8 text-[#8B7355] text-sm">
              <svg class="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              选择两个方案后点击「开始差异分析」
            </div>

            <div v-else-if="filteredDiffs.length === 0" class="text-center py-8 text-[#8B7355] text-sm">
              <svg class="w-12 h-12 mx-auto mb-2 opacity-50 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              未检测到符合筛选条件的差异
            </div>

            <div v-else class="space-y-2">
              <div
                v-for="(diff, idx) in filteredDiffs"
                :key="idx"
                @mouseenter="hoveredDiff = diff"
                @mouseleave="hoveredDiff = null"
                :class="[
                  'p-3 rounded-lg border cursor-pointer transition-all',
                  getDiffSeverityColor(diff.severity),
                  hoveredDiff?.pathNumber === diff.pathNumber ? 'ring-2 ring-offset-1' : ''
                ]"
                :style="hoveredDiff?.pathNumber === diff.pathNumber ? { '--tw-ring-color': getDiffTypeColor(diff.type) } as any : {}"
              >
                <div class="flex items-start gap-2">
                  <span
                    class="px-2 py-0.5 text-[10px] font-medium rounded-full text-white flex-shrink-0"
                    :style="{ backgroundColor: getDiffTypeColor(diff.type) }"
                  >
                    {{ getDiffTypeLabel(diff.type) }}
                  </span>
                  <span class="font-mono text-xs font-bold">{{ diff.pathNumber }}</span>
                </div>
                <p class="text-xs mt-1.5 leading-relaxed">{{ diff.description }}</p>
                <div v-if="diff.data" class="mt-2 text-[10px] opacity-75">
                  <span v-if="diff.data.offsetDistance">
                    偏移距离: {{ diff.data.offsetDistance.toFixed(2) }}px
                  </span>
                  <span v-if="diff.data.expectedValue !== undefined && diff.data.actualValue !== undefined">
                    期望值: {{ diff.data.expectedValue }} / 实际值: {{ diff.data.actualValue }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="compareSchemes.length > 0" class="p-3 border-t border-[#D4C4A8]">
            <div class="text-xs font-medium text-[#3D2B1F] mb-2">已导入方案</div>
            <div class="space-y-1.5 max-h-32 overflow-y-auto">
              <div
                v-for="scheme in compareSchemes"
                :key="scheme.id"
                class="flex items-center justify-between px-2 py-1.5 bg-[#F5F0E6] rounded text-xs"
              >
                <span class="truncate flex-1">{{ scheme.researcher }}</span>
                <span class="text-[#8B7355] text-[10px] ml-2">{{ scheme.bladePaths.length }} 条刀路</span>
                <button
                  @click="removeScheme(scheme.id)"
                  class="p-0.5 hover:bg-red-100 rounded ml-1"
                >
                  <svg class="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="flex-1 flex flex-col bg-[#F5F0E6] overflow-hidden">
          <div v-if="schemeA && schemeB" class="flex border-b border-[#D4C4A8] bg-white">
            <div class="flex-1 p-3 border-r border-[#D4C4A8]">
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full" style="background-color: #C41E3A" />
                <span class="text-sm font-medium text-[#3D2B1F]">{{ schemeA.researcher }}</span>
                <span class="text-xs text-[#8B7355]">(方案A)</span>
                <span class="ml-auto text-xs text-[#8B7355]">{{ schemeA.bladePaths.length }} 条刀路</span>
              </div>
            </div>
            <div class="flex-1 p-3">
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full" style="background-color: #1D4E89" />
                <span class="text-sm font-medium text-[#3D2B1F]">{{ schemeB.researcher }}</span>
                <span class="text-xs text-[#8B7355]">(方案B)</span>
                <span class="ml-auto text-xs text-[#8B7355]">{{ schemeB.bladePaths.length }} 条刀路</span>
              </div>
            </div>
          </div>

          <div class="flex-1 flex overflow-hidden">
            <div v-if="schemeA" class="flex-1 border-r border-[#D4C4A8] overflow-auto p-4">
              <div
                class="relative mx-auto bg-white rounded-xl shadow-lg overflow-hidden"
                :style="{
                  width: schemeA.image.width + 'px',
                  height: schemeA.image.height + 'px',
                  maxWidth: '100%'
                }"
              >
                <img
                  :src="schemeA.image.url"
                  class="w-full h-full object-contain opacity-60"
                  :alt="schemeA.projectName"
                />
                <svg
                  class="absolute inset-0 w-full h-full"
                  :viewBox="`0 0 ${schemeA.image.width} ${schemeA.image.height}`"
                >
                  <path
                    v-for="path in schemeA.bladePaths"
                    :key="path.id"
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
                    :stroke="(() => {
                      const diff = activeDiffResult?.diffs.find(d => d.pathNumber === path.pathNumber)
                      if (diff) {
                        const hl = getPathHighlight(diff, schemeA)
                        return hl.highlight ? hl.color : '#C41E3A'
                      }
                      return '#C41E3A'
                    })()"
                    :stroke-width="(() => {
                      const diff = activeDiffResult?.diffs.find(d => d.pathNumber === path.pathNumber)
                      if (diff) {
                        const hl = getPathHighlight(diff, schemeA)
                        return hl.highlight ? path.bladeWidth + 2 : path.bladeWidth
                      }
                      return path.bladeWidth
                    })()"
                    :stroke-dasharray="(() => {
                      const diff = activeDiffResult?.diffs.find(d => d.pathNumber === path.pathNumber)
                      if (diff?.type === 'path_removed' && diff.sourceSchemeId === schemeA.id) {
                        return '5,5'
                      }
                      return 'none'
                    })()"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    :opacity="hoveredDiff && !activeDiffResult?.diffs.find(d => d.pathNumber === path.pathNumber) ? 0.3 : 0.8"
                  />
                </svg>
              </div>
            </div>

            <div v-if="schemeB" class="flex-1 overflow-auto p-4">
              <div
                class="relative mx-auto bg-white rounded-xl shadow-lg overflow-hidden"
                :style="{
                  width: schemeB.image.width + 'px',
                  height: schemeB.image.height + 'px',
                  maxWidth: '100%'
                }"
              >
                <img
                  :src="schemeB.image.url"
                  class="w-full h-full object-contain opacity-60"
                  :alt="schemeB.projectName"
                />
                <svg
                  class="absolute inset-0 w-full h-full"
                  :viewBox="`0 0 ${schemeB.image.width} ${schemeB.image.height}`"
                >
                  <path
                    v-for="path in schemeB.bladePaths"
                    :key="path.id"
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
                    :stroke="(() => {
                      const diff = activeDiffResult?.diffs.find(d => d.pathNumber === path.pathNumber)
                      if (diff) {
                        const hl = getPathHighlight(diff, schemeB)
                        return hl.highlight ? hl.color : '#1D4E89'
                      }
                      return '#1D4E89'
                    })()"
                    :stroke-width="(() => {
                      const diff = activeDiffResult?.diffs.find(d => d.pathNumber === path.pathNumber)
                      if (diff) {
                        const hl = getPathHighlight(diff, schemeB)
                        return hl.highlight ? path.bladeWidth + 2 : path.bladeWidth
                      }
                      return path.bladeWidth
                    })()"
                    :stroke-dasharray="(() => {
                      const diff = activeDiffResult?.diffs.find(d => d.pathNumber === path.pathNumber)
                      if (diff?.type === 'path_added' && diff.targetSchemeId === schemeB.id) {
                        return '5,5'
                      }
                      return 'none'
                    })()"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    :opacity="hoveredDiff && !activeDiffResult?.diffs.find(d => d.pathNumber === path.pathNumber) ? 0.3 : 0.8"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="px-6 py-3 border-t border-[#D4C4A8] flex items-center justify-between bg-[#F5F0E6]/50">
        <div class="text-sm text-[#8B7355]">
          <span v-if="activeDiffResult">
            共检测到 {{ activeDiffResult.stats.totalDiffs }} 处差异
            <span v-if="activeDiffResult.stats.numberConflicts > 0" class="text-red-600 ml-2">
              ⚠ 存在 {{ activeDiffResult.stats.numberConflicts }} 处冲突，禁止一键合并
            </span>
          </span>
          <span v-else>等待分析...</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            v-if="activeDiffResult"
            @click="exportDiffReport"
            class="px-4 py-2 border border-[#D4C4A8] text-[#3D2B1F] rounded-lg hover:bg-white transition-colors text-sm"
          >
            导出报告
          </button>
          <button
            @click="close"
            class="px-6 py-2 bg-[#3D2B1F] text-white rounded-lg hover:bg-[#2d2017] transition-colors text-sm font-medium"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
