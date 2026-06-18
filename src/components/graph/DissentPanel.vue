<script setup lang="ts">
import { computed } from 'vue'
import type { DissentGroup, ResearcherOpinion, ConfidenceLevel } from '../../types'

const props = withDefaults(defineProps<{
  dissents: DissentGroup[]
  onSelectDissent?: (dissent: DissentGroup) => void
}>(), {
  onSelectDissent: undefined
})

const sortedDissents = computed(() => {
  return [...props.dissents].sort((a, b) => a.consensusLevel - b.consensusLevel)
})

const totalCount = computed(() => props.dissents.length)
const consensusCount = computed(() => props.dissents.filter(d => d.consensusLevel >= 0.8).length)
const disputedCount = computed(() => props.dissents.filter(d => d.consensusLevel < 0.8).length)

function getConsensusColor(level: number): string {
  if (level >= 0.8) return '#22c55e'
  if (level >= 0.5) return '#f59e0b'
  return '#ef4444'
}

function getConfidenceColorClass(confidence: ConfidenceLevel): string {
  switch (confidence) {
    case 'high':
      return 'bg-green-100 text-green-700'
    case 'medium':
      return 'bg-amber-100 text-amber-700'
    case 'low':
      return 'bg-gray-100 text-gray-700'
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

function getTargetTypeColorClass(type: 'style_profile' | 'version_diff' | 'association'): string {
  switch (type) {
    case 'style_profile':
      return 'bg-indigo-100 text-indigo-700'
    case 'version_diff':
      return 'bg-red-100 text-red-700'
    case 'association':
      return 'bg-emerald-100 text-emerald-700'
  }
}

function getTargetTypeLabel(type: 'style_profile' | 'version_diff' | 'association'): string {
  switch (type) {
    case 'style_profile':
      return '风格画像'
    case 'version_diff':
      return '版次差异'
    case 'association':
      return '同工异版'
  }
}

function handleCardClick(dissent: DissentGroup) {
  props.onSelectDissent?.(dissent)
}

function isDominantOpinion(opinion: ResearcherOpinion, dissent: DissentGroup): boolean {
  return !!dissent.dominantJudgment && opinion.judgment === dissent.dominantJudgment
}
</script>

<template>
  <div class="h-full flex flex-col bg-[#F5F0E6] rounded-xl border border-[#D4C4A8] overflow-hidden">
    <div class="px-5 py-4 border-b border-[#D4C4A8] bg-white/60">
      <h3 class="text-base font-bold text-[#3D2B1F] flex items-center gap-2 mb-3">
        <svg class="w-5 h-5 text-[#8B7355]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        研究员分歧对照
      </h3>
      <div class="grid grid-cols-3 gap-3">
        <div class="bg-white rounded-lg p-3 border border-[#D4C4A8] text-center">
          <div class="text-2xl font-bold text-[#3D2B1F]">{{ totalCount }}</div>
          <div class="text-xs text-[#8B7355] mt-0.5">总分歧</div>
        </div>
        <div class="bg-white rounded-lg p-3 border border-[#D4C4A8] text-center">
          <div class="text-2xl font-bold text-green-600">{{ consensusCount }}</div>
          <div class="text-xs text-[#8B7355] mt-0.5">已达成共识</div>
        </div>
        <div class="bg-white rounded-lg p-3 border border-[#D4C4A8] text-center">
          <div class="text-2xl font-bold text-red-500">{{ disputedCount }}</div>
          <div class="text-xs text-[#8B7355] mt-0.5">存在争议</div>
        </div>
      </div>
    </div>

    <div v-if="sortedDissents.length === 0" class="flex-1 flex items-center justify-center">
      <div class="text-center text-[#8B7355]">
        <svg class="w-16 h-16 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <p class="text-sm">暂无分歧数据</p>
        <p class="text-xs mt-1 opacity-70">多研究员分析后将在此展示对照结果</p>
      </div>
    </div>

    <div v-else class="flex-1 overflow-y-auto p-4 space-y-4">
      <div
        v-for="dissent in sortedDissents"
        :key="dissent.id"
        @click="handleCardClick(dissent)"
        :class="[
          'bg-white rounded-xl border overflow-hidden transition-all',
          onSelectDissent ? 'cursor-pointer hover:shadow-md hover:border-[#8B7355]' : '',
          'border-[#D4C4A8]'
        ]"
      >
        <div class="px-4 py-3 border-b border-[#D4C4A8]/60 bg-[#F5F0E6]/40 flex items-start justify-between gap-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h4 class="text-sm font-semibold text-[#3D2B1F] truncate">{{ dissent.targetLabel }}</h4>
              <span
                class="px-2 py-0.5 text-[10px] font-medium rounded-full"
                :class="getTargetTypeColorClass(dissent.targetType)"
              >
                {{ getTargetTypeLabel(dissent.targetType) }}
              </span>
            </div>
            <div class="flex items-center gap-2 mt-2">
              <div class="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all"
                  :style="{
                    width: `${dissent.consensusLevel * 100}%`,
                    backgroundColor: getConsensusColor(dissent.consensusLevel)
                  }"
                />
              </div>
              <span
                class="text-sm font-bold min-w-[48px] text-right"
                :style="{ color: getConsensusColor(dissent.consensusLevel) }"
              >
                {{ (dissent.consensusLevel * 100).toFixed(0) }}%
              </span>
            </div>
            <div class="text-[11px] text-[#8B7355] mt-1">共识度</div>
          </div>
        </div>

        <div class="p-3">
          <div
            class="grid gap-3"
            :style="{ gridTemplateColumns: `repeat(${Math.min(dissent.opinions.length, 3)}, minmax(0, 1fr))` }"
          >
            <div
              v-for="(opinion, idx) in dissent.opinions"
              :key="idx"
              :class="[
                'rounded-lg border p-3 transition-all',
                isDominantOpinion(opinion, dissent)
                  ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-300'
                  : 'bg-gray-50 border-[#D4C4A8]'
              ]"
            >
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-semibold text-[#3D2B1F]">{{ opinion.researcher }}</span>
                <span
                  class="px-1.5 py-0.5 text-[10px] font-medium rounded"
                  :class="getConfidenceColorClass(opinion.confidence)"
                >
                  {{ getConfidenceLabel(opinion.confidence) }}
                </span>
              </div>

              <div
                :class="[
                  'text-sm font-medium mb-2 leading-snug',
                  isDominantOpinion(opinion, dissent) ? 'text-amber-800' : 'text-[#3D2B1F]'
                ]"
              >
                {{ opinion.judgment }}
              </div>

              <div class="text-[11px] text-[#8B7355] leading-relaxed line-clamp-4">
                {{ opinion.reasoning }}
              </div>

              <div
                v-if="isDominantOpinion(opinion, dissent)"
                class="mt-2 pt-2 border-t border-amber-200 flex items-center gap-1"
              >
                <svg class="w-3 h-3 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
                <span class="text-[10px] font-medium text-amber-700">主导判断</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
