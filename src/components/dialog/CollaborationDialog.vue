<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useProjectStore } from '../../stores/projectStore'
import { useCollaborationStore } from '../../stores/collaborationStore'
import { useLayerStore } from '../../stores/layerStore'
import { useBladePathStore } from '../../stores/bladePathStore'
import { useCanvasStore } from '../../stores/canvasStore'
import { useMessage, useDialog } from 'naive-ui'
import { validatePublish, calculatePublishStats } from '../../utils/publishValidation'
import { hasConflicts } from '../../utils/diffAnalysis'
import { formatLength } from '../../utils/geometry'
import type { ReviewComment, SchemeVersion } from '../../types'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const projectStore = useProjectStore()
const collaborationStore = useCollaborationStore()
const layerStore = useLayerStore()
const bladePathStore = useBladePathStore()
const message = useMessage()
const dialog = useDialog()

const activeTab = ref<'versions' | 'comments' | 'publish'>('versions')
const versionName = ref('')
const versionDesc = ref('')
const versionTag = ref('')
const versionTags = ref<string[]>([])
const newComment = ref('')
const replyingTo = ref<string | null>(null)
const replyContent = ref('')
const showVersionForm = ref(false)
const reviewerName = ref(collaborationStore.currentReviewer)

const currentScheme = computed(() => projectStore.currentScheme)
const versions = computed(() => collaborationStore.versionsByScheme)
const openComments = computed(() => collaborationStore.openComments)
const pendingMerges = computed(() => collaborationStore.pendingMergeProposals)

const publishStats = computed(() => {
  if (!currentScheme.value) return null
  return calculatePublishStats(currentScheme.value, layerStore.layers)
})

const publishValidation = computed(() => {
  if (!currentScheme.value) return null
  return validatePublish(currentScheme.value, layerStore.layers)
})

const canPublish = computed(() => {
  return publishValidation.value?.valid ?? false
})

const canvasStore = useCanvasStore()

const selectedPathId = computed(() => {
  return canvasStore.selectedPathId
})

const selectedPath = computed(() => {
  if (!selectedPathId.value) return null
  return bladePathStore.getBladePathById(selectedPathId.value)
})

watch(
  () => props.visible,
  (val) => {
    if (val) {
      reviewerName.value = collaborationStore.currentReviewer
    }
  }
)

function addVersionTag() {
  if (!versionTag.value.trim()) return
  if (versionTags.value.includes(versionTag.value.trim())) {
    message.warning('标签已存在')
    return
  }
  versionTags.value.push(versionTag.value.trim())
  versionTag.value = ''
}

function removeVersionTag(tag: string) {
  const idx = versionTags.value.indexOf(tag)
  if (idx !== -1) versionTags.value.splice(idx, 1)
}

function saveVersion() {
  if (!versionName.value.trim()) {
    message.warning('请输入版本名称')
    return
  }

  try {
    const version = collaborationStore.createVersion(
      versionName.value.trim(),
      versionDesc.value.trim(),
      [...versionTags.value]
    )
    message.success(`版本 v${version.versionNumber} 已保存`)
    versionName.value = ''
    versionDesc.value = ''
    versionTags.value = []
    showVersionForm.value = false
  } catch (err: any) {
    message.error(err.message || '保存失败')
  }
}

function restoreVersion(version: SchemeVersion) {
  dialog.warning({
    title: '确认恢复版本',
    content: `确定要恢复到版本「${version.name}」吗？当前未保存的修改将被覆盖。`,
    positiveText: '恢复',
    negativeText: '取消',
    positiveButtonProps: { type: 'warning' },
    onPositiveClick: () => {
      const success = collaborationStore.restoreVersion(version.id)
      if (success) {
        message.success(`已恢复到版本 v${version.versionNumber}`)
      } else {
        message.error('恢复失败')
      }
    }
  })
}

function deleteVersion(version: SchemeVersion) {
  dialog.warning({
    title: '确认删除版本',
    content: `确定要删除版本「${version.name}」吗？此操作不可撤销。`,
    positiveText: '删除',
    negativeText: '取消',
    positiveButtonProps: { type: 'error' },
    onPositiveClick: () => {
      const success = collaborationStore.deleteVersion(version.id)
      if (success) {
        message.success('版本已删除')
      } else {
        message.error('删除失败')
      }
    }
  })
}

function submitComment() {
  if (!newComment.value.trim()) {
    message.warning('请输入评论内容')
    return
  }

  try {
    collaborationStore.addComment(
      newComment.value.trim(),
      selectedPath.value?.id,
      selectedPath.value?.pathNumber
    )
    message.success('评论已提交')
    newComment.value = ''
  } catch (err: any) {
    message.error(err.message || '提交失败')
  }
}

function submitReply(commentId: string) {
  if (!replyContent.value.trim()) {
    message.warning('请输入回复内容')
    return
  }

  const reply = collaborationStore.replyToComment(commentId, replyContent.value.trim())
  if (reply) {
    message.success('回复已提交')
    replyContent.value = ''
    replyingTo.value = null
  } else {
    message.error('回复失败')
  }
}

function resolveComment(commentId: string) {
  const success = collaborationStore.resolveComment(commentId)
  if (success) {
    message.success('评论已标记为已解决')
  } else {
    message.error('操作失败')
  }
}

function rejectComment(commentId: string) {
  const success = collaborationStore.rejectComment(commentId)
  if (success) {
    message.success('评论已标记为已拒绝')
  } else {
    message.error('操作失败')
  }
}

function updateReviewer() {
  if (!reviewerName.value.trim()) {
    message.warning('请输入复核员名称')
    return
  }
  collaborationStore.setCurrentReviewer(reviewerName.value.trim())
  message.success('复核员信息已更新')
}

function publishScheme() {
  if (!canPublish.value) {
    message.error('存在未解决的问题，无法发布')
    return
  }

  dialog.warning({
    title: '确认发布',
    content: `确定要发布当前方案吗？发布后将生成最终版本。`,
    positiveText: '发布',
    negativeText: '取消',
    positiveButtonProps: { type: 'primary' },
    onPositiveClick: () => {
      const result = projectStore.markAsComplete()
      if (result.valid) {
        collaborationStore.createVersion(
          '正式发布版',
          '最终发布版本',
          ['发布', '正式版']
        )
        message.success('方案已成功发布！')
        emit('update:visible', false)
      } else {
        result.errors.forEach((err) => message.error(err))
      }
    }
  })
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'open':
      return 'bg-amber-100 text-amber-700'
    case 'resolved':
      return 'bg-green-100 text-green-700'
    case 'rejected':
      return 'bg-gray-100 text-gray-500'
    default:
      return 'bg-gray-100 text-gray-500'
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'open':
      return '待处理'
    case 'resolved':
      return '已解决'
    case 'rejected':
      return '已拒绝'
    default:
      return status
  }
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
    <div class="bg-white rounded-2xl shadow-2xl w-[80vw] h-[85vh] max-w-[1200px] overflow-hidden flex flex-col">
      <div class="px-6 py-4 border-b border-[#D4C4A8] flex items-center justify-between bg-[#F5F0E6]/50">
        <div>
          <h2 class="text-lg font-bold text-[#3D2B1F] flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            协同复核与版本管理
          </h2>
          <p class="text-xs text-[#8B7355] mt-1">管理方案版本、处理复核意见、控制发布流程</p>
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

      <div class="flex border-b border-[#D4C4A8] bg-[#F5F0E6]/30">
        <button
          v-for="tab in [
            { key: 'versions', label: '版本历史', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
            { key: 'comments', label: '复核意见', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
            { key: 'publish', label: '合并发布', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' }
          ]"
          :key="tab.key"
          @click="activeTab = tab.key as any"
          :class="[
            'flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2',
            activeTab === tab.key
              ? 'text-[#1D4E89] border-[#1D4E89] bg-white'
              : 'text-[#8B7355] border-transparent hover:text-[#3D2B1F] hover:bg-white/50'
          ]"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="tab.icon" />
          </svg>
          {{ tab.label }}
          <span
            v-if="tab.key === 'comments' && openComments.length > 0"
            class="px-1.5 py-0.5 text-[10px] bg-amber-500 text-white rounded-full"
          >
            {{ openComments.length }}
          </span>
        </button>
      </div>

      <div class="flex-1 overflow-hidden flex">
        <div class="flex-1 overflow-y-auto p-4">
          <div v-if="activeTab === 'versions'">
            <div v-if="!showVersionForm" class="mb-4">
              <button
                @click="showVersionForm = true"
                :disabled="!currentScheme"
                class="px-4 py-2 bg-[#1D4E89] text-white rounded-lg hover:bg-[#1a4374] transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                保存新版本
              </button>
            </div>

            <div v-else class="mb-4 p-4 bg-[#F5F0E6] rounded-xl border border-[#D4C4A8]">
              <h3 class="text-sm font-medium text-[#3D2B1F] mb-3">创建新版本</h3>
              <div class="space-y-3">
                <div>
                  <label class="block text-xs font-medium text-[#3D2B1F] mb-1">版本名称 *</label>
                  <input
                    v-model="versionName"
                    placeholder="如：初稿、修订版1、最终版"
                    class="w-full px-3 py-2 border border-[#D4C4A8] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4E89]/30"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-[#3D2B1F] mb-1">版本描述</label>
                  <textarea
                    v-model="versionDesc"
                    placeholder="描述此版本的主要变更..."
                    rows="2"
                    class="w-full px-3 py-2 border border-[#D4C4A8] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4E89]/30 resize-none"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-[#3D2B1F] mb-1">标签</label>
                  <div class="flex items-center gap-2">
                    <input
                      v-model="versionTag"
                      @keyup.enter="addVersionTag"
                      placeholder="输入标签后回车添加"
                      class="flex-1 px-3 py-2 border border-[#D4C4A8] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4E89]/30"
                    />
                    <button
                      @click="addVersionTag"
                      class="px-3 py-2 bg-[#F5F0E6] border border-[#D4C4A8] rounded-lg text-sm hover:bg-white transition-colors"
                    >
                      添加
                    </button>
                  </div>
                  <div v-if="versionTags.length > 0" class="flex flex-wrap gap-1.5 mt-2">
                    <span
                      v-for="tag in versionTags"
                      :key="tag"
                      class="px-2 py-0.5 text-xs bg-[#1D4E89]/10 text-[#1D4E89] rounded-full flex items-center gap-1"
                    >
                      {{ tag }}
                      <button @click="removeVersionTag(tag)" class="hover:text-[#C41E3A]">×</button>
                    </span>
                  </div>
                </div>
                <div class="flex items-center gap-2 pt-2">
                  <button
                    @click="saveVersion"
                    class="px-4 py-2 bg-[#1D4E89] text-white rounded-lg hover:bg-[#1a4374] transition-colors text-sm font-medium"
                  >
                    保存版本
                  </button>
                  <button
                    @click="showVersionForm = false; versionName = ''; versionDesc = ''; versionTags = []"
                    class="px-4 py-2 border border-[#D4C4A8] text-[#8B7355] rounded-lg hover:bg-[#F5F0E6] transition-colors text-sm"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>

            <div v-if="versions.length === 0" class="text-center py-12 text-[#8B7355]">
              <svg class="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p class="text-sm">暂无版本历史</p>
              <p class="text-xs mt-1">点击「保存新版本」记录当前方案状态</p>
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="version in versions"
                :key="version.id"
                class="p-4 bg-white border border-[#D4C4A8] rounded-xl hover:shadow-md transition-shadow"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <span class="px-2 py-0.5 text-xs font-bold bg-[#1D4E89] text-white rounded">
                        v{{ version.versionNumber }}
                      </span>
                      <span class="font-medium text-[#3D2B1F]">{{ version.name }}</span>
                      <span class="text-xs text-[#8B7355]">{{ version.researcher }}</span>
                      <span class="text-xs text-[#8B7355]">{{ formatDate(version.createdAt) }}</span>
                    </div>
                    <p v-if="version.description" class="text-sm text-[#8B7355] mt-2">{{ version.description }}</p>
                    <div v-if="version.tags.length > 0" class="flex flex-wrap gap-1 mt-2">
                      <span
                        v-for="tag in version.tags"
                        :key="tag"
                        class="px-1.5 py-0.5 text-[10px] bg-[#F5F0E6] text-[#8B7355] rounded"
                      >
                        {{ tag }}
                      </span>
                    </div>
                    <div class="flex items-center gap-4 mt-2 text-xs text-[#8B7355]">
                      <span>{{ version.snapshot.bladePaths.length }} 条刀路</span>
                      <span>{{ formatLength(version.snapshot.bladePaths.reduce((s, p) => s + p.length, 0)) }}</span>
                      <span>{{ version.snapshot.layers.length }} 个图层</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-1">
                    <button
                      @click="restoreVersion(version)"
                      class="px-3 py-1.5 text-xs text-[#1D4E89] hover:bg-[#1D4E89]/5 rounded transition-colors"
                    >
                      恢复
                    </button>
                    <button
                      @click="deleteVersion(version)"
                      class="px-3 py-1.5 text-xs text-[#C41E3A] hover:bg-red-50 rounded transition-colors"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'comments'">
            <div class="mb-4 p-4 bg-[#F5F0E6] rounded-xl border border-[#D4C4A8]">
              <div class="flex items-center gap-3 mb-3">
                <div class="flex-1">
                  <label class="block text-xs font-medium text-[#3D2B1F] mb-1">复核员</label>
                  <div class="flex items-center gap-2">
                    <input
                      v-model="reviewerName"
                      class="flex-1 px-3 py-1.5 border border-[#D4C4A8] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4E89]/30"
                    />
                    <button
                      @click="updateReviewer"
                      class="px-3 py-1.5 bg-[#1D4E89] text-white rounded-lg text-xs hover:bg-[#1a4374] transition-colors"
                    >
                      更新
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label class="block text-xs font-medium text-[#3D2B1F] mb-1">
                  复核意见
                  <span v-if="selectedPath" class="text-[#8B7355] font-normal ml-2">
                    （针对刀路 {{ selectedPath.pathNumber }}）
                  </span>
                </label>
                <textarea
                  v-model="newComment"
                  placeholder="输入复核意见..."
                  rows="3"
                  class="w-full px-3 py-2 border border-[#D4C4A8] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4E89]/30 resize-none"
                />
                <div class="flex items-center justify-between mt-2">
                  <span class="text-xs text-[#8B7355]">
                    {{ selectedPath ? '将关联到当前选中的刀路' : '全局意见，不关联具体刀路' }}
                  </span>
                  <button
                    @click="submitComment"
                    :disabled="!currentScheme"
                    class="px-4 py-2 bg-[#1D4E89] text-white rounded-lg hover:bg-[#1a4374] transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    提交意见
                  </button>
                </div>
              </div>
            </div>

            <div v-if="openComments.length === 0" class="text-center py-12 text-[#8B7355]">
              <svg class="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p class="text-sm">暂无待处理的复核意见</p>
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="comment in openComments"
                :key="comment.id"
                class="p-4 bg-white border border-[#D4C4A8] rounded-xl"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="font-medium text-sm text-[#3D2B1F]">{{ comment.author }}</span>
                      <span v-if="comment.pathNumber" class="px-1.5 py-0.5 text-[10px] bg-[#F5F0E6] text-[#8B7355] rounded">
                        刀路 {{ comment.pathNumber }}
                      </span>
                      <span :class="['px-1.5 py-0.5 text-[10px] rounded', getStatusColor(comment.status)]">
                        {{ getStatusLabel(comment.status) }}
                      </span>
                      <span class="text-xs text-[#8B7355]">{{ formatDate(comment.createdAt) }}</span>
                    </div>
                    <p class="text-sm text-[#3D2B1F]">{{ comment.content }}</p>

                    <div v-if="comment.replies.length > 0" class="mt-3 pl-4 border-l-2 border-[#D4C4A8] space-y-3">
                      <div v-for="reply in comment.replies" :key="reply.id">
                        <div class="flex items-center gap-2 mb-1">
                          <span class="font-medium text-xs text-[#3D2B1F]">{{ reply.author }}</span>
                          <span class="text-[10px] text-[#8B7355]">{{ formatDate(reply.createdAt) }}</span>
                        </div>
                        <p class="text-xs text-[#8B7355]">{{ reply.content }}</p>
                      </div>
                    </div>

                    <div v-if="replyingTo === comment.id" class="mt-3">
                      <textarea
                        v-model="replyContent"
                        placeholder="输入回复..."
                        rows="2"
                        class="w-full px-3 py-2 border border-[#D4C4A8] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4E89]/30 resize-none"
                      />
                      <div class="flex items-center gap-2 mt-2">
                        <button
                          @click="submitReply(comment.id)"
                          class="px-3 py-1.5 bg-[#1D4E89] text-white rounded-lg text-xs hover:bg-[#1a4374] transition-colors"
                        >
                          发送回复
                        </button>
                        <button
                          @click="replyingTo = null; replyContent = ''"
                          class="px-3 py-1.5 text-xs text-[#8B7355] hover:text-[#3D2B1F] transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  </div>
                  <div class="flex flex-col items-end gap-1 ml-4">
                    <button
                      @click="resolveComment(comment.id)"
                      class="px-3 py-1.5 text-xs text-green-600 hover:bg-green-50 rounded transition-colors"
                    >
                      已解决
                    </button>
                    <button
                      @click="rejectComment(comment.id)"
                      class="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 rounded transition-colors"
                    >
                      拒绝
                    </button>
                    <button
                      @click="replyingTo = comment.id"
                      class="px-3 py-1.5 text-xs text-[#1D4E89] hover:bg-[#1D4E89]/5 rounded transition-colors"
                    >
                      回复
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'publish'">
            <div v-if="publishStats" class="mb-4">
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div class="p-3 bg-white border border-[#D4C4A8] rounded-xl">
                  <div class="text-xs text-[#8B7355]">总刀路数</div>
                  <div class="text-xl font-bold text-[#3D2B1F]">{{ publishStats.totalPaths }}</div>
                  <div class="text-[10px] text-[#8B7355]">
                    可见 {{ publishStats.visiblePaths }} / 隐藏 {{ publishStats.hiddenPaths }}
                  </div>
                </div>
                <div class="p-3 bg-white border border-[#D4C4A8] rounded-xl">
                  <div class="text-xs text-[#8B7355]">复核进度</div>
                  <div class="text-xl font-bold text-[#3D2B1F]">{{ publishStats.reviewProgress }}%</div>
                  <div class="text-[10px] text-[#8B7355]">
                    {{ publishStats.reviewedPaths }} / {{ publishStats.visiblePaths }} 已复核
                  </div>
                </div>
                <div class="p-3 bg-white border border-[#D4C4A8] rounded-xl">
                  <div class="text-xs text-[#8B7355]">可见总长度</div>
                  <div class="text-xl font-bold text-[#1D4E89]">{{ formatLength(publishStats.visibleLength) }}</div>
                  <div class="text-[10px] text-[#8B7355]">
                    排除隐藏 {{ formatLength(publishStats.hiddenLength) }}
                  </div>
                </div>
                <div class="p-3 bg-white border border-[#D4C4A8] rounded-xl">
                  <div class="text-xs text-[#8B7355]">未复核刀路</div>
                  <div :class="['text-xl font-bold', publishStats.unreviewedPaths > 0 ? 'text-[#C41E3A]' : 'text-green-600']">
                    {{ publishStats.unreviewedPaths }}
                  </div>
                  <div class="text-[10px] text-[#8B7355]">
                    {{ publishStats.unreviewedPaths > 0 ? '需要完成复核' : '全部已复核' }}
                  </div>
                </div>
              </div>

              <div class="h-2 bg-[#F5F0E6] rounded-full overflow-hidden mb-4">
                <div
                  class="h-full transition-all duration-500"
                  :class="publishStats.reviewProgress === 100 ? 'bg-green-500' : 'bg-[#1D4E89]'"
                  :style="{ width: `${publishStats.reviewProgress}%` }"
                />
              </div>
            </div>

            <div v-if="publishValidation" class="space-y-3 mb-4">
              <div v-if="publishValidation.errors.length > 0">
                <h4 class="text-xs font-medium text-[#C41E3A] mb-2 flex items-center gap-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  发布受阻（{{ publishValidation.errors.length }} 项）
                </h4>
                <div class="space-y-1.5">
                  <div
                    v-for="(err, idx) in publishValidation.errors"
                    :key="idx"
                    class="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2"
                  >
                    <span class="text-red-500 mt-0.5">✕</span>
                    <span>{{ err }}</span>
                  </div>
                </div>
              </div>

              <div v-if="publishValidation.warnings.length > 0">
                <h4 class="text-xs font-medium text-amber-700 mb-2 flex items-center gap-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  注意事项（{{ publishValidation.warnings.length }} 项）
                </h4>
                <div class="space-y-1.5">
                  <div
                    v-for="(warn, idx) in publishValidation.warnings"
                    :key="idx"
                    class="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-start gap-2"
                  >
                    <span class="text-amber-500 mt-0.5">⚠</span>
                    <span>{{ warn }}</span>
                  </div>
                </div>
              </div>

              <div v-if="publishValidation.valid" class="p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 flex items-center gap-2">
                <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>所有检查项已通过，可以发布</span>
              </div>
            </div>

            <div class="p-4 bg-[#F5F0E6] rounded-xl border border-[#D4C4A8]">
              <h4 class="text-sm font-medium text-[#3D2B1F] mb-3">发布规则说明</h4>
              <ul class="space-y-2 text-xs text-[#8B7355]">
                <li class="flex items-start gap-2">
                  <span class="text-green-500 mt-0.5">✓</span>
                  <span><strong class="text-[#3D2B1F]">隐藏图层不参与统计：</strong>发布时自动忽略隐藏图层的刀路，仅统计可见图层的数据</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-[#C41E3A] mt-0.5">✕</span>
                  <span><strong class="text-[#3D2B1F]">未复核刀路禁止发布：</strong>所有可见刀路必须标记为「已复核」才能发布</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-[#C41E3A] mt-0.5">✕</span>
                  <span><strong class="text-[#3D2B1F]">冲突方案禁止合并：</strong>存在编号冲突或严重差异的方案不允许一键合并</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-[#E8A838] mt-0.5">⚠</span>
                  <span><strong class="text-[#3D2B1F]">发布后版本锁定：</strong>发布将自动保存一个版本快照，便于后续追溯</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div class="px-6 py-3 border-t border-[#D4C4A8] flex items-center justify-between bg-[#F5F0E6]/50">
        <div class="text-sm text-[#8B7355]">
          <span v-if="activeTab === 'versions'">{{ versions.length }} 个历史版本</span>
          <span v-else-if="activeTab === 'comments'">{{ openComments.length }} 条待处理意见</span>
          <span v-else-if="activeTab === 'publish'">
            {{ publishStats ? `复核进度 ${publishStats.reviewProgress}%` : '等待加载...' }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <button
            v-if="activeTab === 'publish'"
            @click="publishScheme"
            :disabled="!canPublish"
            class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            发布方案
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
