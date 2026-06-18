<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useProjectStore } from '../../stores/projectStore'
import { useCollaborationStore } from '../../stores/collaborationStore'
import { useBusinessRules } from '../../composables/useBusinessRules'
import { useMessage, useDialog, NInput, NBadge } from 'naive-ui'
import CompareDialog from '../dialog/CompareDialog.vue'
import DiffAnalysisDialog from '../dialog/DiffAnalysisDialog.vue'
import CollaborationDialog from '../dialog/CollaborationDialog.vue'

const projectStore = useProjectStore()
const collaborationStore = useCollaborationStore()
const businessRules = useBusinessRules()
const message = useMessage()
const dialog = useDialog()

const imageInputRef = ref<HTMLInputElement | null>(null)
const schemeInputRef = ref<HTMLInputElement | null>(null)
const compareInputRef = ref<HTMLInputElement | null>(null)
const researcherName = ref(projectStore.researcher)
const showCompareDialog = ref(false)
const showDiffDialog = ref(false)
const showCollaborationDialog = ref(false)

const openCommentsCount = computed(() => collaborationStore.openComments.length)

const currentScheme = computed(() => projectStore.currentScheme)
const isCompleted = computed(() => projectStore.isCompleted)
const hasImage = computed(() => projectStore.hasImage)

function triggerImageImport() {
  imageInputRef.value?.click()
}

async function handleImageImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    await projectStore.importImage(file)
    message.success(`已导入图像：${file.name}`)
  } catch (err: any) {
    message.error(err.message || '导入图像失败')
  } finally {
    input.value = ''
  }
}

function triggerSchemeImport() {
  schemeInputRef.value?.click()
}

async function handleSchemeImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    const result = await projectStore.importScheme(file)
    if (!result.valid) {
      result.errors.forEach((err) => message.error(err))
      return
    }
    message.success(`已导入方案：${file.name}`)
  } catch (err: any) {
    message.error(err.message || '导入方案失败')
  } finally {
    input.value = ''
  }
}

function exportScheme() {
  if (!hasImage.value) {
    message.warning('请先导入图像或方案')
    return
  }
  projectStore.exportScheme()
  message.success('方案已导出')
}

function handleMarkComplete() {
  if (isCompleted.value) {
    businessRules.tryUnmarkComplete()
    return
  }
  businessRules.tryMarkComplete()
}

function showResearcherDialog() {
  const d = dialog.create({
    title: '设置研究员名称',
    content: () =>
      h(NInput, {
        value: researcherName.value,
        placeholder: '请输入研究员名称',
        onUpdateValue: (v: string) => {
          researcherName.value = v
        }
      }),
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      projectStore.setResearcher(researcherName.value)
      message.success('研究员名称已更新')
    }
  })
}

function openCompareDialog() {
  showCompareDialog.value = true
}

function openDiffDialog() {
  showDiffDialog.value = true
}

function openCollaborationDialog() {
  showCollaborationDialog.value = true
}
</script>

<template>
  <header class="header-bar h-16 bg-white/95 backdrop-blur-md border-b border-[#D4C4A8] px-6 flex items-center justify-between shadow-sm">
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-gradient-to-br from-[#C41E3A] to-[#8B7355] rounded-xl flex items-center justify-center shadow-md">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </div>
        <div>
          <h1 class="text-lg font-bold text-[#3D2B1F]">古籍木刻刀路复原系统</h1>
          <p v-if="currentScheme" class="text-xs text-[#8B7355]">
            {{ currentScheme.projectName }} · {{ currentScheme.researcher }}
          </p>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <input
        ref="imageInputRef"
        type="file"
        accept="image/*"
        class="hidden"
        @change="handleImageImport"
      />
      <input
        ref="schemeInputRef"
        type="file"
        accept=".json"
        class="hidden"
        @change="handleSchemeImport"
      />
      <input
        ref="compareInputRef"
        type="file"
        accept=".json"
        class="hidden"
      />

      <button
        @click="triggerImageImport"
        class="px-4 py-2 bg-[#1D4E89] text-white rounded-lg hover:bg-[#1a4374] transition-colors text-sm font-medium flex items-center gap-2 shadow-sm"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        导入图像
      </button>

      <button
        @click="triggerSchemeImport"
        :disabled="!hasImage"
        class="px-4 py-2 bg-white border border-[#D4C4A8] text-[#3D2B1F] rounded-lg hover:bg-[#F5F0E6] transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        导入方案
      </button>

      <button
        @click="exportScheme"
        :disabled="!hasImage"
        class="px-4 py-2 bg-white border border-[#D4C4A8] text-[#3D2B1F] rounded-lg hover:bg-[#F5F0E6] transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        导出方案
      </button>

      <button
        @click="openCompareDialog"
        :disabled="!hasImage"
        class="px-4 py-2 bg-white border border-[#D4C4A8] text-[#3D2B1F] rounded-lg hover:bg-[#F5F0E6] transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        方案对比
      </button>

      <button
        @click="openDiffDialog"
        :disabled="!hasImage"
        class="px-4 py-2 bg-white border border-[#D4C4A8] text-[#3D2B1F] rounded-lg hover:bg-[#F5F0E6] transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
        差异分析
      </button>

      <button
        @click="openCollaborationDialog"
        :disabled="!hasImage"
        class="px-4 py-2 bg-white border border-[#D4C4A8] text-[#3D2B1F] rounded-lg hover:bg-[#F5F0E6] transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed relative"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        协同复核
        <n-badge
          v-if="openCommentsCount > 0"
          :value="openCommentsCount"
          type="warning"
          size="small"
          class="absolute -top-1 -right-1"
        />
      </button>

      <div class="w-px h-6 bg-[#D4C4A8] mx-1" />

      <button
        @click="showResearcherDialog"
        class="p-2 text-[#8B7355] hover:text-[#3D2B1F] hover:bg-[#F5F0E6] rounded-lg transition-colors"
        title="设置研究员"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </button>

      <button
        @click="handleMarkComplete"
        :disabled="!hasImage"
        :class="[
          'px-4 py-2 rounded-lg transition-colors text-sm font-medium flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed',
          isCompleted
            ? 'bg-[#2E5D3B] text-white hover:bg-[#284f32]'
            : 'bg-[#C41E3A] text-white hover:bg-[#a81a31]'
        ]"
      >
        <svg v-if="isCompleted" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {{ isCompleted ? '已完成' : '标记完成' }}
      </button>
    </div>
  </header>

  <CompareDialog v-model:visible="showCompareDialog" />
  <DiffAnalysisDialog v-model:visible="showDiffDialog" />
  <CollaborationDialog v-model:visible="showCollaborationDialog" />
</template>
