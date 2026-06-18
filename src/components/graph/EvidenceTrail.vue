<script setup lang="ts">
import { computed } from 'vue'
import type { JudgmentEvidence, ManualRevision } from '../../types'

interface TimelineItem {
  id: string
  type: 'evidence' | 'revision'
  data: JudgmentEvidence | ManualRevision
  timestamp: number
}

const props = defineProps<{
  targetType: 'style_profile' | 'version_diff' | 'association'
  targetId: string
  targetLabel: string
  evidences: JudgmentEvidence[]
  revisions: ManualRevision[]
  onNavigateEvidence?: (evidence: JudgmentEvidence) => void
}>()

const targetTypeLabel: Record<string, string> = {
  style_profile: '风格画像',
  version_diff: '版次差异',
  association: '同工异版'
}

const evidenceTypeLabel: Record<string, string> = {
  text_note: '文字说明',
  path_reference: '刀路引用',
  marker_reference: '标记引用'
}

const evidenceTypeColor: Record<string, string> = {
  text_note: 'bg-gray-100 text-gray-700 border-gray-300',
  path_reference: 'bg-blue-50 text-blue-700 border-blue-300',
  marker_reference: 'bg-orange-50 text-orange-700 border-orange-300'
}

const fieldNameLabel: Record<string, string> = {
  overallStyleDescription: '风格描述',
  styleTags: '风格标签',
  summaryText: '差异摘要',
  suspectedVersionRelation: '版次关系推断',
  analysisNotes: '分析备注',
  sharedFeatures: '共同特征',
  distinctiveFeatures: '差异特征'
}

const sortedTimeline = computed<TimelineItem[]>(() => {
  const items: TimelineItem[] = [
    ...props.evidences.map((e) => ({
      id: `ev-${e.id}`,
      type: 'evidence' as const,
      data: e,
      timestamp: e.createdAt
    })),
    ...props.revisions.map((r) => ({
      id: `rv-${r.id}`,
      type: 'revision' as const,
      data: r,
      timestamp: r.revisedAt
    }))
  ]
  return items.sort((a, b) => b.timestamp - a.timestamp)
})

const evidenceCount = computed(() => props.evidences.length)
const revisionCount = computed(() => props.revisions.length)
const isEmpty = computed(() => evidenceCount.value === 0 && revisionCount.value === 0)

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN')
}

function getFieldLabel(fieldName: string): string {
  return fieldNameLabel[fieldName] || fieldName
}

function handleEvidenceClick(evidence: JudgmentEvidence) {
  if (props.onNavigateEvidence) {
    props.onNavigateEvidence(evidence)
  }
}
</script>

<template>
  <div class="bg-white rounded-xl shadow-sm border border-[#D4C4A8] overflow-hidden">
    <div class="px-5 py-4 border-b border-[#D4C4A8] bg-gradient-to-r from-[#1D4E89]/5 to-transparent">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-[#1D4E89]/10 flex items-center justify-center">
            <svg class="w-5 h-5 text-[#1D4E89]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div>
            <h3 class="text-base font-bold text-[#3D2B1F]">{{ targetLabel }}</h3>
            <div class="flex items-center gap-2 mt-0.5">
              <span class="px-2 py-0.5 text-xs rounded-full bg-[#F5F0E6] text-[#8B7355] border border-[#D4C4A8]">
                {{ targetTypeLabel[targetType] }}
              </span>
              <span class="text-xs text-[#8B7355]">证据溯源链</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200">
            <svg class="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span class="text-xs font-medium text-blue-700">{{ evidenceCount }} 条证据</span>
          </div>
          <div class="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200">
            <svg class="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span class="text-xs font-medium text-amber-700">{{ revisionCount }} 次修订</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="isEmpty" class="p-12 text-center">
      <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-[#F5F0E6] flex items-center justify-center">
        <svg class="w-8 h-8 text-[#8B7355] opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <p class="text-sm text-[#8B7355] font-medium">暂无证据和修订记录</p>
      <p class="text-xs text-[#8B7355]/70 mt-1">添加判读依据或修订字段后将在此处显示溯源链</p>
    </div>

    <div v-else class="p-5">
      <div class="relative">
        <div class="absolute left-6 top-0 bottom-0 w-px bg-[#D4C4A8]" />

        <div
          v-for="(item, index) in sortedTimeline"
          :key="item.id"
          class="relative flex gap-4 pb-6 last:pb-0"
        >
          <div class="relative z-10 flex-shrink-0 w-12 h-12 rounded-full border-4 border-white flex items-center justify-center"
            :class="item.type === 'evidence' ? 'bg-[#1D4E89] shadow-lg shadow-[#1D4E89]/20' : 'bg-[#C4973B] shadow-lg shadow-[#C4973B]/20'"
          >
            <svg v-if="item.type === 'evidence'" class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <svg v-else class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>

          <div class="flex-1 min-w-0">
            <div
              v-if="item.type === 'evidence'"
              class="bg-white border border-[#D4C4A8] rounded-xl p-4 hover:shadow-md hover:border-[#1D4E89]/40 transition-all cursor-pointer group"
              @click="handleEvidenceClick(item.data as JudgmentEvidence)"
            >
              <div class="flex items-start justify-between mb-2">
                <div class="flex items-center gap-2">
                  <span
                    class="px-2 py-0.5 text-xs font-medium rounded border"
                    :class="evidenceTypeColor[(item.data as JudgmentEvidence).evidenceType]"
                  >
                    {{ evidenceTypeLabel[(item.data as JudgmentEvidence).evidenceType] }}
                  </span>
                  <span class="text-xs text-[#8B7355]">判读依据</span>
                </div>
                <svg class="w-4 h-4 text-[#8B7355] opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>

              <p class="text-sm text-[#3D2B1F] leading-relaxed whitespace-pre-wrap mb-3">
                {{ (item.data as JudgmentEvidence).content || '（无说明文字）' }}
              </p>

              <div v-if="(item.data as JudgmentEvidence).referencedIds.length > 0" class="mb-3">
                <div class="text-xs text-[#8B7355] mb-1">引用 {{ (item.data as JudgmentEvidence).referencedIds.length }} 项</div>
              </div>

              <div class="flex items-center gap-3 text-xs text-[#8B7355] pt-2 border-t border-[#D4C4A8]/50">
                <div class="flex items-center gap-1">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>{{ (item.data as JudgmentEvidence).createdBy }}</span>
                </div>
                <div class="flex items-center gap-1">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{{ formatDateTime((item.data as JudgmentEvidence).createdAt) }}</span>
                </div>
              </div>
            </div>

            <div
              v-else
              class="bg-[#FFFBF5] border border-amber-200 rounded-xl p-4"
            >
              <div class="flex items-start justify-between mb-2">
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 text-xs font-medium rounded bg-amber-100 text-amber-700 border border-amber-300">
                    字段修订
                  </span>
                  <span class="text-xs text-[#8B7355]">{{ getFieldLabel((item.data as ManualRevision).fieldName) }}</span>
                </div>
              </div>

              <div class="bg-white rounded-lg border border-amber-100 p-3 mb-3">
                <div class="flex items-start gap-2">
                  <div class="flex-1 min-w-0">
                    <div class="text-[11px] text-[#8B7355] mb-1">原值</div>
                    <div class="text-sm text-gray-600 line-through break-words">
                      {{ (item.data as ManualRevision).originalValue || '（空）' }}
                    </div>
                  </div>
                  <svg class="w-4 h-4 text-amber-500 flex-shrink-0 mt-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                  <div class="flex-1 min-w-0">
                    <div class="text-[11px] text-[#1D4E89] mb-1">修订值</div>
                    <div class="text-sm text-[#3D2B1F] font-medium break-words">
                      {{ (item.data as ManualRevision).revisedValue || '（空）' }}
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="(item.data as ManualRevision).reason" class="mb-3">
                <div class="text-[11px] text-[#8B7355] mb-1">修订原因</div>
                <p class="text-sm text-[#3D2B1F] bg-amber-50/50 rounded px-2.5 py-1.5 border border-amber-100">
                  {{ (item.data as ManualRevision).reason }}
                </p>
              </div>

              <div class="flex items-center gap-3 text-xs text-[#8B7355] pt-2 border-t border-amber-100">
                <div class="flex items-center gap-1">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>{{ (item.data as ManualRevision).revisedBy }}</span>
                </div>
                <div class="flex items-center gap-1">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{{ formatDateTime((item.data as ManualRevision).revisedAt) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
