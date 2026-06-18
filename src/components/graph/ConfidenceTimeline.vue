<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ConfidenceSnapshot, ConfidenceLevel } from '../../types'

const props = defineProps<{
  snapshots: ConfidenceSnapshot[]
  targetLabel: string
}>()

const selectedSnapshot = ref<ConfidenceSnapshot | null>(null)
const showDetailModal = ref(false)

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN')
}

function getConfidenceColor(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':
      return '#22c55e'
    case 'medium':
      return '#f59e0b'
    case 'low':
      return '#9ca3af'
  }
}

function getConfidenceLabel(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':
      return '高置信'
    case 'medium':
      return '中置信'
    case 'low':
      return '低置信'
  }
}

const sortedSnapshots = computed(() => {
  return [...props.snapshots].sort((a, b) => a.recordedAt - b.recordedAt)
})

const latestSnapshot = computed(() => {
  if (sortedSnapshots.value.length === 0) return null
  return sortedSnapshots.value[sortedSnapshots.value.length - 1]
})

const trend = computed(() => {
  if (sortedSnapshots.value.length < 2) return 'stable' as const
  const first = sortedSnapshots.value[0].confidenceValue
  const last = sortedSnapshots.value[sortedSnapshots.value.length - 1].confidenceValue
  const diff = last - first
  if (Math.abs(diff) < 5) return 'stable' as const
  return diff > 0 ? 'rising' as const : 'falling' as const
})

const trendLabel = computed(() => {
  switch (trend.value) {
    case 'rising':
      return '置信度呈上升趋势'
    case 'falling':
      return '置信度呈下降趋势'
    case 'stable':
      return '置信度保持稳定'
  }
})

const trendIcon = computed(() => {
  switch (trend.value) {
    case 'rising':
      return 'M5 15l7-7 7 7'
    case 'falling':
      return 'M19 9l-7 7-7-7'
    case 'stable':
      return 'M5 12h14'
  }
})

const trendColor = computed(() => {
  switch (trend.value) {
    case 'rising':
      return 'text-green-600 bg-green-50 border-green-200'
    case 'falling':
      return 'text-red-600 bg-red-50 border-red-200'
    case 'stable':
      return 'text-gray-600 bg-gray-50 border-gray-200'
  }
})

const chartWidth = 800
const chartHeight = 320
const paddingLeft = 60
const paddingRight = 30
const paddingTop = 30
const paddingBottom = 100

const plotWidth = chartWidth - paddingLeft - paddingRight
const plotHeight = chartHeight - paddingTop - paddingBottom

const chartPoints = computed(() => {
  const snapshots = sortedSnapshots.value
  if (snapshots.length === 0) return []
  if (snapshots.length === 1) {
    return [{
      x: paddingLeft + plotWidth / 2,
      y: paddingTop + plotHeight * (1 - snapshots[0].confidenceValue / 100),
      snapshot: snapshots[0]
    }]
  }
  return snapshots.map((s, i) => ({
    x: paddingLeft + (i / (snapshots.length - 1)) * plotWidth,
    y: paddingTop + plotHeight * (1 - s.confidenceValue / 100),
    snapshot: s
  }))
})

const linePath = computed(() => {
  if (chartPoints.value.length === 0) return ''
  return chartPoints.value
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')
})

const areaPath = computed(() => {
  if (chartPoints.value.length === 0) return ''
  const firstPoint = chartPoints.value[0]
  const lastPoint = chartPoints.value[chartPoints.value.length - 1]
  const bottomY = paddingTop + plotHeight
  const line = chartPoints.value
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')
  return `${line} L ${lastPoint.x} ${bottomY} L ${firstPoint.x} ${bottomY} Z`
})

const yAxisTicks = computed(() => {
  return [0, 25, 50, 75, 100].map((value) => ({
    value,
    y: paddingTop + plotHeight * (1 - value / 100)
  }))
})

function openDetail(snapshot: ConfidenceSnapshot) {
  selectedSnapshot.value = snapshot
  showDetailModal.value = true
}

function closeDetail() {
  showDetailModal.value = false
  selectedSnapshot.value = null
}
</script>

<template>
  <div class="bg-white rounded-xl border border-[#D4C4A8] shadow-sm overflow-hidden">
    <div v-if="snapshots.length === 0" class="p-12 text-center">
      <svg class="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <p class="text-sm text-[#8B7355]">暂无置信度历史记录</p>
      <p class="text-xs text-[#8B7355]/70 mt-1">添加判读依据或修订后将自动记录置信度变化</p>
    </div>

    <template v-else>
      <div class="px-5 py-4 border-b border-[#D4C4A8] bg-gradient-to-r from-[#F5F0E6]/50 to-transparent">
        <div class="flex items-start justify-between">
          <div>
            <h3 class="text-base font-bold text-[#3D2B1F]">{{ targetLabel }}</h3>
            <p class="text-xs text-[#8B7355] mt-0.5">置信度变化追踪 · 共 {{ snapshots.length }} 条记录</p>
          </div>
          <div class="flex items-center gap-3">
            <div v-if="latestSnapshot" class="flex items-center gap-2">
              <span class="text-xs text-[#8B7355]">当前置信度</span>
              <span
                class="px-2.5 py-1 text-sm font-bold rounded-lg border"
                :style="{
                  backgroundColor: getConfidenceColor(latestSnapshot.confidenceLevel) + '20',
                  color: getConfidenceColor(latestSnapshot.confidenceLevel),
                  borderColor: getConfidenceColor(latestSnapshot.confidenceLevel) + '50'
                }"
              >
                {{ (latestSnapshot.confidenceValue).toFixed(0) }}% · {{ getConfidenceLabel(latestSnapshot.confidenceLevel) }}
              </span>
            </div>
            <span
              class="px-3 py-1 text-xs font-medium rounded-full border inline-flex items-center gap-1"
              :class="trendColor"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="trendIcon" />
              </svg>
              {{ trendLabel }}
            </span>
          </div>
        </div>
      </div>

      <div class="p-4 overflow-x-auto">
        <svg :width="chartWidth" :height="chartHeight" class="min-w-full">
          <defs>
            <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#6B4E71" stop-opacity="0.3" />
              <stop offset="100%" stop-color="#6B4E71" stop-opacity="0.02" />
            </linearGradient>
          </defs>

          <g v-for="tick in yAxisTicks" :key="tick.value">
            <line
              :x1="paddingLeft"
              :y1="tick.y"
              :x2="chartWidth - paddingRight"
              :y2="tick.y"
              stroke="#E8E0D0"
              stroke-width="1"
              stroke-dasharray="4 4"
            />
            <text
              :x="paddingLeft - 10"
              :y="tick.y + 4"
              text-anchor="end"
              fill="#8B7355"
              font-size="11"
            >
              {{ tick.value }}%
            </text>
          </g>

          <line
            :x1="paddingLeft"
            :y1="paddingTop + plotHeight"
            :x2="chartWidth - paddingRight"
            :y2="paddingTop + plotHeight"
            stroke="#D4C4A8"
            stroke-width="1.5"
          />
          <line
            :x1="paddingLeft"
            :y1="paddingTop"
            :x2="paddingLeft"
            :y2="paddingTop + plotHeight"
            stroke="#D4C4A8"
            stroke-width="1.5"
          />

          <path
            v-if="areaPath"
            :d="areaPath"
            fill="url(#confidenceGradient)"
          />

          <path
            v-if="linePath"
            :d="linePath"
            fill="none"
            stroke="#6B4E71"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          <g v-for="(point, index) in chartPoints" :key="point.snapshot.id">
            <circle
              :cx="point.x"
              :cy="point.y"
              r="6"
              :fill="getConfidenceColor(point.snapshot.confidenceLevel)"
              stroke="white"
              stroke-width="2.5"
              class="cursor-pointer transition-transform hover:scale-125"
              style="transform-origin: center"
              @click="openDetail(point.snapshot)"
            />

            <text
              :x="point.x"
              :y="point.y - 14"
              text-anchor="middle"
              fill="#3D2B1F"
              font-size="11"
              font-weight="600"
            >
              {{ (point.snapshot.confidenceValue).toFixed(0) }}%
            </text>

            <text
              v-if="sortedSnapshots.length <= 6 || index % Math.ceil(sortedSnapshots.length / 6) === 0 || index === sortedSnapshots.length - 1"
              :x="point.x"
              :y="paddingTop + plotHeight + 20"
              text-anchor="middle"
              fill="#8B7355"
              font-size="10"
            >
              {{ new Date(point.snapshot.recordedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) }}
            </text>
            <text
              v-if="sortedSnapshots.length <= 6 || index % Math.ceil(sortedSnapshots.length / 6) === 0 || index === sortedSnapshots.length - 1"
              :x="point.x"
              :y="paddingTop + plotHeight + 34"
              text-anchor="middle"
              fill="#8B7355"
              font-size="9"
            >
              {{ new Date(point.snapshot.recordedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}
            </text>

            <foreignObject
              v-if="point.snapshot.reason"
              :x="point.x - 50"
              :y="paddingTop + plotHeight + 44"
              width="100"
              height="36"
            >
              <div
                class="flex items-center justify-center text-center cursor-pointer hover:opacity-80 transition-opacity"
                @click="openDetail(point.snapshot)"
              >
                <span
                  class="inline-block px-2 py-0.5 text-[10px] rounded bg-[#F5F0E6] text-[#5c4a3a] border border-[#D4C4A8] truncate max-w-full"
                  :title="point.snapshot.reason"
                >
                  {{ point.snapshot.reason }}
                </span>
              </div>
            </foreignObject>
          </g>

          <text
            :x="paddingLeft - 45"
            :y="paddingTop - 10"
            fill="#8B7355"
            font-size="11"
            font-weight="500"
          >
            置信度
          </text>
          <text
            :x="chartWidth - paddingRight"
            :y="paddingTop + plotHeight + 20"
            text-anchor="end"
            fill="#8B7355"
            font-size="11"
            font-weight="500"
          >
            时间
          </text>
        </svg>
      </div>

      <div class="px-5 py-3 border-t border-[#D4C4A8] bg-[#F5F0E6]/30">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4 text-xs text-[#8B7355]">
            <div class="flex items-center gap-1.5">
              <span class="w-3 h-3 rounded-full bg-[#22c55e]"></span>
              <span>高置信 (≥70%)</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="w-3 h-3 rounded-full bg-[#f59e0b]"></span>
              <span>中置信 (40%-70%)</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="w-3 h-3 rounded-full bg-[#9ca3af]"></span>
              <span>低置信 (<40%)</span>
            </div>
          </div>
          <div class="text-xs text-[#8B7355]">
            <span v-if="sortedSnapshots.length > 0 && latestSnapshot">
              首次记录：{{ formatDateTime(sortedSnapshots[0].recordedAt) }}
              <span class="mx-2">·</span>
              最新记录：{{ formatDateTime(latestSnapshot.recordedAt) }}
            </span>
          </div>
        </div>
      </div>
    </template>

    <Teleport to="body">
      <div
        v-if="showDetailModal && selectedSnapshot"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        @click.self="closeDetail"
      >
        <div class="bg-white rounded-xl shadow-2xl w-[420px] overflow-hidden">
          <div class="px-5 py-4 border-b border-[#D4C4A8] bg-gradient-to-r from-[#6B4E71]/5 to-transparent flex items-center justify-between">
            <h4 class="text-sm font-bold text-[#3D2B1F]">置信度详情</h4>
            <button
              @click="closeDetail"
              class="p-1 hover:bg-[#F5F0E6] rounded-lg transition-colors"
            >
              <svg class="w-4 h-4 text-[#8B7355]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="p-5 space-y-4">
            <div class="flex items-center justify-center py-3">
              <div
                class="flex flex-col items-center px-6 py-3 rounded-xl border"
                :style="{
                  backgroundColor: getConfidenceColor(selectedSnapshot.confidenceLevel) + '15',
                  borderColor: getConfidenceColor(selectedSnapshot.confidenceLevel) + '40'
                }"
              >
                <span
                  class="text-3xl font-bold"
                  :style="{ color: getConfidenceColor(selectedSnapshot.confidenceLevel) }"
                >
                  {{ (selectedSnapshot.confidenceValue).toFixed(0) }}%
                </span>
                <span
                  class="text-xs font-medium mt-1"
                  :style="{ color: getConfidenceColor(selectedSnapshot.confidenceLevel) }"
                >
                  {{ getConfidenceLabel(selectedSnapshot.confidenceLevel) }}
                </span>
              </div>
            </div>

            <div class="space-y-3">
              <div class="flex items-start gap-3">
                <svg class="w-4 h-4 text-[#8B7355] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div class="flex-1">
                  <div class="text-[11px] text-[#8B7355]">记录时间</div>
                  <div class="text-sm text-[#3D2B1F]">{{ formatDateTime(selectedSnapshot.recordedAt) }}</div>
                </div>
              </div>

              <div class="flex items-start gap-3">
                <svg class="w-4 h-4 text-[#8B7355] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <div class="flex-1">
                  <div class="text-[11px] text-[#8B7355]">记录人</div>
                  <div class="text-sm text-[#3D2B1F]">{{ selectedSnapshot.recordedBy }}</div>
                </div>
              </div>

              <div v-if="selectedSnapshot.reason" class="flex items-start gap-3">
                <svg class="w-4 h-4 text-[#8B7355] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div class="flex-1">
                  <div class="text-[11px] text-[#8B7355]">变更原因</div>
                  <div class="text-sm text-[#3D2B1F] leading-relaxed">{{ selectedSnapshot.reason }}</div>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3 pt-1">
                <div class="flex items-center gap-2 px-3 py-2.5 bg-blue-50 rounded-lg border border-blue-100">
                  <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <div>
                    <div class="text-[10px] text-blue-500">关联证据</div>
                    <div class="text-sm font-bold text-blue-700">{{ selectedSnapshot.evidenceIds.length }} 条</div>
                  </div>
                </div>
                <div class="flex items-center gap-2 px-3 py-2.5 bg-amber-50 rounded-lg border border-amber-100">
                  <svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <div>
                    <div class="text-[10px] text-amber-500">关联修订</div>
                    <div class="text-sm font-bold text-amber-700">{{ selectedSnapshot.revisionIds.length }} 条</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="px-5 py-3 border-t border-[#D4C4A8] bg-[#F5F0E6]/30 flex justify-end">
            <button
              @click="closeDetail"
              class="px-4 py-1.5 bg-[#6B4E71] text-white text-sm rounded-lg hover:bg-[#5a405e] transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
