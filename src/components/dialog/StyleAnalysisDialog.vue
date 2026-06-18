<script setup lang="ts">
import { ref, computed, watch, h } from 'vue'
import { useStyleAnalysisStore } from '../../stores/styleAnalysisStore'
import { useProjectStore } from '../../stores/projectStore'
import { useMessage, useDialog } from 'naive-ui'
import { readJsonFile, parseSchemeJson } from '../../utils/import'
import type {
  AnnotationScheme,
  EngraverStyleProfile,
  VersionDiffSummary,
  SameEngraverAssociation,
  ConfidenceLevel
} from '../../types'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const styleAnalysisStore = useStyleAnalysisStore()
const projectStore = useProjectStore()
const message = useMessage()
const dialog = useDialog()

const schemeInputRef = ref<HTMLInputElement | null>(null)
const activeTab = ref<'profiles' | 'diffs' | 'associations'>('profiles')
const compareSchemeAId = ref<string>('')
const compareSchemeBId = ref<string>('')
const isComparing = ref(false)


const currentScheme = computed(() => projectStore.currentScheme)
const allSchemes = computed(() => styleAnalysisStore.getAllSchemes())
const importedSchemes = computed(() => styleAnalysisStore.importedSchemes)
const styleProfiles = computed(() => styleAnalysisStore.styleProfiles)
const versionDiffs = computed(() => styleAnalysisStore.versionDiffs)
const associations = computed(() => styleAnalysisStore.associations)
const isAnalyzing = computed(() => styleAnalysisStore.isAnalyzing)

const selectedProfile = computed(() => {
  if (!styleAnalysisStore.selectedProfileId) return null
  return styleProfiles.value.find((p) => p.schemeId === styleAnalysisStore.selectedProfileId) || null
})

const selectedDiff = computed(() => {
  if (!styleAnalysisStore.selectedDiffId) return null
  const [aId, bId] = styleAnalysisStore.selectedDiffId.split('-')
  return versionDiffs.value.find(
    (d) =>
      (d.schemeAId === aId && d.schemeBId === bId) ||
      (d.schemeAId === bId && d.schemeBId === aId)
  ) || null
})

const selectedAssociation = computed(() => {
  if (!styleAnalysisStore.selectedAssociationId) return null
  const ids = styleAnalysisStore.selectedAssociationId.split('-')
  return associations.value.find(
    (a) => a.schemeIds.join('-') === styleAnalysisStore.selectedAssociationId ||
      a.schemeIds.every((id, i) => id === ids[i])
  ) || null
})

watch(
  () => props.visible,
  (val) => {
    if (val && currentScheme.value) {
      if (allSchemes.value.length > 0) {
        compareSchemeAId.value = allSchemes.value[0].id
      }
    }
  }
)

function triggerSchemeImport() {
  schemeInputRef.value?.click()
}

async function handleSchemeImport(e: Event) {
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

    const exists = allSchemes.value.some((s) => s.id === parsed.id)
    if (exists) {
      message.warning('该方案已在列表中')
      return
    }

    styleAnalysisStore.addImportedScheme({ ...parsed, importedAt: Date.now() })
    message.success(`已添加方案：${parsed.projectName}`)
  } catch (err: any) {
    message.error(err.message || '导入失败')
  } finally {
    input.value = ''
  }
}

function removeScheme(id: string) {
  styleAnalysisStore.removeImportedScheme(id)
  if (compareSchemeBId.value === id) {
    compareSchemeBId.value = ''
  }
  if (compareSchemeAId.value === id && allSchemes.value.length > 0) {
    compareSchemeAId.value = allSchemes.value[0].id
  }
  message.success('已移除方案')
}

async function runFullAnalysis() {
  if (allSchemes.value.length === 0) {
    message.warning('请先导入至少一个方案')
    return
  }

  try {
    await styleAnalysisStore.analyzeAllSchemes()
    message.success('风格分析完成')
    if (associations.value.length > 0) {
      message.info(`发现 ${associations.value.length} 组疑似同工异版关联`)
    }
  } catch (err: any) {
    message.error(err.message || '分析失败')
  }
}

async function runCompare() {
  if (!compareSchemeAId.value || !compareSchemeBId.value) {
    message.warning('请选择两个方案进行对比')
    return
  }
  if (compareSchemeAId.value === compareSchemeBId.value) {
    message.warning('请选择两个不同的方案')
    return
  }

  isComparing.value = true
  try {
    const result = styleAnalysisStore.compareTwoSchemes(compareSchemeAId.value, compareSchemeBId.value)
    if (result) {
      activeTab.value = 'diffs'
      styleAnalysisStore.selectDiff(compareSchemeAId.value, compareSchemeBId.value)
      message.success('版次对比分析完成')
    }
  } catch (err: any) {
    message.error(err.message || '对比失败')
  } finally {
    isComparing.value = false
  }
}

function selectProfile(profile: EngraverStyleProfile) {
  styleAnalysisStore.selectProfile(profile.schemeId)
}

function selectDiffItem(diff: VersionDiffSummary) {
  styleAnalysisStore.selectDiff(diff.schemeAId, diff.schemeBId)
}

function selectAssociationItem(assoc: SameEngraverAssociation, index: number) {
  styleAnalysisStore.selectAssociation(index)
}

function getConfidenceColor(confidence: ConfidenceLevel): string {
  switch (confidence) {
    case 'high':
      return 'bg-green-100 text-green-700 border-green-300'
    case 'medium':
      return 'bg-amber-100 text-amber-700 border-amber-300'
    case 'low':
      return 'bg-gray-100 text-gray-700 border-gray-300'
  }
}

function getConfidenceLabel(confidence: ConfidenceLevel): string {
  switch (confidence) {
    case 'high':
      return '高置信'
    case 'medium':
      return '中置信'
    case 'low':
      return '低置信'
  }
}

function getSeverityColor(severity: 'minor' | 'moderate' | 'significant'): string {
  switch (severity) {
    case 'minor':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'moderate':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'significant':
      return 'bg-red-50 text-red-700 border-red-200'
  }
}

function getSeverityLabel(severity: 'minor' | 'moderate' | 'significant'): string {
  switch (severity) {
    case 'minor':
      return '轻微'
    case 'moderate':
      return '中等'
    case 'significant':
      return '显著'
  }
}

function showEditProfileFieldDialog(field: 'overallStyleDescription' | 'styleTags') {
  if (!selectedProfile.value) return

  const originalValue = field === 'overallStyleDescription'
    ? selectedProfile.value.overallStyleDescription
    : selectedProfile.value.styleTags.join(', ')

  let editValue = originalValue

  const d = dialog.create({
    title: field === 'overallStyleDescription' ? '编辑风格描述' : '编辑风格标签',
    content: () =>
      field === 'overallStyleDescription'
        ? h('textarea', {
            value: editValue,
            placeholder: '请输入风格描述',
            onInput: (e: Event) => {
              editValue = (e.target as HTMLTextAreaElement).value
            },
            style: 'width: 100%; padding: 8px 12px; border: 1px solid #d4c4a8; border-radius: 6px; font-size: 14px; min-height: 100px; resize: vertical; box-sizing: border-box; outline: none;',
            rows: 4
          }, [editValue])
        : h('input', {
            value: editValue,
            placeholder: '请输入标签（用逗号分隔）',
            onInput: (e: Event) => {
              editValue = (e.target as HTMLInputElement).value
            },
            style: 'width: 100%; padding: 8px 12px; border: 1px solid #d4c4a8; border-radius: 6px; font-size: 14px; box-sizing: border-box; outline: none;'
          }),
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      const reason = `修订${field === 'overallStyleDescription' ? '风格描述' : '风格标签'}`
      styleAnalysisStore.updateStyleProfileField(
        selectedProfile.value!.schemeId,
        field,
        editValue,
        projectStore.researcher,
        reason
      )
      message.success('修订已保存')
    }
  })
}

function showEditDiffFieldDialog(field: 'summaryText' | 'suspectedVersionRelation') {
  if (!selectedDiff.value) return

  const originalValue = field === 'summaryText'
    ? selectedDiff.value.summaryText
    : selectedDiff.value.suspectedVersionRelation

  const options = [
    { label: '极有可能为同一刻工的同一版次', value: '极有可能为同一刻工的同一版次' },
    { label: '疑似同一刻工的不同版次或不同阶段作品', value: '疑似同一刻工的不同版次或不同阶段作品' },
    { label: '可能为不同刻工的仿刻作品，或有师承关系', value: '可能为不同刻工的仿刻作品，或有师承关系' },
    { label: '大概率为不同刻工作品', value: '大概率为不同刻工作品' },
    { label: '自定义判断', value: 'custom' }
  ]

  let editValue = originalValue
  let selectedOption = options.some((o) => o.value === originalValue) ? originalValue : 'custom'

  const d = dialog.create({
    title: field === 'summaryText' ? '编辑差异摘要' : '编辑版次关系推断',
    content: () =>
      field === 'summaryText'
        ? h('textarea', {
            value: editValue,
            placeholder: '请输入差异摘要',
            onInput: (e: Event) => {
              editValue = (e.target as HTMLTextAreaElement).value
            },
            style: 'width: 100%; padding: 8px 12px; border: 1px solid #d4c4a8; border-radius: 6px; font-size: 14px; min-height: 100px; resize: vertical; box-sizing: border-box; outline: none;',
            rows: 4
          }, [editValue])
        : h('select', {
            value: selectedOption,
            onChange: (e: Event) => {
              selectedOption = (e.target as HTMLSelectElement).value
              if (selectedOption !== 'custom') {
                editValue = selectedOption
              }
            },
            style: 'width: 100%; padding: 8px 12px; border: 1px solid #d4c4a8; border-radius: 6px; font-size: 14px; box-sizing: border-box; outline: none; background: white;'
          }, options.map((opt) =>
            h('option', { value: opt.value, key: opt.value }, opt.label)
          )),
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      const diffId = `${selectedDiff.value!.schemeAId}-${selectedDiff.value!.schemeBId}`
      const reason = `修订${field === 'summaryText' ? '差异摘要' : '版次关系推断'}`
      styleAnalysisStore.updateVersionDiffField(
        diffId,
        field,
        editValue,
        projectStore.researcher,
        reason
      )
      message.success('修订已保存')
    }
  })
}

function showEditAssociationFieldDialog(field: 'analysisNotes' | 'sharedFeatures' | 'distinctiveFeatures') {
  if (!selectedAssociation.value) return

  const fieldLabels = {
    analysisNotes: '分析备注',
    sharedFeatures: '共同特征',
    distinctiveFeatures: '差异特征'
  }

  const originalValue = field === 'analysisNotes'
    ? selectedAssociation.value.analysisNotes
    : field === 'sharedFeatures'
      ? selectedAssociation.value.sharedFeatures.join(', ')
      : selectedAssociation.value.distinctiveFeatures.join(', ')

  let editValue = originalValue

  const d = dialog.create({
    title: `编辑${fieldLabels[field]}`,
    content: () =>
      field === 'analysisNotes'
        ? h('textarea', {
            value: editValue,
            placeholder: '请输入分析备注',
            onInput: (e: Event) => {
              editValue = (e.target as HTMLTextAreaElement).value
            },
            style: 'width: 100%; padding: 8px 12px; border: 1px solid #d4c4a8; border-radius: 6px; font-size: 14px; min-height: 100px; resize: vertical; box-sizing: border-box; outline: none;',
            rows: 4
          }, [editValue])
        : h('input', {
            value: editValue,
            placeholder: '请输入特征（用逗号分隔）',
            onInput: (e: Event) => {
              editValue = (e.target as HTMLInputElement).value
            },
            style: 'width: 100%; padding: 8px 12px; border: 1px solid #d4c4a8; border-radius: 6px; font-size: 14px; box-sizing: border-box; outline: none;'
          }),
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      const assocId = selectedAssociation.value!.schemeIds.join('-')
      const reason = `修订${fieldLabels[field]}`
      styleAnalysisStore.updateAssociationField(
        assocId,
        field,
        editValue,
        projectStore.researcher,
        reason
      )
      message.success('修订已保存')
    }
  })
}

function showAddEvidenceDialog(
  targetType: 'style_profile' | 'version_diff' | 'association',
  targetId: string
) {
  let content = ''

  const d = dialog.create({
    title: '添加判读依据',
    content: () =>
      h('textarea', {
        value: content,
        placeholder: '请输入判读依据说明...',
        onInput: (e: Event) => {
          content = (e.target as HTMLTextAreaElement).value
        },
        style: 'width: 100%; padding: 8px 12px; border: 1px solid #d4c4a8; border-radius: 6px; font-size: 14px; min-height: 100px; resize: vertical; box-sizing: border-box; outline: none;',
        rows: 4
      }, [content]),
    positiveText: '添加',
    negativeText: '取消',
    onPositiveClick: () => {
      if (!content.trim()) {
        message.warning('请输入依据内容')
        return
      }
      styleAnalysisStore.addJudgmentEvidence(
        targetType,
        targetId,
        content,
        'text_note',
        [],
        projectStore.researcher
      )
      message.success('判读依据已添加')
    }
  })
}

function showExportReportDialog() {
  let title = '刻工风格与版次分析研究报告'
  let notes = ''

  const d = dialog.create({
    title: '导出研究报告',
    content: () =>
      h('div', { style: 'display: flex; flex-direction: column; gap: 12px;' }, [
        h('div', { style: 'display: flex; flex-direction: column; gap: 4px;' }, [
          h('div', { style: 'font-size: 13px; color: #5c4a3a; font-weight: 500;' }, '报告标题'),
          h('input', {
            value: title,
            placeholder: '请输入报告标题',
            onInput: (e: Event) => {
              title = (e.target as HTMLInputElement).value
            },
            style: 'width: 100%; padding: 8px 12px; border: 1px solid #d4c4a8; border-radius: 6px; font-size: 14px; box-sizing: border-box; outline: none;'
          })
        ]),
        h('div', { style: 'display: flex; flex-direction: column; gap: 4px;' }, [
          h('div', { style: 'font-size: 13px; color: #5c4a3a; font-weight: 500;' }, '附加说明'),
          h('textarea', {
            value: notes,
            placeholder: '附加说明（可选）',
            onInput: (e: Event) => {
              notes = (e.target as HTMLTextAreaElement).value
            },
            style: 'width: 100%; padding: 8px 12px; border: 1px solid #d4c4a8; border-radius: 6px; font-size: 14px; min-height: 80px; resize: vertical; box-sizing: border-box; outline: none;',
            rows: 3
          }, [notes])
        ])
      ]),
    positiveText: '导出',
    negativeText: '取消',
    onPositiveClick: () => {
      styleAnalysisStore.exportReport(
        title,
        projectStore.researcher,
        notes
      )
      message.success('研究报告已导出')
    }
  })
}

function getCurrentTargetInfo(): { type: 'style_profile' | 'version_diff' | 'association'; id: string } | null {
  if (selectedProfile.value) {
    return { type: 'style_profile', id: selectedProfile.value.schemeId }
  }
  if (selectedDiff.value) {
    return { type: 'version_diff', id: `${selectedDiff.value.schemeAId}-${selectedDiff.value.schemeBId}` }
  }
  if (selectedAssociation.value) {
    return { type: 'association', id: selectedAssociation.value.schemeIds.join('-') }
  }
  return null
}

const currentEvidences = computed(() => {
  const target = getCurrentTargetInfo()
  if (!target) return []
  return styleAnalysisStore.getEvidencesForTarget(target.type, target.id)
})

const currentRevisions = computed(() => {
  const target = getCurrentTargetInfo()
  if (!target) return []
  return styleAnalysisStore.getRevisionsForTarget(target.type, target.id)
})

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN')
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
    <div class="bg-white rounded-2xl shadow-2xl w-[98vw] h-[92vh] max-w-[1800px] overflow-hidden flex flex-col">
      <div class="px-6 py-4 border-b border-[#D4C4A8] flex items-center justify-between bg-[#F5F0E6]/50">
        <div>
          <h2 class="text-lg font-bold text-[#3D2B1F] flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            刻工风格识别与版次推断
          </h2>
          <p class="text-xs text-[#8B7355] mt-1">基于刀路特征自动分析刻工风格，推断版次关系，识别同工异版关联</p>
        </div>
        <div class="flex items-center gap-2">
          <button
            v-if="styleProfiles.length > 0"
            @click="showExportReportDialog"
            class="px-4 py-2 border border-[#D4C4A8] text-[#3D2B1F] rounded-lg hover:bg-[#F5F0E6] transition-colors text-sm font-medium flex items-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            导出研究报告
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

      <div class="flex-1 flex overflow-hidden">
        <div class="w-96 border-r border-[#D4C4A8] flex flex-col bg-white">
          <div class="p-3 border-b border-[#D4C4A8] space-y-3">
            <div>
              <label class="block text-xs font-medium text-[#3D2B1F] mb-1">基准方案（方案A）</label>
              <select
                v-model="compareSchemeAId"
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
                v-model="compareSchemeBId"
                class="w-full px-3 py-2 border border-[#D4C4A8] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4E89]/30"
              >
                <option value="">请选择对比方案</option>
                <option v-for="scheme in allSchemes" :key="scheme.id" :value="scheme.id">
                  {{ scheme.researcher }} - {{ scheme.projectName }}
                </option>
              </select>
            </div>

            <button
              @click="triggerSchemeImport"
              class="w-full py-2 border border-dashed border-[#D4C4A8] text-[#8B7355] rounded-lg hover:bg-[#F5F0E6] transition-colors text-sm flex items-center justify-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              导入对比方案
            </button>
            <input
              ref="schemeInputRef"
              type="file"
              accept=".json"
              class="hidden"
              @change="handleSchemeImport"
            />

            <div class="grid grid-cols-2 gap-2">
              <button
                @click="runFullAnalysis"
                :disabled="allSchemes.length === 0 || isAnalyzing"
                class="py-2.5 bg-[#1D4E89] text-white rounded-lg hover:bg-[#1a4374] transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg v-if="isAnalyzing" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                {{ isAnalyzing ? '分析中...' : '全量分析' }}
              </button>
              <button
                @click="runCompare"
                :disabled="!compareSchemeAId || !compareSchemeBId || compareSchemeAId === compareSchemeBId || isComparing"
                class="py-2.5 bg-[#3D2B1F] text-white rounded-lg hover:bg-[#2d2017] transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                {{ isComparing ? '对比中...' : '版次对比' }}
              </button>
            </div>
          </div>

          <div class="flex border-b border-[#D4C4A8] bg-[#F5F0E6]/30">
            <button
              @click="activeTab = 'profiles'"
              :class="[
                'flex-1 py-2.5 text-xs font-medium transition-colors relative',
                activeTab === 'profiles' ? 'text-[#1D4E89]' : 'text-[#8B7355] hover:text-[#3D2B1F]'
              ]"
            >
              风格画像
              <span class="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-[#1D4E89]/10 text-[#1D4E89]">
                {{ styleProfiles.length }}
              </span>
              <div
                v-if="activeTab === 'profiles'"
                class="absolute bottom-0 left-2 right-2 h-0.5 bg-[#1D4E89] rounded-full"
              />
            </button>
            <button
              @click="activeTab = 'diffs'"
              :class="[
                'flex-1 py-2.5 text-xs font-medium transition-colors relative',
                activeTab === 'diffs' ? 'text-[#1D4E89]' : 'text-[#8B7355] hover:text-[#3D2B1F]'
              ]"
            >
              版次差异
              <span class="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-[#C41E3A]/10 text-[#C41E3A]">
                {{ versionDiffs.length }}
              </span>
              <div
                v-if="activeTab === 'diffs'"
                class="absolute bottom-0 left-2 right-2 h-0.5 bg-[#1D4E89] rounded-full"
              />
            </button>
            <button
              @click="activeTab = 'associations'"
              :class="[
                'flex-1 py-2.5 text-xs font-medium transition-colors relative',
                activeTab === 'associations' ? 'text-[#1D4E89]' : 'text-[#8B7355] hover:text-[#3D2B1F]'
              ]"
            >
              同工异版
              <span class="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-[#2E5D3B]/10 text-[#2E5D3B]">
                {{ associations.length }}
              </span>
              <div
                v-if="activeTab === 'associations'"
                class="absolute bottom-0 left-2 right-2 h-0.5 bg-[#1D4E89] rounded-full"
              />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-3">
            <template v-if="activeTab === 'profiles'">
              <div v-if="styleProfiles.length === 0" class="text-center py-8 text-[#8B7355] text-sm">
                <svg class="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                点击「全量分析」生成风格画像
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="profile in styleProfiles"
                  :key="profile.schemeId"
                  @click="selectProfile(profile)"
                  :class="[
                    'p-3 rounded-lg border cursor-pointer transition-all',
                    selectedProfile?.schemeId === profile.schemeId
                      ? 'bg-[#1D4E89]/5 border-[#1D4E89] ring-1 ring-[#1D4E89]/30'
                      : 'bg-white border-[#D4C4A8] hover:bg-[#F5F0E6]'
                  ]"
                >
                  <div class="flex items-start justify-between mb-2">
                    <div>
                      <div class="text-sm font-medium text-[#3D2B1F]">{{ profile.schemeName }}</div>
                      <div class="text-xs text-[#8B7355]">{{ profile.researcher }}</div>
                    </div>
                    <span
                      class="px-1.5 py-0.5 text-[10px] rounded-full"
                      :class="profile.pathMorphology.dominantType === 'smooth' ? 'bg-blue-100 text-blue-700' : profile.pathMorphology.dominantType === 'angular' ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-700'"
                    >
                      {{ profile.pathMorphology.dominantType === 'smooth' ? '流畅' : profile.pathMorphology.dominantType === 'angular' ? '刚劲' : '混合' }}
                    </span>
                  </div>
                  <div class="flex flex-wrap gap-1 mb-2">
                    <span
                      v-for="tag in profile.styleTags.slice(0, 4)"
                      :key="tag"
                      class="px-1.5 py-0.5 text-[10px] bg-[#F5F0E6] text-[#8B7355] rounded"
                    >
                      {{ tag }}
                    </span>
                  </div>
                  <div class="text-xs text-[#8B735] line-clamp-2">{{ profile.overallStyleDescription }}</div>
                </div>
              </div>
            </template>

            <template v-else-if="activeTab === 'diffs'">
              <div v-if="versionDiffs.length === 0" class="text-center py-8 text-[#8B7355] text-sm">
                <svg class="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                选择两个方案后点击「版次对比」
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="diff in versionDiffs"
                  :key="`${diff.schemeAId}-${diff.schemeBId}`"
                  @click="selectDiffItem(diff)"
                  :class="[
                    'p-3 rounded-lg border cursor-pointer transition-all',
                    selectedDiff?.schemeAId === diff.schemeAId && selectedDiff?.schemeBId === diff.schemeBId
                      ? 'bg-[#C41E3A]/5 border-[#C41E3A] ring-1 ring-[#C41E3A]/30'
                      : 'bg-white border-[#D4C4A8] hover:bg-[#F5F0E6]'
                  ]"
                >
                  <div class="flex items-center justify-between mb-2">
                    <div class="text-xs text-[#8B7355]">
                      {{ diff.schemeAName }}
                    </div>
                    <svg class="w-4 h-4 text-[#8B7355]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    <div class="text-xs text-[#8B7355]">
                      {{ diff.schemeBName }}
                    </div>
                  </div>
                  <div class="flex items-center gap-2 mb-2">
                    <div class="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all"
                        :class="diff.overallSimilarity >= 0.85 ? 'bg-green-500' : diff.overallSimilarity >= 0.7 ? 'bg-amber-500' : 'bg-red-500'"
                        :style="{ width: `${diff.overallSimilarity * 100}%` }"
                      />
                    </div>
                    <span class="text-sm font-bold" :class="diff.overallSimilarity >= 0.85 ? 'text-green-600' : diff.overallSimilarity >= 0.7 ? 'text-amber-600' : 'text-red-600'">
                      {{ (diff.overallSimilarity * 100).toFixed(0) }}%
                    </span>
                  </div>
                  <div class="text-xs text-[#3D2B1F] font-medium">{{ diff.suspectedVersionRelation }}</div>
                  <div class="mt-1 flex flex-wrap gap-1">
                    <span
                      v-for="item in diff.diffItems.slice(0, 3)"
                      :key="item.category"
                      class="px-1.5 py-0.5 text-[10px] rounded border"
                      :class="getSeverityColor(item.severity)"
                    >
                      {{ item.category }}
                    </span>
                    <span v-if="diff.diffItems.length > 3" class="px-1.5 py-0.5 text-[10px] text-[#8B7355]">
                      +{{ diff.diffItems.length - 3 }}
                    </span>
                  </div>
                </div>
              </div>
            </template>

            <template v-else>
              <div v-if="associations.length === 0" class="text-center py-8 text-[#8B7355] text-sm">
                <svg class="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                运行「全量分析」以发现同工异版关联
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="(assoc, index) in associations"
                  :key="assoc.schemeIds.join('-')"
                  @click="selectAssociationItem(assoc, index)"
                  :class="[
                    'p-3 rounded-lg border cursor-pointer transition-all',
                    selectedAssociation?.schemeIds.join('-') === assoc.schemeIds.join('-')
                      ? 'bg-[#2E5D3B]/5 border-[#2E5D3B] ring-1 ring-[#2E5D3B]/30'
                      : 'bg-white border-[#D4C4A8] hover:bg-[#F5F0E6]'
                  ]"
                >
                  <div class="flex items-center justify-between mb-2">
                    <span
                      class="px-2 py-0.5 text-[10px] font-medium rounded-full border"
                      :class="getConfidenceColor(assoc.confidence)"
                    >
                      {{ getConfidenceLabel(assoc.confidence) }}
                    </span>
                    <span class="text-sm font-bold text-[#2E5D3B]">
                      {{ (assoc.similarityScore * 100).toFixed(0) }}%
                    </span>
                  </div>
                  <div class="text-xs text-[#3D2B1F] font-medium mb-1">
                    {{ assoc.schemeNames.join('  ↔  ') }}
                  </div>
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="feature in assoc.sharedFeatures.slice(0, 3)"
                      :key="feature"
                      class="px-1.5 py-0.5 text-[10px] bg-green-50 text-green-700 rounded"
                    >
                      {{ feature }}
                    </span>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <div v-if="importedSchemes.length > 0" class="p-3 border-t border-[#D4C4A8]">
            <div class="text-xs font-medium text-[#3D2B1F] mb-2">已导入方案</div>
            <div class="space-y-1.5 max-h-32 overflow-y-auto">
              <div
                v-for="scheme in importedSchemes"
                :key="scheme.id"
                class="flex items-center justify-between px-2 py-1.5 bg-[#F5F0E6] rounded text-xs"
              >
                <span class="truncate flex-1">{{ scheme.researcher }} - {{ scheme.projectName }}</span>
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
          <template v-if="!selectedProfile && !selectedDiff && !selectedAssociation">
            <div class="flex-1 flex items-center justify-center">
              <div class="text-center text-[#8B7355]">
                <svg class="w-20 h-20 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <p class="text-sm">选择左侧列表中的分析结果查看详情</p>
                <p class="text-xs mt-1">或点击「全量分析」开始风格识别</p>
              </div>
            </div>
          </template>

          <div v-else class="flex-1 flex overflow-hidden">
            <div class="flex-1 overflow-y-auto p-4">
              <template v-if="selectedProfile">
                <div class="bg-white rounded-xl shadow-sm border border-[#D4C4A8] overflow-hidden">
                  <div class="px-5 py-4 border-b border-[#D4C4A8] bg-gradient-to-r from-[#1D4E89]/5 to-transparent flex items-center justify-between">
                    <div>
                      <h3 class="text-base font-bold text-[#3D2B1F]">{{ selectedProfile.schemeName }}</h3>
                      <p class="text-xs text-[#8B7355] mt-0.5">研究员：{{ selectedProfile.researcher }} · 分析时间：{{ formatDateTime(selectedProfile.generatedAt) }}</p>
                    </div>
                    <div class="flex items-center gap-1">
                      <button
                        @click="() => showAddEvidenceDialog('style_profile', selectedProfile.schemeId)"
                        class="px-3 py-1.5 text-xs border border-[#D4C4A8] text-[#3D2B1F] rounded-lg hover:bg-[#F5F0E6] transition-colors flex items-center gap-1"
                      >
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                        </svg>
                        添加依据
                      </button>
                    </div>
                  </div>

                  <div class="p-5 space-y-5">
                    <div class="bg-[#F5F0E6]/50 rounded-lg p-4 border border-[#D4C4A8]/50">
                      <div class="flex items-center justify-between mb-2">
                        <h4 class="text-sm font-semibold text-[#3D2B1F] flex items-center gap-2">
                          <svg class="w-4 h-4 text-[#1D4E89]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          综合风格描述
                        </h4>
                        <button
                          @click="() => showEditProfileFieldDialog('overallStyleDescription')"
                          class="text-xs text-[#1D4E89] hover:underline"
                        >
                          编辑
                        </button>
                      </div>
                      <p class="text-sm text-[#3D2B1F] leading-relaxed">{{ selectedProfile.overallStyleDescription }}</p>
                      <div class="flex flex-wrap gap-1.5 mt-3">
                        <span
                          v-for="tag in selectedProfile.styleTags"
                          :key="tag"
                          class="px-2 py-1 text-xs bg-[#1D4E89]/10 text-[#1D4E89] rounded-full"
                        >
                          {{ tag }}
                        </span>
                        <button
                          @click="() => showEditProfileFieldDialog('styleTags')"
                          class="px-2 py-1 text-xs border border-dashed border-[#D4C4A8] text-[#8B7355] rounded-full hover:bg-white"
                        >
                          + 编辑标签
                        </button>
                      </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                      <div class="bg-white rounded-lg p-4 border border-[#D4C4A8]">
                        <h4 class="text-sm font-semibold text-[#3D2B1F] mb-3 flex items-center gap-2">
                          <svg class="w-4 h-4 text-[#6B4E71]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                          </svg>
                          路径形态特征
                        </h4>
                        <div class="space-y-2 text-sm">
                          <div class="flex justify-between">
                            <span class="text-[#8B7355]">刀路总数</span>
                            <span class="font-medium text-[#3D2B1F]">{{ selectedProfile.pathMorphology.totalPaths }}</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-[#8B7355]">流畅曲线</span>
                            <span class="font-medium text-blue-600">{{ selectedProfile.pathMorphology.smoothPaths }}</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-[#8B7355]">刚劲折线</span>
                            <span class="font-medium text-red-600">{{ selectedProfile.pathMorphology.angularPaths }}</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-[#8B7355]">混合形态</span>
                            <span class="font-medium text-purple-600">{{ selectedProfile.pathMorphology.mixedPaths }}</span>
                          </div>
                          <div class="h-px bg-[#D4C4A8] my-2" />
                          <div class="flex justify-between">
                            <span class="text-[#8B7355]">平均路径长度</span>
                            <span class="font-medium text-[#3D2B1F]">{{ selectedProfile.pathMorphology.avgPathLength.toFixed(1) }} px</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-[#8B7355]">平均转向角</span>
                            <span class="font-medium text-[#3D2B1F]">{{ selectedProfile.pathMorphology.avgTurningAngle.toFixed(1) }}°</span>
                          </div>
                        </div>
                      </div>

                      <div class="bg-white rounded-lg p-4 border border-[#D4C4A8]">
                        <h4 class="text-sm font-semibold text-[#3D2B1F] mb-3 flex items-center gap-2">
                          <svg class="w-4 h-4 text-[#C41E3A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                          </svg>
                          刀痕宽度分布
                        </h4>
                        <div class="space-y-2 text-sm">
                          <div class="flex justify-between">
                            <span class="text-[#8B7355]">最小宽度</span>
                            <span class="font-medium text-[#3D2B1F]">{{ selectedProfile.widthDistribution.minWidth.toFixed(2) }} px</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-[#8B7355]">最大宽度</span>
                            <span class="font-medium text-[#3D2B1F]">{{ selectedProfile.widthDistribution.maxWidth.toFixed(2) }} px</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-[#8B7355]">平均宽度</span>
                            <span class="font-medium text-[#3D2B1F]">{{ selectedProfile.widthDistribution.avgWidth.toFixed(2) }} px</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-[#8B7355]">中位数</span>
                            <span class="font-medium text-[#3D2B1F]">{{ selectedProfile.widthDistribution.medianWidth.toFixed(2) }} px</span>
                          </div>
                          <div class="h-px bg-[#D4C4A8] my-2" />
                          <div class="flex justify-between">
                            <span class="text-[#8B7355]">标准差</span>
                            <span class="font-medium text-[#3D2B1F]">{{ selectedProfile.widthDistribution.stdDev.toFixed(3) }}</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-[#8B7355]">一致性评分</span>
                            <span class="font-bold" :class="selectedProfile.widthDistribution.consistencyScore > 0.8 ? 'text-green-600' : selectedProfile.widthDistribution.consistencyScore > 0.5 ? 'text-amber-600' : 'text-red-600'">
                              {{ (selectedProfile.widthDistribution.consistencyScore * 100).toFixed(0) }}%
                            </span>
                          </div>
                        </div>
                        <div class="mt-3">
                          <div class="text-xs text-[#8B7355] mb-1">宽度分布</div>
                          <div class="flex items-end gap-1 h-10">
                            <div
                              v-for="(bucket, idx) in selectedProfile.widthDistribution.widthHistogram"
                              :key="idx"
                              class="flex-1 bg-[#C41E3A]/60 rounded-t transition-all hover:bg-[#C41E3A]"
                              :style="{ height: `${bucket.count > 0 ? Math.max(10, (bucket.count / Math.max(...selectedProfile.widthDistribution.widthHistogram.map(b => b.count))) * 100) : 0}%` }"
                              :title="`${bucket.range}: ${bucket.count}条`"
                            />
                          </div>
                        </div>
                      </div>

                      <div class="bg-white rounded-lg p-4 border border-[#D4C4A8]">
                        <h4 class="text-sm font-semibold text-[#3D2B1F] mb-3 flex items-center gap-2">
                          <svg class="w-4 h-4 text-[#E8A838]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          起收刀习惯
                        </h4>
                        <div class="space-y-2 text-sm">
                          <div class="flex justify-between">
                            <span class="text-[#8B7355]">起刀标注数</span>
                            <span class="font-medium text-[#3D2B1F]">{{ selectedProfile.cutHabit.startMarkerCount }}</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-[#8B7355]">收刀标注数</span>
                            <span class="font-medium text-[#3D2B1F]">{{ selectedProfile.cutHabit.endMarkerCount }}</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-[#8B7355]">首尾标注覆盖率</span>
                            <span class="font-bold" :class="selectedProfile.cutHabit.startEndCoverageRate > 0.7 ? 'text-green-600' : 'text-amber-600'">
                              {{ (selectedProfile.cutHabit.startEndCoverageRate * 100).toFixed(0) }}%
                            </span>
                          </div>
                          <div class="h-px bg-[#D4C4A8] my-2" />
                          <div class="flex justify-between">
                            <span class="text-[#8B7355]">起刀风格</span>
                            <span class="font-medium text-[#3D2B1F]">{{ selectedProfile.cutHabit.startStyle === 'steady' ? '稳定' : selectedProfile.cutHabit.startStyle === 'gradual' ? '渐进' : '变化' }}</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-[#8B7355]">收刀风格</span>
                            <span class="font-medium text-[#3D2B1F]">{{ selectedProfile.cutHabit.endStyle === 'steady' ? '稳定' : selectedProfile.cutHabit.endStyle === 'gradual' ? '渐进' : '变化' }}</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-[#8B7355]">方向偏好</span>
                            <span class="font-medium text-[#1D4E89]">{{ selectedProfile.cutHabit.directionalPreference }}</span>
                          </div>
                        </div>
                      </div>

                      <div class="bg-white rounded-lg p-4 border border-[#D4C4A8]">
                        <h4 class="text-sm font-semibold text-[#3D2B1F] mb-3 flex items-center gap-2">
                          <svg class="w-4 h-4 text-[#D35400]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          修版密度特征
                        </h4>
                        <div class="space-y-2 text-sm">
                          <div class="flex justify-between">
                            <span class="text-[#8B7355]">修版标记总数</span>
                            <span class="font-medium text-[#3D2B1F]">{{ selectedProfile.revisionDensity.totalRevisionMarkers }}</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-[#8B7355]">单刀路平均修版</span>
                            <span class="font-medium text-[#3D2B1F]">{{ selectedProfile.revisionDensity.avgRevisionPerPath.toFixed(2) }}</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-[#8B7355]">单位面积密度</span>
                            <span class="font-medium text-[#3D2B1F]">{{ selectedProfile.revisionDensity.revisionDensityPerUnitArea.toFixed(3) }}/万px²</span>
                          </div>
                          <div class="h-px bg-[#D4C4A8] my-2" />
                          <div class="flex justify-between items-center">
                            <span class="text-[#8B7355]">修版密度等级</span>
                            <span
                              class="px-2 py-0.5 text-xs rounded-full font-medium"
                              :class="selectedProfile.revisionDensity.revisionDensityLevel === 'high' ? 'bg-red-100 text-red-700' : selectedProfile.revisionDensity.revisionDensityLevel === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'"
                            >
                              {{ selectedProfile.revisionDensity.revisionDensityLevel === 'high' ? '高' : selectedProfile.revisionDensity.revisionDensityLevel === 'medium' ? '中' : '低' }}
                            </span>
                          </div>
                          <div v-if="selectedProfile.revisionDensity.revisionHotspots.length > 0" class="pt-2">
                            <div class="text-xs text-[#8B7355] mb-1">修版热点（前5）</div>
                            <div class="flex flex-wrap gap-1">
                              <span
                                v-for="(hs, idx) in selectedProfile.revisionDensity.revisionHotspots.slice(0, 5)"
                                :key="idx"
                                class="px-2 py-0.5 text-[10px] bg-orange-50 text-orange-700 rounded border border-orange-200"
                              >
                                ({{ hs.x.toFixed(0) }},{{ hs.y.toFixed(0) }}):{{ hs.count }}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="bg-white rounded-lg p-4 border border-[#D4C4A8]">
                      <h4 class="text-sm font-semibold text-[#3D2B1F] mb-3 flex items-center gap-2">
                        <svg class="w-4 h-4 text-[#2E5D3B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        图层结构分析
                      </h4>
                      <div class="flex gap-4 mb-3 text-sm">
                        <div>
                          <span class="text-[#8B7355]">图层总数：</span>
                          <span class="font-medium text-[#3D2B1F]">{{ selectedProfile.layerStructure.totalLayers }}</span>
                        </div>
                        <div>
                          <span class="text-[#8B7355]">平均刀路/层：</span>
                          <span class="font-medium text-[#3D2B1F]">{{ selectedProfile.layerStructure.avgPathsPerLayer.toFixed(1) }}</span>
                        </div>
                        <div>
                          <span class="text-[#8B7355]">复杂度评分：</span>
                          <span class="font-bold" :class="selectedProfile.layerStructure.layerComplexityScore > 0.7 ? 'text-green-600' : 'text-amber-600'">
                            {{ (selectedProfile.layerStructure.layerComplexityScore * 100).toFixed(0) }}%
                          </span>
                        </div>
                      </div>
                      <div class="space-y-2">
                        <div
                          v-for="(layer, idx) in selectedProfile.layerStructure.layerDistribution"
                          :key="idx"
                          class="flex items-center gap-3"
                        >
                          <span class="text-xs text-[#8B7355] w-24 truncate">{{ layer.layerName }}</span>
                          <div class="flex-1 h-6 bg-gray-50 rounded overflow-hidden">
                            <div
                              class="h-full bg-gradient-to-r from-[#1D4E89] to-[#6B4E71] rounded flex items-center justify-end pr-2"
                              :style="{ width: `${Math.max(5, (layer.pathCount / Math.max(...selectedProfile.layerStructure.layerDistribution.map(l => l.pathCount), 1)) * 100)}%` }"
                            >
                              <span class="text-[10px] text-white font-medium">{{ layer.pathCount }}</span>
                            </div>
                          </div>
                          <span class="text-xs text-[#8B7355] w-20 text-right">{{ (layer.totalLength / 1000).toFixed(1) }} kpx</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>

              <template v-else-if="selectedDiff">
                <div class="space-y-4">
                  <div class="bg-white rounded-xl shadow-sm border border-[#D4C4A8] overflow-hidden">
                    <div class="px-5 py-4 border-b border-[#D4C4A8] bg-gradient-to-r from-[#C41E3A]/5 to-transparent flex items-center justify-between">
                      <div>
                        <div class="flex items-center gap-2 text-sm text-[#3D2B1F] font-bold">
                          <span>{{ selectedDiff.schemeAName }}</span>
                          <svg class="w-4 h-4 text-[#8B7355]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                          <span>{{ selectedDiff.schemeBName }}</span>
                        </div>
                        <div class="flex items-center gap-3 mt-1">
                          <div class="flex items-center gap-2">
                            <span class="text-xs text-[#8B7355]">相似度：</span>
                            <div class="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                class="h-full rounded-full"
                                :class="selectedDiff.overallSimilarity >= 0.85 ? 'bg-green-500' : selectedDiff.overallSimilarity >= 0.7 ? 'bg-amber-500' : 'bg-red-500'"
                                :style="{ width: `${selectedDiff.overallSimilarity * 100}%` }"
                              />
                            </div>
                            <span class="text-sm font-bold" :class="selectedDiff.overallSimilarity >= 0.85 ? 'text-green-600' : selectedDiff.overallSimilarity >= 0.7 ? 'text-amber-600' : 'text-red-600'">
                              {{ (selectedDiff.overallSimilarity * 100).toFixed(1) }}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <div class="flex items-center gap-1">
                        <button
                          @click="() => showAddEvidenceDialog('version_diff', `${selectedDiff.schemeAId}-${selectedDiff.schemeBId}`)"
                          class="px-3 py-1.5 text-xs border border-[#D4C4A8] text-[#3D2B1F] rounded-lg hover:bg-[#F5F0E6] transition-colors flex items-center gap-1"
                        >
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                          </svg>
                          添加依据
                        </button>
                      </div>
                    </div>

                    <div class="p-5 space-y-4">
                      <div class="bg-[#F5F0E6]/50 rounded-lg p-4 border border-[#D4C4A8]/50">
                        <div class="flex items-center justify-between mb-2">
                          <h4 class="text-sm font-semibold text-[#3D2B1F] flex items-center gap-2">
                            <svg class="w-4 h-4 text-[#C41E3A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            版次关系推断
                          </h4>
                          <button
                            @click="() => showEditDiffFieldDialog('suspectedVersionRelation')"
                            class="text-xs text-[#1D4E89] hover:underline"
                          >
                            编辑
                          </button>
                        </div>
                        <p class="text-sm font-medium text-[#C41E3A]">{{ selectedDiff.suspectedVersionRelation }}</p>
                      </div>

                      <div class="bg-white rounded-lg p-4 border border-[#D4C4A8]">
                        <div class="flex items-center justify-between mb-3">
                          <h4 class="text-sm font-semibold text-[#3D2B1F] flex items-center gap-2">
                            <svg class="w-4 h-4 text-[#1D4E89]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            差异摘要
                          </h4>
                          <button
                            @click="() => showEditDiffFieldDialog('summaryText')"
                            class="text-xs text-[#1D4E89] hover:underline"
                          >
                            编辑
                          </button>
                        </div>
                        <p class="text-sm text-[#3D2B1F] leading-relaxed">{{ selectedDiff.summaryText }}</p>
                      </div>

                      <div class="bg-white rounded-lg p-4 border border-[#D4C4A8]">
                        <h4 class="text-sm font-semibold text-[#3D2B1F] mb-3 flex items-center gap-2">
                          <svg class="w-4 h-4 text-[#D35400]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          详细差异项（{{ selectedDiff.diffItems.length }}项）
                        </h4>
                        <div class="space-y-2">
                          <div
                            v-for="(item, idx) in selectedDiff.diffItems"
                            :key="idx"
                            class="p-3 rounded-lg border"
                            :class="getSeverityColor(item.severity)"
                          >
                            <div class="flex items-start justify-between mb-1">
                              <span class="text-xs font-semibold">{{ item.category }}</span>
                              <span class="px-1.5 py-0.5 text-[10px] rounded-full bg-white/60">
                                {{ getSeverityLabel(item.severity) }}
                              </span>
                            </div>
                            <p class="text-xs leading-relaxed">{{ item.description }}</p>
                            <div v-if="item.quantitativeData" class="mt-2 flex flex-wrap gap-2">
                              <span
                                v-for="(val, key) in item.quantitativeData"
                                :key="key"
                                class="px-1.5 py-0.5 text-[10px] bg-white/80 rounded"
                              >
                                {{ key }}: {{ typeof val === 'number' ? val.toFixed(2) : val }}
                              </span>
                            </div>
                            <div class="mt-1.5 flex flex-wrap gap-1">
                              <span
                                v-for="feat in item.affectedFeatures"
                                :key="feat"
                                class="px-1.5 py-0.5 text-[10px] bg-white/50 rounded"
                              >
                                {{ feat }}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>

              <template v-else-if="selectedAssociation">
                <div class="bg-white rounded-xl shadow-sm border border-[#D4C4A8] overflow-hidden">
                  <div class="px-5 py-4 border-b border-[#D4C4A8] bg-gradient-to-r from-[#2E5D3B]/5 to-transparent flex items-center justify-between">
                    <div>
                      <div class="flex items-center gap-2 mb-1">
                        <span
                          class="px-2 py-0.5 text-xs font-medium rounded-full border"
                          :class="getConfidenceColor(selectedAssociation.confidence)"
                        >
                          {{ getConfidenceLabel(selectedAssociation.confidence) }}
                        </span>
                        <span class="text-sm font-bold text-[#2E5D3B]">
                          相似度 {{ (selectedAssociation.similarityScore * 100).toFixed(1) }}%
                        </span>
                      </div>
                      <div class="text-sm font-medium text-[#3D2B1F]">
                        {{ selectedAssociation.schemeNames.join('  ↔  ') }}
                      </div>
                    </div>
                    <div class="flex items-center gap-1">
                      <button
                        @click="() => showAddEvidenceDialog('association', selectedAssociation.schemeIds.join('-'))"
                        class="px-3 py-1.5 text-xs border border-[#D4C4A8] text-[#3D2B1F] rounded-lg hover:bg-[#F5F0E6] transition-colors flex items-center gap-1"
                      >
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                        </svg>
                        添加依据
                      </button>
                    </div>
                  </div>

                  <div class="p-5 space-y-4">
                    <div class="bg-[#F5F0E6]/50 rounded-lg p-4 border border-[#D4C4A8]/50">
                      <div class="flex items-center justify-between mb-2">
                        <h4 class="text-sm font-semibold text-[#3D2B1F] flex items-center gap-2">
                          <svg class="w-4 h-4 text-[#2E5D3B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          分析备注
                        </h4>
                        <button
                          @click="() => showEditAssociationFieldDialog('analysisNotes')"
                          class="text-xs text-[#1D4E89] hover:underline"
                        >
                          编辑
                        </button>
                      </div>
                      <p class="text-sm text-[#3D2B1F] leading-relaxed">{{ selectedAssociation.analysisNotes }}</p>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                      <div class="bg-white rounded-lg p-4 border border-[#D4C4A8]">
                        <div class="flex items-center justify-between mb-3">
                          <h4 class="text-sm font-semibold text-[#3D2B1F] flex items-center gap-2">
                            <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            共同特征
                          </h4>
                          <button
                            @click="() => showEditAssociationFieldDialog('sharedFeatures')"
                            class="text-xs text-[#1D4E89] hover:underline"
                          >
                            编辑
                          </button>
                        </div>
                        <div v-if="selectedAssociation.sharedFeatures.length === 0" class="text-xs text-[#8B7355]">
                          暂无共同特征标注
                        </div>
                        <div v-else class="flex flex-wrap gap-1.5">
                          <span
                            v-for="feat in selectedAssociation.sharedFeatures"
                            :key="feat"
                            class="px-2 py-1 text-xs bg-green-50 text-green-700 rounded-full border border-green-200"
                          >
                            {{ feat }}
                          </span>
                        </div>
                      </div>

                      <div class="bg-white rounded-lg p-4 border border-[#D4C4A8]">
                        <div class="flex items-center justify-between mb-3">
                          <h4 class="text-sm font-semibold text-[#3D2B1F] flex items-center gap-2">
                            <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            差异特征
                          </h4>
                          <button
                            @click="() => showEditAssociationFieldDialog('distinctiveFeatures')"
                            class="text-xs text-[#1D4E89] hover:underline"
                          >
                            编辑
                          </button>
                        </div>
                        <div v-if="selectedAssociation.distinctiveFeatures.length === 0" class="text-xs text-[#8B7355]">
                          暂无差异特征标注
                        </div>
                        <div v-else class="flex flex-wrap gap-1.5">
                          <span
                            v-for="feat in selectedAssociation.distinctiveFeatures"
                            :key="feat"
                            class="px-2 py-1 text-xs bg-red-50 text-red-700 rounded-full border border-red-200"
                          >
                            {{ feat }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </div>

            <div class="w-80 border-l border-[#D4C4A8] bg-white flex flex-col overflow-hidden">
              <div class="px-4 py-3 border-b border-[#D4C4A8] bg-[#F5F0E6]/30">
                <h4 class="text-xs font-semibold text-[#3D2B1F] flex items-center gap-2">
                  <svg class="w-4 h-4 text-[#1D4E89]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  判读依据
                  <span class="ml-auto px-1.5 py-0.5 text-[10px] rounded-full bg-[#1D4E89]/10 text-[#1D4E89]">
                    {{ currentEvidences.length }}
                  </span>
                </h4>
              </div>
              <div class="flex-1 overflow-y-auto p-3">
                <div v-if="!selectedProfile && !selectedDiff && !selectedAssociation" class="text-center py-6 text-[#8B7355] text-xs">
                  先选择左侧分析项
                </div>
                <div v-else-if="currentEvidences.length === 0" class="text-center py-6 text-[#8B7355] text-xs">
                  暂无判读依据，点击「添加依据」按钮添加
                </div>
                <div v-else class="space-y-2">
                  <div
                    v-for="ev in currentEvidences"
                    :key="ev.id"
                    class="p-3 bg-[#F5F0E6]/50 rounded-lg border border-[#D4C4A8]/50"
                  >
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-[10px] text-[#8B7355]">{{ ev.createdBy }}</span>
                      <span class="text-[10px] text-[#8B7355]">{{ formatDateTime(ev.createdAt) }}</span>
                    </div>
                    <p class="text-xs text-[#3D2B1F] leading-relaxed">{{ ev.content }}</p>
                  </div>
                </div>
              </div>

              <div class="border-t border-[#D4C4A8]">
                <div class="px-4 py-3 bg-[#F5F0E6]/30">
                  <h4 class="text-xs font-semibold text-[#3D2B1F] flex items-center gap-2">
                    <svg class="w-4 h-4 text-[#6B4E71]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    修订记录
                    <span class="ml-auto px-1.5 py-0.5 text-[10px] rounded-full bg-[#6B4E71]/10 text-[#6B4E71]">
                      {{ currentRevisions.length }}
                    </span>
                  </h4>
                </div>
                <div class="overflow-y-auto max-h-60 p-3">
                  <div v-if="!selectedProfile && !selectedDiff && !selectedAssociation" class="text-center py-4 text-[#8B7355] text-xs">
                    先选择左侧分析项
                  </div>
                  <div v-else-if="currentRevisions.length === 0" class="text-center py-4 text-[#8B7355] text-xs">
                    暂无修订记录
                  </div>
                  <div v-else class="space-y-2">
                    <div
                      v-for="rev in currentRevisions"
                      :key="rev.id"
                      class="p-2.5 bg-purple-50/50 rounded-lg border border-purple-100"
                    >
                      <div class="flex items-center justify-between mb-1">
                        <span class="text-[10px] font-medium text-[#6B4E71]">{{ rev.fieldName }}</span>
                        <span class="text-[10px] text-[#8B7355]">{{ formatDateTime(rev.revisedAt) }}</span>
                      </div>
                      <div class="text-[10px] space-y-0.5">
                        <div class="flex gap-1">
                          <span class="text-[#8B7355] flex-shrink-0">原值：</span>
                          <span class="text-red-600 line-clamp-2">{{ rev.originalValue || '(空)' }}</span>
                        </div>
                        <div class="flex gap-1">
                          <span class="text-[#8B7355] flex-shrink-0">新值：</span>
                          <span class="text-green-600 line-clamp-2">{{ rev.revisedValue || '(空)' }}</span>
                        </div>
                        <div class="pt-1">
                          <span class="text-[#8B7355]">修订人：{{ rev.revisedBy }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="px-6 py-3 border-t border-[#D4C4A8] flex items-center justify-between bg-[#F5F0E6]/50">
        <div class="text-sm text-[#8B7355]">
          <span v-if="styleProfiles.length > 0">
            已分析 {{ styleProfiles.length }} 个方案 · {{ versionDiffs.length }} 组版次对比 · {{ associations.length }} 组同工异版关联
          </span>
          <span v-else>等待分析...</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            v-if="styleProfiles.length > 0"
            @click="showExportReportDialog"
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

