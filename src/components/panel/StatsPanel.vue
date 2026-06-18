<script setup lang="ts">
import { computed } from 'vue'
import { useStatsCalculation } from '../../composables/useStatsCalculation'
import { useBusinessRules } from '../../composables/useBusinessRules'
import { useProjectStore } from '../../stores/projectStore'

const statsCalculation = useStatsCalculation()
const businessRules = useBusinessRules()
const projectStore = useProjectStore()

const overallStats = statsCalculation.overallStats
const statsByLayer = statsCalculation.statsByLayer
const reviewProgress = computed(() => businessRules.reviewProgress)
const isCompleted = computed(() => projectStore.isCompleted)
const hasUnreviewed = computed(() => businessRules.hasUnreviewedPaths)
const hasDuplicates = computed(() => businessRules.hasDuplicatePathNumbers)
</script>

<template>
  <div class="stats-panel bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-[#D4C4A8] overflow-hidden">
    <div class="px-4 py-3 border-b border-[#D4C4A8] bg-[#F5F0E6]/50">
      <h3 class="font-medium text-[#3D2B1F] flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        统计信息
      </h3>
    </div>

    <div class="p-4 space-y-4">
      <div
        :class="[
          'p-3 rounded-lg text-center',
          isCompleted
            ? 'bg-[#2E5D3B]/10 border border-[#2E5D3B]/30'
            : 'bg-[#E8A838]/10 border border-[#E8A838]/30'
        ]"
      >
        <div class="text-xs mb-1" :class="isCompleted ? 'text-[#2E5D3B]' : 'text-[#E8A838]'">
          项目状态
        </div>
        <div class="text-lg font-bold" :class="isCompleted ? 'text-[#2E5D3B]' : 'text-[#E8A838]'">
          {{ isCompleted ? '✓ 复原完成' : '进行中' }}
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="p-3 bg-[#F5F0E6] rounded-lg text-center">
          <div class="text-xs text-[#8B7355]">总刀路数</div>
          <div class="text-xl font-bold text-[#3D2B1F]">{{ overallStats.totalPathCount }}</div>
        </div>
        <div class="p-3 bg-[#F5F0E6] rounded-lg text-center">
          <div class="text-xs text-[#8B7355]">可见刀路</div>
          <div class="text-xl font-bold text-[#3D2B1F]">{{ overallStats.visiblePathCount }}</div>
        </div>
      </div>

      <div class="p-3 bg-[#1D4E89]/10 rounded-lg">
        <div class="text-xs text-[#1D4E89] mb-1">总刀路长度（仅可见图层）</div>
        <div class="text-xl font-bold text-[#1D4E89]">{{ overallStats.visibleLengthFormatted }}</div>
      </div>

      <div class="space-y-2">
        <div class="flex justify-between items-center text-sm">
          <span class="text-[#8B7355]">复核进度</span>
          <span class="font-medium" :class="hasUnreviewed ? 'text-[#E8A838]' : 'text-[#2E5D3B]'">
            {{ overallStats.reviewedCount }} / {{ overallStats.totalPathCount }}
          </span>
        </div>
        <div class="h-2 bg-[#F5F0E6] rounded-full overflow-hidden">
          <div
            class="h-full transition-all duration-500"
            :class="hasUnreviewed ? 'bg-[#E8A838]' : 'bg-[#2E5D3B]'"
            :style="{ width: `${reviewProgress}%` }"
          />
        </div>
        <div class="text-xs text-right text-[#8B7355]">{{ reviewProgress }}%</div>
      </div>

      <div v-if="hasDuplicates" class="p-3 bg-red-50 border border-red-200 rounded-lg">
        <div class="text-xs text-red-600 font-medium flex items-center gap-1">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          存在重复编号
        </div>
        <div class="text-xs text-red-500 mt-1">
          请修正后才能标记为完成
        </div>
      </div>

      <div v-if="hasUnreviewed" class="p-3 bg-[#E8A838]/10 border border-[#E8A838]/30 rounded-lg">
        <div class="text-xs text-[#E8A838] font-medium flex items-center gap-1">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          待复核：{{ businessRules.unreviewedCount }} 条
        </div>
      </div>

      <div v-if="statsByLayer.length > 0" class="space-y-2 pt-2 border-t border-[#D4C4A8]">
        <div class="text-xs font-medium text-[#8B7355]">各图层统计</div>
        <div v-for="stat in statsByLayer" :key="stat.layerId" class="space-y-1">
          <div class="flex items-center justify-between text-sm">
            <div class="flex items-center gap-2">
              <div
                class="w-3 h-3 rounded-full"
                :style="{ backgroundColor: stat.layerColor }"
              />
              <span class="text-[#3D2B1F] truncate max-w-[120px]">{{ stat.layerName }}</span>
              <span v-if="!stat.visible" class="text-xs text-[#8B7355]">(隐藏)</span>
            </div>
            <span class="text-[#8B7355]">{{ stat.pathCount }} 条</span>
          </div>
          <div class="h-1.5 bg-[#F5F0E6] rounded-full overflow-hidden">
            <div
              class="h-full transition-all duration-500"
              :style="{
                width: `${stat.reviewProgress}%`,
                backgroundColor: stat.layerColor
              }"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
