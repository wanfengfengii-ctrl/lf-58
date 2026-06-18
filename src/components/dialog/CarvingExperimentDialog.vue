<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useCarvingExperimentStore } from '../../stores/carvingExperimentStore'
import { useProjectStore } from '../../stores/projectStore'
import { useBladePathStore } from '../../stores/bladePathStore'
import { useLayerStore } from '../../stores/layerStore'
import { useMessage, useDialog } from 'naive-ui'
import type {
  BladeToolParams,
  PathExecutionOrder,
  BladeType,
  ErrorHotspot
} from '../../types'
import { BLADE_TYPE_LABELS, DEFAULT_PRESET_TOOLS } from '../../utils/carvingSimulation'
import { generateId } from '../../utils/geometry'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const experimentStore = useCarvingExperimentStore()
const projectStore = useProjectStore()
const bladePathStore = useBladePathStore()
const layerStore = useLayerStore()
const message = useMessage()
const dialog = useDialog()

const activeSection = ref<'params' | 'execution' | 'result' | 'trace' | 'conclusion'>('params')
const selectedToolId = ref<string>('')
const compareRoundA = ref<number>(-1)
const compareRoundB = ref<number>(-1)
const customToolDialogVisible = ref(false)
const newToolName = ref('')
const newToolType = ref<BladeType>('flat')
const newToolWidth = ref(2)

const currentScheme = computed(() => projectStore.currentScheme)
const activeExperiment = computed(() => experimentStore.activeExperiment)
const currentRound = computed(() => experimentStore.currentRound)
const currentTools = computed(() => experimentStore.currentTools)
const currentOrders = computed(() => experimentStore.currentOrders)
const isSimulating = computed(() => experimentStore.isSimulating)

const sortedOrders = computed(() =>
  [...currentOrders.value].sort((a, b) => a.orderIndex - b.orderIndex)
)

const selectedTool = computed(() =>
  currentTools.value.find((t) => t.id === selectedToolId.value)
)

const roundComparison = computed(() => {
  if (compareRoundA.value < 0 || compareRoundB.value < 0 || !activeExperiment.value) return null
  return experimentStore.getRoundComparison(compareRoundA.value, compareRoundB.value)
})

watch(
  () => props.visible,
  (val) => {
    if (val && currentScheme.value && !activeExperiment.value) {
      experimentStore.createExperiment(currentScheme.value, projectStore.researcher)
      if (currentTools.value.length > 0) {
        selectedToolId.value = currentTools.value[0].id
      }
    }
  }
)

watch(
  currentTools,
  (tools) => {
    if (tools.length > 0 && !selectedToolId.value) {
      selectedToolId.value = tools[0].id
    }
  },
  { immediate: true }
)

function close() {
  emit('update:visible', false)
}

function getBladeTypeColor(type: BladeType): string {
  const colors: Record<BladeType, string> = {
    flat: 'bg-blue-100 text-blue-700 border-blue-200',
    round: 'bg-green-100 text-green-700 border-green-200',
    angled: 'bg-amber-100 text-amber-700 border-amber-200',
    spear: 'bg-purple-100 text-purple-700 border-purple-200',
    diamond: 'bg-rose-100 text-rose-700 border-rose-200'
  }
  return colors[type]
}

function getHotspotSeverityColor(severity: ErrorHotspot['severity']): string {
  switch (severity) {
    case 'critical': return '#C41E3A'
    case 'moderate': return '#E8A838'
    case 'minor': return '#4682B4'
  }
}

function getHotspotCategoryLabel(cat: ErrorHotspot['category']): string {
  const labels: Record<ErrorHotspot['category'], string> = {
    width_deviation: '宽度偏差',
    depth_deviation: '深度偏差',
    overlap: '刀路重叠',
    missed_carve: '漏刻',
    edge_quality: '刀痕质量'
  }
  return labels[cat]
}

function getCutEffectLabel(effect: string): string {
  const labels: Record<string, string> = {
    clean: '干净利落',
    torn: '毛边撕裂',
    rounded: '圆润钝口',
    chipped: '崩口缺痕',
    overcut: '入刀过深',
    undercut: '入刀不足'
  }
  return labels[effect] || effect
}

function updateToolParam(field: keyof BladeToolParams, value: number | string) {
  if (!selectedToolId.value) return
  experimentStore.updateToolParams(selectedToolId.value, { [field]: value } as Partial<BladeToolParams>)
}

function showAddCustomToolDialog() {
  newToolName.value = ''
  newToolType.value = 'flat'
  newToolWidth.value = 2
  customToolDialogVisible.value = true
}

function addCustomTool() {
  if (!newToolName.value.trim()) {
    message.warning('请输入刻刀名称')
    return
  }
  const tool: BladeToolParams = {
    id: `tool-custom-${generateId()}`,
    name: newToolName.value.trim(),
    bladeType: newToolType.value,
    nominalWidth: newToolWidth.value,
    edgeAngle: 30,
    tipSharpness: 0.9,
    flexibility: 0.3,
    wearLevel: 0.05
  }
  experimentStore.addCustomTool(tool)
  selectedToolId.value = tool.id
  customToolDialogVisible.value = false
  message.success('已添加自定义刻刀')
}

function removeTool(id: string) {
  if (currentTools.value.length <= 1) {
    message.warning('至少保留一把刻刀')
    return
  }
  dialog.warning({
    title: '删除刻刀',
    content: '确定要删除这把刻刀吗？相关刀路将切换到默认刻刀。',
    positiveText: '删除',
    negativeText: '取消',
    positiveButtonProps: { type: 'error' },
    onPositiveClick: () => {
      experimentStore.removeTool(id)
      if (selectedToolId.value === id && currentTools.value.length > 0) {
        selectedToolId.value = currentTools.value[0].id
      }
      message.success('已删除刻刀')
    }
  })
}

function updateOrderTool(pathId: string, toolId: string) {
  experimentStore.updateExecutionOrder(pathId, { toolParamsId: toolId })
}

function updateOrderStroke(pathId: string, field: keyof PathExecutionOrder['strokeConfig'], value: number) {
  experimentStore.updateStrokeConfig(pathId, { [field]: value } as Partial<PathExecutionOrder['strokeConfig']>)
}

function moveOrderUp(index: number) {
  if (index <= 0) return
  const order = sortedOrders.value[index]
  experimentStore.moveOrder(order.pathId, index - 1)
}

function moveOrderDown(index: number) {
  if (index >= sortedOrders.value.length - 1) return
  const order = sortedOrders.value[index]
  experimentStore.moveOrder(order.pathId, index + 1)
}

function getPathNumber(pathId: string): string {
  const path = bladePathStore.getBladePathById(pathId)
  return path?.pathNumber || pathId
}

function getLayerName(layerId: string): string {
  return layerStore.getLayerById(layerId)?.name || layerId
}

async function runSimulationRound() {
  if (!currentScheme.value) {
    message.warning('请先导入方案')
    return
  }
  if (currentOrders.value.length === 0) {
    message.warning('暂无刀路数据')
    return
  }
  try {
    const result = await experimentStore.runRound(currentScheme.value)
    if (result) {
      activeSection.value = 'result'
      message.success(`第 ${result.round.roundNumber} 轮模拟完成，相似度 ${(result.round.overallSimilarity * 100).toFixed(1)}%`)
    }
  } catch (err: any) {
    message.error(err.message || '模拟失败')
  }
}

function applySuggestions() {
  if (!currentRound.value) {
    message.warning('请先完成至少一轮模拟')
    return
  }
  const suggestions = experimentStore.applySuggestedParams()
  if (suggestions && suggestions.length > 0) {
    message.info(`已应用优化建议：${suggestions[0]}`)
  }
}

function selectRound(index: number) {
  experimentStore.selectRound(index)
  compareRoundA.value = -1
  compareRoundB.value = -1
}

function setCompareRound(which: 'A' | 'B', index: number) {
  if (which === 'A') compareRoundA.value = index
  else compareRoundB.value = index
}

function generateConclusion() {
  if (!activeExperiment.value || activeExperiment.value.rounds.length === 0) {
    message.warning('请先完成至少一轮模拟')
    return
  }
  const result = experimentStore.completeExperiment()
  if (result) {
    activeSection.value = 'conclusion'
    message.success('实验结论已生成')
  }
}

function exportExperimentReport() {
  if (!activeExperiment.value?.conclusion) {
    message.warning('请先生成实验结论')
    return
  }
  const c = activeExperiment.value.conclusion
  const content = `
版刻工艺模拟与复刻实验报告
=====================================

实验名称：${c.experimentName}
生成时间：${new Date(c.generatedAt).toLocaleString('zh-CN')}

实验摘要
-------------------------------------
${c.summary}

核心发现
-------------------------------------
${c.keyFindings.map((f, i) => `${i + 1}. ${f}`).join('\n')}

误差模式分析
-------------------------------------
${c.errorPatterns.map((p, i) => `${i + 1}. ${p.pattern}（出现频率 ${(p.frequency * 100).toFixed(0)}%）- 建议：${p.suggestion}`).join('\n')}

质量趋势
-------------------------------------
质量评分：${c.qualityTrend.map((v) => (v * 100).toFixed(1) + '%').join(' → ')}
相似度：${c.similarityTrend.map((v) => (v * 100).toFixed(1) + '%').join(' → ')}

建议
-------------------------------------
${c.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

最佳实验轮次：第 ${c.bestRoundNumber} 轮
=====================================
  `.trim()

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `版刻复刻实验报告_${c.experimentName}_${Date.now()}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  message.success('实验报告已导出')
}

function formatNumber(v: number, digits = 2): string {
  return v.toFixed(digits)
}
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    @click.self="close"
  >
    <div class="bg-white rounded-2xl shadow-2xl w-[98vw] h-[92vh] max-w-[1800px] overflow-hidden flex flex-col">
      <div class="px-6 py-4 border-b border-[#D4C4A8] flex items-center justify-between bg-[#F5F0E6]/50">
        <div>
          <h2 class="text-lg font-bold text-[#3D2B1F] flex items-center gap-2">
            <svg class="w-5 h-5 text-[#C41E3A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            版刻工艺模拟与复刻实验
          </h2>
          <p class="text-xs text-[#8B7355] mt-1">
            基于已标注刀路、刀痕宽度、起收刀习惯与图层顺序，模拟刻刀参数与下刀顺序对版面效果的影响
            <span v-if="activeExperiment" class="ml-2">· 已完成 {{ activeExperiment.rounds.length }} 轮实验</span>
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            v-if="activeExperiment?.conclusion"
            @click="exportExperimentReport"
            class="px-4 py-2 border border-[#D4C4A8] text-[#3D2B1F] rounded-lg hover:bg-[#F5F0E6] transition-colors text-sm font-medium flex items-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            导出报告
          </button>
          <button
            @click="close"
            class="p-2 hover:bg-[#F5F0E6] rounded-lg transition-colors"
          >
            <svg class="w-5 h-5 text-[#8B7355]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div class="flex border-b border-[#D4C4A8] bg-[#F5F0E6]/30 px-2">
        <button
          v-for="tab in [
            { key: 'params', label: '刻刀参数', icon: '🔧' },
            { key: 'execution', label: '下刀顺序', icon: '📋' },
            { key: 'result', label: '模拟结果', icon: '🎨' },
            { key: 'trace', label: '参数回溯', icon: '📜' },
            { key: 'conclusion', label: '实验结论', icon: '📊' }
          ]"
          :key="tab.key"
          @click="activeSection = tab.key as any"
          :class="[
            'px-5 py-3 text-sm font-medium transition-colors relative flex items-center gap-1.5',
            activeSection === tab.key ? 'text-[#C41E3A]' : 'text-[#8B7355] hover:text-[#3D2B1F]'
          ]"
        >
          <span>{{ tab.icon }}</span>
          {{ tab.label }}
          <div
            v-if="activeSection === tab.key"
            class="absolute bottom-0 left-2 right-2 h-0.5 bg-[#C41E3A] rounded-full"
          />
        </button>
      </div>

      <div class="flex-1 overflow-hidden">
        <div v-if="activeSection === 'params'" class="h-full flex overflow-hidden">
          <div class="w-72 border-r border-[#D4C4A8] flex flex-col bg-white">
            <div class="p-3 border-b border-[#D4C4A8] flex items-center justify-between">
              <span class="text-sm font-medium text-[#3D2B1F]">刻刀库</span>
              <button
                @click="showAddCustomToolDialog"
                class="text-xs px-2.5 py-1 border border-dashed border-[#D4C4A8] text-[#8B7355] rounded hover:bg-[#F5F0E6] transition-colors flex items-center gap-1"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                自定义
              </button>
            </div>
            <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
              <div
                v-for="tool in currentTools"
                :key="tool.id"
                @click="selectedToolId = tool.id"
                :class="[
                  'p-2.5 rounded-lg border cursor-pointer transition-all group',
                  selectedToolId === tool.id
                    ? 'bg-[#C41E3A]/5 border-[#C41E3A] ring-1 ring-[#C41E3A]/30'
                    : 'bg-white border-[#D4C4A8] hover:bg-[#F5F0E6]'
                ]"
              >
                <div class="flex items-start justify-between mb-1.5">
                  <div>
                    <div class="text-sm font-medium text-[#3D2B1F]">{{ tool.name }}</div>
                    <span
                      class="inline-block mt-1 px-1.5 py-0.5 text-[10px] rounded border"
                      :class="getBladeTypeColor(tool.bladeType)"
                    >
                      {{ BLADE_TYPE_LABELS[tool.bladeType] }}
                    </span>
                  </div>
                  <button
                    v-if="tool.id.startsWith('tool-custom-')"
                    @click.stop="removeTool(tool.id)"
                    class="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-opacity"
                  >
                    <svg class="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                <div class="grid grid-cols-2 gap-1 text-[11px] text-[#8B7355]">
                  <span>刃宽 {{ formatNumber(tool.nominalWidth, 1) }}mm</span>
                  <span>锋度 {{ formatNumber(tool.tipSharpness * 100, 0) }}%</span>
                </div>
              </div>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-6 bg-[#F5F0E6]/20">
            <div v-if="selectedTool" class="max-w-2xl mx-auto">
              <h3 class="text-base font-bold text-[#3D2B1F] mb-4 flex items-center gap-2">
                <span class="w-8 h-8 rounded-lg bg-[#C41E3A]/10 flex items-center justify-center text-[#C41E3A]">🔧</span>
                {{ selectedTool.name }} · 参数配置
              </h3>

              <div class="space-y-5 bg-white rounded-xl p-5 border border-[#D4C4A8]">
                <div>
                  <label class="block text-xs font-medium text-[#3D2B1F] mb-2">刻刀类型</label>
                  <div class="grid grid-cols-5 gap-2">
                    <button
                      v-for="(label, type) in BLADE_TYPE_LABELS"
                      :key="type"
                      @click="updateToolParam('bladeType', type)"
                      :class="[
                        'py-2 px-2 rounded-lg text-xs font-medium transition-all border',
                        selectedTool.bladeType === type
                          ? 'bg-[#1D4E89] text-white border-[#1D4E89]'
                          : 'bg-white text-[#5c4a3a] border-[#D4C4A8] hover:bg-[#F5F0E6]'
                      ]"
                    >
                      {{ label }}
                    </button>
                  </div>
                </div>

                <div>
                  <div class="flex items-center justify-between mb-1.5">
                    <label class="text-xs font-medium text-[#3D2B1F]">标称刃宽</label>
                    <span class="text-xs text-[#C41E3A] font-mono">{{ formatNumber(selectedTool.nominalWidth, 2) }} mm</span>
                  </div>
                  <input
                    type="range"
                    min="0.3"
                    max="5"
                    step="0.1"
                    :value="selectedTool.nominalWidth"
                    @input="(e) => updateToolParam('nominalWidth', parseFloat((e.target as HTMLInputElement).value))"
                    class="w-full accent-[#C41E3A]"
                  />
                </div>

                <div>
                  <div class="flex items-center justify-between mb-1.5">
                    <label class="text-xs font-medium text-[#3D2B1F]">刃口角度</label>
                    <span class="text-xs text-[#C41E3A] font-mono">{{ formatNumber(selectedTool.edgeAngle, 0) }}°</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="60"
                    step="1"
                    :value="selectedTool.edgeAngle"
                    @input="(e) => updateToolParam('edgeAngle', parseFloat((e.target as HTMLInputElement).value))"
                    class="w-full accent-[#C41E3A]"
                  />
                </div>

                <div>
                  <div class="flex items-center justify-between mb-1.5">
                    <label class="text-xs font-medium text-[#3D2B1F]">刀尖锋利度</label>
                    <span class="text-xs text-[#C41E3A] font-mono">{{ formatNumber(selectedTool.tipSharpness * 100, 0) }}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.3"
                    max="1"
                    step="0.01"
                    :value="selectedTool.tipSharpness"
                    @input="(e) => updateToolParam('tipSharpness', parseFloat((e.target as HTMLInputElement).value))"
                    class="w-full accent-[#C41E3A]"
                  />
                </div>

                <div>
                  <div class="flex items-center justify-between mb-1.5">
                    <label class="text-xs font-medium text-[#3D2B1F]">刀身弹性</label>
                    <span class="text-xs text-[#C41E3A] font-mono">{{ formatNumber(selectedTool.flexibility * 100, 0) }}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    :value="selectedTool.flexibility"
                    @input="(e) => updateToolParam('flexibility', parseFloat((e.target as HTMLInputElement).value))"
                    class="w-full accent-[#C41E3A]"
                  />
                </div>

                <div>
                  <div class="flex items-center justify-between mb-1.5">
                    <label class="text-xs font-medium text-[#3D2B1F]">磨损程度</label>
                    <span class="text-xs text-[#C41E3A] font-mono">{{ formatNumber(selectedTool.wearLevel * 100, 0) }}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.5"
                    step="0.01"
                    :value="selectedTool.wearLevel"
                    @input="(e) => updateToolParam('wearLevel', parseFloat((e.target as HTMLInputElement).value))"
                    class="w-full accent-[#C41E3A]"
                  />
                </div>
              </div>

              <div class="mt-5 bg-[#1D4E89]/5 rounded-xl p-4 border border-[#1D4E89]/20">
                <h4 class="text-sm font-medium text-[#1D4E89] mb-2 flex items-center gap-1.5">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  参数说明
                </h4>
                <ul class="text-xs text-[#5c4a3a] space-y-1.5 leading-relaxed">
                  <li>· <b>刃口角度</b>：角度越小越锋利，但耐用性越低；角度越大越钝，适合硬木</li>
                  <li>· <b>刀尖锋利度</b>：影响起收刀处的刀痕质量，高锋利度产生更干净的切口</li>
                  <li>· <b>刀身弹性</b>：弹性刀适合曲线雕刻，刚性刀适合直线刻划</li>
                  <li>· <b>磨损程度</b>：新刀磨损低、刻痕锐利；磨损高会导致刀痕变宽、边缘毛糙</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="activeSection === 'execution'" class="h-full overflow-y-auto p-6 bg-[#F5F0E6]/20">
          <div class="max-w-5xl mx-auto">
            <div class="flex items-center justify-between mb-5">
              <h3 class="text-base font-bold text-[#3D2B1F] flex items-center gap-2">
                <span class="w-8 h-8 rounded-lg bg-[#1D4E89]/10 flex items-center justify-center text-[#1D4E89]">📋</span>
                下刀顺序与运刀参数
                <span class="text-xs font-normal text-[#8B7355] ml-2">共 {{ sortedOrders.length }} 条刀路</span>
              </h3>
              <div class="flex gap-2">
                <button
                  v-if="currentRound"
                  @click="applySuggestions"
                  class="px-4 py-2 text-sm border border-[#D4C4A8] text-[#3D2B1F] rounded-lg hover:bg-[#F5F0E6] transition-colors flex items-center gap-1.5"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  智能优化参数
                </button>
                <button
                  @click="runSimulationRound"
                  :disabled="isSimulating || sortedOrders.length === 0"
                  class="px-5 py-2.5 bg-[#C41E3A] text-white rounded-lg hover:bg-[#a81a31] transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  <svg v-if="isSimulating" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {{ isSimulating ? '模拟中...' : `执行第 ${(activeExperiment?.rounds.length || 0) + 1} 轮模拟` }}
                </button>
              </div>
            </div>

            <div class="bg-white rounded-xl border border-[#D4C4A8] overflow-hidden">
              <table class="w-full text-sm">
                <thead class="bg-[#F5F0E6] text-[#5c4a3a] text-xs">
                  <tr>
                    <th class="px-3 py-2.5 text-left font-medium w-14">顺序</th>
                    <th class="px-3 py-2.5 text-left font-medium">刀路编号</th>
                    <th class="px-3 py-2.5 text-left font-medium">所属图层</th>
                    <th class="px-3 py-2.5 text-left font-medium">刻刀</th>
                    <th class="px-3 py-2.5 text-left font-medium w-40">运刀压力</th>
                    <th class="px-3 py-2.5 text-left font-medium w-40">运刀速度</th>
                    <th class="px-3 py-2.5 text-left font-medium w-40">下刀角度</th>
                    <th class="px-3 py-2.5 text-left font-medium w-40">刻划深度</th>
                    <th class="px-3 py-2.5 text-center font-medium w-20">调整</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[#E8E0D0]">
                  <tr v-for="(order, idx) in sortedOrders" :key="order.pathId" class="hover:bg-[#F5F0E6]/50">
                    <td class="px-3 py-2 text-[#8B7355] font-mono text-xs">#{{ String(idx + 1).padStart(3, '0') }}</td>
                    <td class="px-3 py-2 font-medium text-[#3D2B1F]">{{ getPathNumber(order.pathId) }}</td>
                    <td class="px-3 py-2 text-xs text-[#5c4a3a]">{{ getLayerName(order.layerId) }}</td>
                    <td class="px-3 py-2">
                      <select
                        :value="order.toolParamsId"
                        @change="(e) => updateOrderTool(order.pathId, (e.target as HTMLSelectElement).value)"
                        class="text-xs px-2 py-1 border border-[#D4C4A8] rounded focus:outline-none focus:ring-1 focus:ring-[#1D4E89]/30 bg-white"
                      >
                        <option v-for="tool in currentTools" :key="tool.id" :value="tool.id">
                          {{ tool.name }}
                        </option>
                      </select>
                    </td>
                    <td class="px-3 py-2">
                      <div class="flex items-center gap-2">
                        <input
                          type="range"
                          min="0.1"
                          max="1"
                          step="0.05"
                          :value="order.strokeConfig.pressure"
                          @input="(e) => updateOrderStroke(order.pathId, 'pressure', parseFloat((e.target as HTMLInputElement).value))"
                          class="flex-1 accent-[#C41E3A] w-20"
                        />
                        <span class="text-xs text-[#C41E3A] font-mono w-8">{{ formatNumber(order.strokeConfig.pressure, 2) }}</span>
                      </div>
                    </td>
                    <td class="px-3 py-2">
                      <div class="flex items-center gap-2">
                        <input
                          type="range"
                          min="0.1"
                          max="1"
                          step="0.05"
                          :value="order.strokeConfig.speed"
                          @input="(e) => updateOrderStroke(order.pathId, 'speed', parseFloat((e.target as HTMLInputElement).value))"
                          class="flex-1 accent-[#C41E3A] w-20"
                        />
                        <span class="text-xs text-[#C41E3A] font-mono w-8">{{ formatNumber(order.strokeConfig.speed, 2) }}</span>
                      </div>
                    </td>
                    <td class="px-3 py-2">
                      <div class="flex items-center gap-2">
                        <input
                          type="range"
                          min="15"
                          max="165"
                          step="5"
                          :value="order.strokeConfig.angle"
                          @input="(e) => updateOrderStroke(order.pathId, 'angle', parseFloat((e.target as HTMLInputElement).value))"
                          class="flex-1 accent-[#C41E3A] w-20"
                        />
                        <span class="text-xs text-[#C41E3A] font-mono w-8">{{ order.strokeConfig.angle }}°</span>
                      </div>
                    </td>
                    <td class="px-3 py-2">
                      <div class="flex items-center gap-2">
                        <input
                          type="range"
                          min="0.1"
                          max="1"
                          step="0.05"
                          :value="order.strokeConfig.depth"
                          @input="(e) => updateOrderStroke(order.pathId, 'depth', parseFloat((e.target as HTMLInputElement).value))"
                          class="flex-1 accent-[#C41E3A] w-20"
                        />
                        <span class="text-xs text-[#C41E3A] font-mono w-8">{{ formatNumber(order.strokeConfig.depth, 2) }}</span>
                      </div>
                    </td>
                    <td class="px-3 py-2 text-center">
                      <div class="flex items-center justify-center gap-1">
                        <button
                          @click="moveOrderUp(idx)"
                          :disabled="idx === 0"
                          class="p-1 hover:bg-[#D4C4A8]/30 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <svg class="w-3.5 h-3.5 text-[#5c4a3a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          @click="moveOrderDown(idx)"
                          :disabled="idx === sortedOrders.length - 1"
                          class="p-1 hover:bg-[#D4C4A8]/30 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <svg class="w-3.5 h-3.5 text-[#5c4a3a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div v-else-if="activeSection === 'result'" class="h-full overflow-hidden flex">
          <div class="w-80 border-r border-[#D4C4A8] flex flex-col bg-white">
            <div class="p-3 border-b border-[#D4C4A8]">
              <span class="text-sm font-medium text-[#3D2B1F]">实验轮次</span>
              <span class="text-xs text-[#8B7355] ml-1">(点击查看详情)</span>
            </div>
            <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
              <div
                v-if="!activeExperiment || activeExperiment.rounds.length === 0"
                class="text-center py-8 text-[#8B7355] text-sm"
              >
                <svg class="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                暂无实验数据<br />
                请在「下刀顺序」页执行模拟
              </div>
              <div
                v-for="(round, idx) in activeExperiment?.rounds || []"
                :key="round.roundId"
                @click="selectRound(idx)"
                :class="[
                  'p-3 rounded-lg border cursor-pointer transition-all',
                  currentRound?.roundId === round.roundId
                    ? 'bg-[#C41E3A]/5 border-[#C41E3A] ring-1 ring-[#C41E3A]/30'
                    : 'bg-white border-[#D4C4A8] hover:bg-[#F5F0E6]'
                ]"
              >
                <div class="flex items-center justify-between mb-1.5">
                  <span class="text-sm font-medium text-[#3D2B1F]">{{ round.name }}</span>
                  <span
                    v-if="activeExperiment?.conclusion?.bestRoundId === round.roundId"
                    class="px-1.5 py-0.5 text-[10px] bg-[#2E5D3B] text-white rounded"
                  >最佳</span>
                </div>
                <div class="space-y-1">
                  <div class="flex items-center gap-2">
                    <div class="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all"
                        :class="round.overallSimilarity >= 0.8 ? 'bg-green-500' : round.overallSimilarity >= 0.6 ? 'bg-amber-500' : 'bg-red-500'"
                        :style="{ width: `${round.overallSimilarity * 100}%` }"
                      />
                    </div>
                    <span
                      class="text-xs font-bold w-10 text-right"
                      :class="round.overallSimilarity >= 0.8 ? 'text-green-600' : round.overallSimilarity >= 0.6 ? 'text-amber-600' : 'text-red-600'"
                    >
                      {{ formatNumber(round.overallSimilarity * 100, 0) }}%
                    </span>
                  </div>
                  <div class="grid grid-cols-2 gap-x-3 text-[11px] text-[#8B7355]">
                    <span>质量 {{ formatNumber(round.overallQualityScore * 100, 0) }}%</span>
                    <span>热区 {{ round.hotspots.length }} 处</span>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="activeExperiment && activeExperiment.rounds.length >= 2" class="border-t border-[#D4C4A8] p-3">
              <div class="text-xs font-medium text-[#3D2B1F] mb-2">轮次对比</div>
              <div class="grid grid-cols-2 gap-2 mb-2">
                <select
                  v-model="compareRoundA"
                  class="text-xs px-2 py-1.5 border border-[#D4C4A8] rounded focus:outline-none"
                >
                  <option :value="-1">选择轮次A</option>
                  <option v-for="(r, i) in activeExperiment.rounds" :key="r.roundId" :value="i">
                    第{{ r.roundNumber }}轮
                  </option>
                </select>
                <select
                  v-model="compareRoundB"
                  class="text-xs px-2 py-1.5 border border-[#D4C4A8] rounded focus:outline-none"
                >
                  <option :value="-1">选择轮次B</option>
                  <option v-for="(r, i) in activeExperiment.rounds" :key="r.roundId" :value="i">
                    第{{ r.roundNumber }}轮
                  </option>
                </select>
              </div>
              <div v-if="roundComparison" class="text-[11px] space-y-1 bg-[#F5F0E6] rounded p-2">
                <div v-if="roundComparison.improvements.length > 0" class="text-[#2E5D3B]">
                  提升：{{ roundComparison.improvements.join('、') }}
                </div>
                <div v-if="roundComparison.regressions.length > 0" class="text-[#C41E3A]">
                  下降：{{ roundComparison.regressions.join('、') }}
                </div>
                <div v-if="roundComparison.improvements.length === 0 && roundComparison.regressions.length === 0" class="text-[#8B7355]">
                  无显著差异
                </div>
              </div>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-5 bg-[#F5F0E6]/20">
            <div v-if="!currentRound" class="h-full flex items-center justify-center text-[#8B7355]">
              请选择一个实验轮次查看结果
            </div>
            <div v-else class="max-w-6xl mx-auto space-y-5">
              <div class="grid grid-cols-4 gap-3">
                <div class="bg-white rounded-xl p-4 border border-[#D4C4A8]">
                  <div class="text-xs text-[#8B7355] mb-1">版面质量</div>
                  <div class="text-2xl font-bold" :class="currentRound.overallQualityScore >= 0.8 ? 'text-[#2E5D3B]' : currentRound.overallQualityScore >= 0.6 ? 'text-[#E8A838]' : 'text-[#C41E3A]'">
                    {{ formatNumber(currentRound.overallQualityScore * 100, 1) }}%
                  </div>
                </div>
                <div class="bg-white rounded-xl p-4 border border-[#D4C4A8]">
                  <div class="text-xs text-[#8B7355] mb-1">与原版相似度</div>
                  <div class="text-2xl font-bold" :class="currentRound.overallSimilarity >= 0.8 ? 'text-[#2E5D3B]' : currentRound.overallSimilarity >= 0.6 ? 'text-[#E8A838]' : 'text-[#C41E3A]'">
                    {{ formatNumber(currentRound.overallSimilarity * 100, 1) }}%
                  </div>
                </div>
                <div class="bg-white rounded-xl p-4 border border-[#D4C4A8]">
                  <div class="text-xs text-[#8B7355] mb-1">平均宽度偏差</div>
                  <div class="text-2xl font-bold" :class="currentRound.widthDeviation <= 0.15 ? 'text-[#2E5D3B]' : currentRound.widthDeviation <= 0.3 ? 'text-[#E8A838]' : 'text-[#C41E3A]'">
                    {{ formatNumber(currentRound.widthDeviation * 100, 1) }}%
                  </div>
                </div>
                <div class="bg-white rounded-xl p-4 border border-[#D4C4A8]">
                  <div class="text-xs text-[#8B7355] mb-1">误差热区</div>
                  <div class="text-2xl font-bold" :class="currentRound.hotspots.length <= 3 ? 'text-[#2E5D3B]' : currentRound.hotspots.length <= 10 ? 'text-[#E8A838]' : 'text-[#C41E3A]'">
                    {{ currentRound.hotspots.length }} <span class="text-sm font-normal text-[#8B7355]">处</span>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-5">
                <div class="bg-white rounded-xl border border-[#D4C4A8] overflow-hidden">
                  <div class="px-4 py-3 border-b border-[#D4C4A8] bg-[#F5F0E6]/50">
                    <h4 class="text-sm font-medium text-[#3D2B1F] flex items-center gap-1.5">
                      <svg class="w-4 h-4 text-[#C41E3A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                      </svg>
                      误差热区分布 ({{ currentRound.hotspots.length }})
                    </h4>
                  </div>
                  <div class="p-4 max-h-80 overflow-y-auto">
                    <div v-if="currentRound.hotspots.length === 0" class="text-center py-6 text-[#8B7355] text-sm">
                      无显著误差热区，模拟效果良好
                    </div>
                    <div v-else class="space-y-2">
                      <div
                        v-for="hotspot in currentRound.hotspots.slice(0, 20)"
                        :key="hotspot.id"
                        class="p-3 rounded-lg border bg-[#F5F0E6]/30"
                        :style="{ borderColor: getHotspotSeverityColor(hotspot.severity) + '50' }"
                      >
                        <div class="flex items-start justify-between mb-1.5">
                          <div class="flex items-center gap-2">
                            <span
                              class="w-2.5 h-2.5 rounded-full"
                              :style="{ backgroundColor: getHotspotSeverityColor(hotspot.severity) }"
                            />
                            <span class="text-xs font-medium text-[#3D2B1F]">{{ getHotspotCategoryLabel(hotspot.category) }}</span>
                            <span
                              class="px-1.5 py-0.5 text-[10px] rounded"
                              :class="hotspot.severity === 'critical' ? 'bg-red-100 text-red-700' : hotspot.severity === 'moderate' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'"
                            >
                              {{ hotspot.severity === 'critical' ? '严重' : hotspot.severity === 'moderate' ? '中等' : '轻微' }}
                            </span>
                          </div>
                          <span class="text-[11px] text-[#8B7355] font-mono">
                            ({{ formatNumber(hotspot.x, 0) }}, {{ formatNumber(hotspot.y, 0) }})
                          </span>
                        </div>
                        <div class="text-[11px] text-[#5c4a3a] mb-1">{{ hotspot.description }}</div>
                        <div class="flex items-center gap-2">
                          <div class="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              class="h-full rounded-full"
                              :style="{
                                width: `${hotspot.errorScore * 100}%`,
                                backgroundColor: getHotspotSeverityColor(hotspot.severity)
                              }"
                            />
                          </div>
                          <span class="text-[10px] text-[#8B7355]">{{ formatNumber(hotspot.errorScore * 100, 0) }}%</span>
                        </div>
                      </div>
                      <div v-if="currentRound.hotspots.length > 20" class="text-center text-[11px] text-[#8B7355] pt-2">
                        仅显示前 20 条，共 {{ currentRound.hotspots.length }} 条
                      </div>
                    </div>
                  </div>
                </div>

                <div class="bg-white rounded-xl border border-[#D4C4A8] overflow-hidden">
                  <div class="px-4 py-3 border-b border-[#D4C4A8] bg-[#F5F0E6]/50">
                    <h4 class="text-sm font-medium text-[#3D2B1F] flex items-center gap-1.5">
                      <svg class="w-4 h-4 text-[#1D4E89]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      图层刻制效果
                    </h4>
                  </div>
                  <div class="p-4 space-y-3 max-h-80 overflow-y-auto">
                    <div
                      v-for="layer in currentRound.layerResults.filter(l => l.simulatedPaths.length > 0)"
                      :key="layer.layerId"
                      class="p-3 rounded-lg border border-[#E8E0D0]"
                    >
                      <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2">
                          <span class="text-sm font-medium text-[#3D2B1F]">{{ layer.layerName }}</span>
                          <span class="text-[11px] text-[#8B7355]">{{ layer.simulatedPaths.length }} 条刀路</span>
                        </div>
                        <span
                          class="text-xs px-2 py-0.5 rounded"
                          :class="layer.layerQualityScore >= 0.8 ? 'bg-green-100 text-green-700' : layer.layerQualityScore >= 0.6 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'"
                        >
                          质量 {{ formatNumber(layer.layerQualityScore * 100, 0) }}%
                        </span>
                      </div>
                      <div class="space-y-1">
                        <div
                          v-for="sp in layer.simulatedPaths.slice(0, 3)"
                          :key="sp.originalPathId"
                          class="flex items-center gap-2 text-[11px] bg-[#F5F0E6] rounded px-2 py-1.5"
                        >
                          <span class="font-medium text-[#3D2B1F]">{{ sp.pathNumber }}</span>
                          <span class="text-[#8B7355]">宽 {{ formatNumber(sp.effectiveWidth, 2) }}mm</span>
                          <span class="text-[#5c4a3a]">起:{{ getCutEffectLabel(sp.startEffect) }}</span>
                          <span class="text-[#5c4a3a]">收:{{ getCutEffectLabel(sp.endEffect) }}</span>
                        </div>
                        <div v-if="layer.simulatedPaths.length > 3" class="text-[10px] text-[#8B7355] pl-2">
                          还有 {{ layer.simulatedPaths.length - 3 }} 条刀路...
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="currentRound.paramChanges.length > 0" class="bg-white rounded-xl border border-[#D4C4A8] overflow-hidden">
                <div class="px-4 py-3 border-b border-[#D4C4A8] bg-[#F5F0E6]/50">
                  <h4 class="text-sm font-medium text-[#3D2B1F] flex items-center gap-1.5">
                    <svg class="w-4 h-4 text-[#6B4E71]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                    本轮参数变更 ({{ currentRound.paramChanges.length }})
                  </h4>
                </div>
                <div class="p-4">
                  <div class="flex flex-wrap gap-2">
                    <span
                      v-for="(change, i) in currentRound.paramChanges.slice(0, 15)"
                      :key="i"
                      class="inline-flex items-center gap-1 px-2.5 py-1 bg-[#6B4E71]/10 text-[#6B4E71] text-[11px] rounded-full"
                    >
                      {{ change.targetType === 'tool' ? '刻刀' : change.targetType === 'stroke' ? '运刀' : '顺序' }}
                      <b>{{ change.field }}</b>
                      <span class="text-[#8B7355]">{{ change.oldValue }}→{{ change.newValue }}</span>
                    </span>
                    <span v-if="currentRound.paramChanges.length > 15" class="text-[11px] text-[#8B7355] py-1">
                      +{{ currentRound.paramChanges.length - 15 }} 项变更
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="activeSection === 'trace'" class="h-full overflow-y-auto p-6 bg-[#F5F0E6]/20">
          <div class="max-w-4xl mx-auto">
            <h3 class="text-base font-bold text-[#3D2B1F] mb-5 flex items-center gap-2">
              <span class="w-8 h-8 rounded-lg bg-[#6B4E71]/10 flex items-center justify-center text-[#6B4E71]">📜</span>
              参数回溯记录
              <span v-if="activeExperiment" class="text-xs font-normal text-[#8B7355] ml-2">
                共 {{ activeExperiment.parameterTrace.length }} 条记录
              </span>
            </h3>

            <div v-if="!activeExperiment || activeExperiment.parameterTrace.length === 0" class="text-center py-16 text-[#8B7355]">
              <svg class="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              暂无回溯记录，请先执行模拟实验
            </div>

            <div v-else class="relative">
              <div class="absolute left-5 top-0 bottom-0 w-px bg-[#D4C4A8]" />
              <div class="space-y-5">
                <div
                  v-for="trace in [...activeExperiment.parameterTrace].reverse()"
                  :key="trace.roundId"
                  class="relative pl-14"
                >
                  <div
                    class="absolute left-0 w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md"
                    :class="trace.roundNumber === activeExperiment.conclusion?.bestRoundNumber ? 'bg-[#2E5D3B]' : 'bg-[#6B4E71]'"
                  >
                    #{{ trace.roundNumber }}
                  </div>
                  <div class="bg-white rounded-xl border border-[#D4C4A8] p-4">
                    <div class="flex items-start justify-between mb-3">
                      <div>
                        <div class="flex items-center gap-2">
                          <span class="text-sm font-bold text-[#3D2B1F]">第 {{ trace.roundNumber }} 轮实验</span>
                          <span
                            v-if="trace.roundNumber === activeExperiment.conclusion?.bestRoundNumber"
                            class="px-1.5 py-0.5 text-[10px] bg-[#2E5D3B] text-white rounded"
                          >最佳轮次</span>
                        </div>
                        <div class="text-xs text-[#8B7355] mt-0.5">
                          {{ new Date(trace.timestamp).toLocaleString('zh-CN') }}
                        </div>
                      </div>
                      <div class="flex gap-4 text-xs">
                        <div class="text-center">
                          <div class="text-[#8B7355]">质量</div>
                          <div
                            class="font-bold text-sm"
                            :class="trace.qualityScore >= 0.8 ? 'text-[#2E5D3B]' : trace.qualityScore >= 0.6 ? 'text-[#E8A838]' : 'text-[#C41E3A]'"
                          >{{ formatNumber(trace.qualityScore * 100, 0) }}%</div>
                        </div>
                        <div class="text-center">
                          <div class="text-[#8B7355]">相似度</div>
                          <div
                            class="font-bold text-sm"
                            :class="trace.similarityScore >= 0.8 ? 'text-[#2E5D3B]' : trace.similarityScore >= 0.6 ? 'text-[#E8A838]' : 'text-[#C41E3A]'"
                          >{{ formatNumber(trace.similarityScore * 100, 0) }}%</div>
                        </div>
                      </div>
                    </div>

                    <div class="mb-3">
                      <div class="text-xs font-medium text-[#5c4a3a] mb-1.5">使用刻刀</div>
                      <div class="flex flex-wrap gap-1.5">
                        <span
                          v-for="tool in trace.toolParams"
                          :key="tool.id"
                          class="inline-flex items-center gap-1 px-2 py-0.5 bg-[#1D4E89]/10 text-[#1D4E89] text-[11px] rounded"
                        >
                          {{ tool.name }} ({{ BLADE_TYPE_LABELS[tool.bladeType] }}·{{ formatNumber(tool.nominalWidth, 1) }}mm)
                        </span>
                      </div>
                    </div>

                    <div v-if="trace.keyDecisions.length > 0">
                      <div class="text-xs font-medium text-[#5c4a3a] mb-1.5">关键决策</div>
                      <ul class="text-[11px] text-[#5c4a3a] space-y-0.5">
                        <li v-for="(decision, i) in trace.keyDecisions" :key="i">· {{ decision }}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="activeSection === 'conclusion'" class="h-full overflow-y-auto p-6 bg-[#F5F0E6]/20">
          <div class="max-w-4xl mx-auto">
            <div v-if="!activeExperiment?.conclusion" class="bg-white rounded-xl border border-[#D4C4A8] p-10 text-center">
              <svg class="w-20 h-20 mx-auto mb-4 text-[#D4C4A8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 class="text-lg font-medium text-[#3D2B1F] mb-2">尚未生成实验结论</h3>
              <p class="text-sm text-[#8B7355] mb-5">完成多轮模拟实验后，可生成综合实验结论报告</p>
              <button
                @click="generateConclusion"
                :disabled="!activeExperiment || activeExperiment.rounds.length === 0"
                class="px-6 py-2.5 bg-[#2E5D3B] text-white rounded-lg hover:bg-[#284f32] transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                生成实验结论
              </button>
            </div>

            <div v-else class="space-y-5">
              <div class="bg-gradient-to-r from-[#2E5D3B] to-[#1D4E89] rounded-xl p-6 text-white">
                <div class="flex items-start justify-between">
                  <div>
                    <div class="text-xs opacity-80 mb-1">实验结论</div>
                    <h3 class="text-xl font-bold">{{ activeExperiment.conclusion.experimentName }}</h3>
                    <p class="text-sm opacity-90 mt-2 max-w-2xl">{{ activeExperiment.conclusion.summary }}</p>
                  </div>
                  <div class="text-right">
                    <div class="text-xs opacity-80">最佳轮次</div>
                    <div class="text-3xl font-bold">第 {{ activeExperiment.conclusion.bestRoundNumber }} 轮</div>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-4 mt-5 pt-5 border-t border-white/20">
                  <div>
                    <div class="text-xs opacity-80">质量趋势</div>
                    <div class="flex items-end gap-1 mt-1 h-8">
                      <div
                        v-for="(v, i) in activeExperiment.conclusion.qualityTrend"
                        :key="i"
                        class="w-5 bg-white/40 rounded-t transition-all"
                        :style="{ height: `${Math.max(4, v * 32)}px` }"
                      />
                    </div>
                  </div>
                  <div>
                    <div class="text-xs opacity-80">相似度趋势</div>
                    <div class="flex items-end gap-1 mt-1 h-8">
                      <div
                        v-for="(v, i) in activeExperiment.conclusion.similarityTrend"
                        :key="i"
                        class="w-5 bg-white/60 rounded-t transition-all"
                        :style="{ height: `${Math.max(4, v * 32)}px` }"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div class="bg-white rounded-xl border border-[#D4C4A8] overflow-hidden">
                <div class="px-4 py-3 border-b border-[#D4C4A8] bg-[#F5F0E6]/50">
                  <h4 class="text-sm font-medium text-[#3D2B1F] flex items-center gap-1.5">
                    <span class="w-5 h-5 rounded bg-[#1D4E89]/10 flex items-center justify-center text-[#1D4E89] text-xs">🎯</span>
                    核心发现
                  </h4>
                </div>
                <div class="p-4 space-y-2">
                  <div
                    v-for="(finding, i) in activeExperiment.conclusion.keyFindings"
                    :key="i"
                    class="flex gap-3 text-sm text-[#5c4a3a]"
                  >
                    <span class="flex-shrink-0 w-5 h-5 rounded-full bg-[#1D4E89]/10 text-[#1D4E89] text-xs flex items-center justify-center font-bold">{{ i + 1 }}</span>
                    <span>{{ finding }}</span>
                  </div>
                </div>
              </div>

              <div class="bg-white rounded-xl border border-[#D4C4A8] overflow-hidden">
                <div class="px-4 py-3 border-b border-[#D4C4A8] bg-[#F5F0E6]/50">
                  <h4 class="text-sm font-medium text-[#3D2B1F] flex items-center gap-1.5">
                    <span class="w-5 h-5 rounded bg-[#C41E3A]/10 flex items-center justify-center text-[#C41E3A] text-xs">⚠️</span>
                    误差模式分析
                  </h4>
                </div>
                <div class="p-4">
                  <table class="w-full text-sm">
                    <thead class="text-xs text-[#8B7355] border-b border-[#E8E0D0]">
                      <tr>
                        <th class="text-left py-2 font-medium">误差模式</th>
                        <th class="text-center py-2 font-medium w-24">出现频率</th>
                        <th class="text-left py-2 font-medium">改进建议</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(p, i) in activeExperiment.conclusion.errorPatterns"
                        :key="i"
                        class="border-b border-[#E8E0D0] last:border-b-0"
                      >
                        <td class="py-2.5 text-[#3D2B1F] font-medium">{{ p.pattern }}</td>
                        <td class="py-2.5 text-center">
                          <span
                            class="px-2 py-0.5 rounded text-xs"
                            :class="p.frequency >= 0.4 ? 'bg-red-100 text-red-700' : p.frequency >= 0.2 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'"
                          >{{ formatNumber(p.frequency * 100, 0) }}%</span>
                        </td>
                        <td class="py-2.5 text-[#5c4a3a] text-xs">{{ p.suggestion }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="bg-white rounded-xl border border-[#D4C4A8] overflow-hidden">
                <div class="px-4 py-3 border-b border-[#D4C4A8] bg-[#F5F0E6]/50">
                  <h4 class="text-sm font-medium text-[#3D2B1F] flex items-center gap-1.5">
                    <span class="w-5 h-5 rounded bg-[#2E5D3B]/10 flex items-center justify-center text-[#2E5D3B] text-xs">💡</span>
                    工艺建议
                  </h4>
                </div>
                <div class="p-4 space-y-2">
                  <div
                    v-for="(rec, i) in activeExperiment.conclusion.recommendations"
                    :key="i"
                    class="flex gap-3 text-sm text-[#5c4a3a] bg-[#2E5D3B]/5 rounded-lg p-3"
                  >
                    <svg class="w-4 h-4 text-[#2E5D3B] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{{ rec }}</span>
                  </div>
                </div>
              </div>

              <div class="bg-white rounded-xl border border-[#D4C4A8] overflow-hidden">
                <div class="px-4 py-3 border-b border-[#D4C4A8] bg-[#F5F0E6]/50">
                  <h4 class="text-sm font-medium text-[#3D2B1F] flex items-center gap-1.5">
                    <span class="w-5 h-5 rounded bg-[#6B4E71]/10 flex items-center justify-center text-[#6B4E71] text-xs">🔧</span>
                    推荐刻刀配置 (最佳轮次)
                  </h4>
                </div>
                <div class="p-4">
                  <div class="flex flex-wrap gap-2">
                    <span
                      v-for="tool in activeExperiment.conclusion.optimalToolParams"
                      :key="tool.id"
                      class="inline-flex flex-col px-3 py-2 bg-[#6B4E71]/5 border border-[#6B4E71]/20 rounded-lg"
                    >
                      <span class="text-sm font-medium text-[#6B4E71]">{{ tool.name }}</span>
                      <span class="text-[11px] text-[#8B7355]">
                        {{ BLADE_TYPE_LABELS[tool.bladeType] }} · {{ formatNumber(tool.nominalWidth, 1) }}mm · 锋度{{ formatNumber(tool.tipSharpness * 100, 0) }}%
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="customToolDialogVisible"
        class="absolute inset-0 z-10 flex items-center justify-center bg-black/40"
        @click.self="customToolDialogVisible = false"
      >
        <div class="bg-white rounded-xl shadow-2xl w-96 p-5">
          <h3 class="text-base font-bold text-[#3D2B1F] mb-4">添加自定义刻刀</h3>
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-medium text-[#3D2B1F] mb-1.5">刻刀名称</label>
              <input
                v-model="newToolName"
                type="text"
                placeholder="如：定制平口刀"
                class="w-full px-3 py-2 border border-[#D4C4A8] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4E89]/30"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-[#3D2B1F] mb-1.5">刻刀类型</label>
              <div class="grid grid-cols-5 gap-1.5">
                <button
                  v-for="(label, type) in BLADE_TYPE_LABELS"
                  :key="type"
                  @click="newToolType = type as BladeType"
                  :class="[
                    'py-1.5 px-1 rounded text-[11px] font-medium transition-all border',
                    newToolType === type
                      ? 'bg-[#1D4E89] text-white border-[#1D4E89]'
                      : 'bg-white text-[#5c4a3a] border-[#D4C4A8] hover:bg-[#F5F0E6]'
                  ]"
                >
                  {{ label }}
                </button>
              </div>
            </div>
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="text-xs font-medium text-[#3D2B1F]">标称刃宽</label>
                <span class="text-xs text-[#C41E3A] font-mono">{{ formatNumber(newToolWidth, 1) }} mm</span>
              </div>
              <input
                v-model.number="newToolWidth"
                type="range"
                min="0.3"
                max="5"
                step="0.1"
                class="w-full accent-[#C41E3A]"
              />
            </div>
          </div>
          <div class="flex gap-2 mt-5 pt-4 border-t border-[#E8E0D0]">
            <button
              @click="customToolDialogVisible = false"
              class="flex-1 py-2 border border-[#D4C4A8] text-[#3D2B1F] rounded-lg hover:bg-[#F5F0E6] transition-colors text-sm"
            >
              取消
            </button>
            <button
              @click="addCustomTool"
              class="flex-1 py-2 bg-[#C41E3A] text-white rounded-lg hover:bg-[#a81a31] transition-colors text-sm font-medium"
            >
              添加
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
