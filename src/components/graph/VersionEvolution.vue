<script setup lang="ts">
import { computed, ref } from 'vue'
import type { VersionEvolutionChain, VersionEvolutionNode } from '../../types'

const props = defineProps<{
  chains: VersionEvolutionChain[]
  onSelectNode?: (schemeId: string) => void
}>()

const NODE_WIDTH = 140
const NODE_HEIGHT = 56
const H_GAP = 120
const V_GAP = 24
const CHAIN_GAP = 48

const RELATION_COLORS: Record<string, string> = {
  same_edition: '#22c55e',
  revised_edition: '#3b82f6',
  derived_edition: '#f59e0b',
  different_work: '#9ca3af'
}

const RELATION_LABELS: Record<string, string> = {
  same_edition: '同版',
  revised_edition: '修订版',
  derived_edition: '衍生版',
  different_work: '不同作品'
}

const hoveredNodeId = ref<string | null>(null)

interface PositionedNode extends VersionEvolutionNode {
  x: number
  y: number
}

interface ChainLayout {
  chain: VersionEvolutionChain
  nodes: PositionedNode[]
  width: number
  height: number
}

const chainLayouts = computed<ChainLayout[]>(() => {
  return props.chains.map((chain) => {
    const genGroups = new Map<number, VersionEvolutionNode[]>()
    chain.nodes.forEach((node) => {
      if (!genGroups.has(node.generation)) {
        genGroups.set(node.generation, [])
      }
      genGroups.get(node.generation)!.push(node)
    })

    const generations = Array.from(genGroups.keys()).sort((a, b) => a - b)
    const maxCount = Math.max(...Array.from(genGroups.values()).map((g) => g.length))

    const width = generations.length * NODE_WIDTH + (generations.length - 1) * H_GAP
    const height = maxCount * NODE_HEIGHT + (maxCount - 1) * V_GAP

    const positioned: PositionedNode[] = []
    generations.forEach((gen) => {
      const nodesInGen = genGroups.get(gen)!
      const genHeight = nodesInGen.length * NODE_HEIGHT + (nodesInGen.length - 1) * V_GAP
      const startY = (height - genHeight) / 2

      nodesInGen.forEach((node, idx) => {
        positioned.push({
          ...node,
          x: gen * (NODE_WIDTH + H_GAP),
          y: startY + idx * (NODE_HEIGHT + V_GAP)
        })
      })
    })

    return { chain, nodes: positioned, width, height }
  })
})

const totalHeight = computed(() => {
  if (chainLayouts.value.length === 0) return 0
  return chainLayouts.value.reduce((sum, cl, i) => {
    return sum + cl.height + (i > 0 ? CHAIN_GAP : 0)
  }, 0)
})

const totalWidth = computed(() => {
  if (chainLayouts.value.length === 0) return 0
  return Math.max(...chainLayouts.value.map((cl) => cl.width))
})

function getNodeColor(node: VersionEvolutionNode): string {
  return RELATION_COLORS[node.relationType || 'different_work'] || RELATION_COLORS.different_work
}

function getRelationLabel(node: VersionEvolutionNode): string {
  return RELATION_LABELS[node.relationType || 'different_work'] || '未知'
}

function formatSimilarity(v?: number): string {
  if (v === undefined || v === null) return '-'
  return `${(v * 100).toFixed(0)}%`
}

function getChainOffset(chainIndex: number): number {
  let offset = 0
  for (let i = 0; i < chainIndex; i++) {
    offset += chainLayouts.value[i].height + CHAIN_GAP
  }
  return offset
}

function handleNodeClick(schemeId: string) {
  if (props.onSelectNode) {
    props.onSelectNode(schemeId)
  }
}

function findNodeBySchemeId(layout: ChainLayout, schemeId: string): PositionedNode | undefined {
  return layout.nodes.find((n) => n.schemeId === schemeId)
}
</script>

<template>
  <div class="bg-white rounded-xl shadow-sm border border-[#D4C4A8] overflow-hidden">
    <div class="px-5 py-4 border-b border-[#D4C4A8] bg-gradient-to-r from-[#1D4E89]/5 to-transparent flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-[#1D4E89]/10 flex items-center justify-center">
          <svg class="w-5 h-5 text-[#1D4E89]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <div>
          <h3 class="text-base font-bold text-[#3D2B1F]">版本演化链</h3>
          <p class="text-xs text-[#8B7355] mt-0.5">基于相似度和关系推断的方案版本演化图谱</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F5F0E6] border border-[#D4C4A8]">
          <svg class="w-3.5 h-3.5 text-[#8B7355]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          <span class="text-xs font-medium text-[#5c4a3a]">{{ chains.length }} 条演化链</span>
        </div>
      </div>
    </div>

    <div v-if="chains.length === 0" class="p-12 text-center">
      <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-[#F5F0E6] flex items-center justify-center">
        <svg class="w-8 h-8 text-[#8B7355] opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
      <p class="text-sm text-[#8B7355] font-medium">暂无版本演化数据</p>
      <p class="text-xs text-[#8B7355]/70 mt-1">运行全量风格分析后将生成版本演化链</p>
    </div>

    <template v-else>
      <div class="px-5 py-3 border-b border-[#D4C4A8] bg-[#FFFBF5]/50">
        <div class="flex items-center gap-4 flex-wrap">
          <div class="text-xs font-medium text-[#5c4a3a]">关系类型图例：</div>
          <div v-for="(color, key) in RELATION_COLORS" :key="key" class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: color }" />
            <span class="text-xs text-[#5c4a3a]">{{ RELATION_LABELS[key] }}</span>
          </div>
        </div>
      </div>

      <div class="p-5 overflow-x-auto">
        <svg
          :width="Math.max(totalWidth + 80, 600)"
          :height="totalHeight + 40"
          class="min-w-full"
        >
          <defs>
            <marker
              v-for="(color, key) in RELATION_COLORS"
              :key="key"
              :id="`arrow-${key}`"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" :fill="color" />
            </marker>
          </defs>

          <g v-for="(layout, chainIdx) in chainLayouts" :key="layout.chain.id" :transform="`translate(40, ${20 + getChainOffset(chainIdx)})`">
            <text x="0" y="-12" class="fill-[#3D2B1F]" font-size="13" font-weight="600">
              {{ layout.chain.description || `演化链 #${chainIdx + 1}` }}
            </text>
            <text :x="layout.width" y="-12" text-anchor="end" class="fill-[#8B7355]" font-size="11">
              共 {{ layout.chain.nodes.length }} 个版本 · {{ layout.chain.totalGenerations }} 代
            </text>

            <g v-for="node in layout.nodes" :key="`edge-${node.schemeId}`">
              <template v-for="predId in node.predecessors" :key="`${predId}-${node.schemeId}`">
                <g v-if="findNodeBySchemeId(layout, predId)">
                  <path
                    :d="`M ${findNodeBySchemeId(layout, predId)!.x + NODE_WIDTH} ${findNodeBySchemeId(layout, predId)!.y + NODE_HEIGHT / 2} H ${node.x - 10}`"
                    fill="none"
                    :stroke="getNodeColor(node)"
                    stroke-width="2"
                    stroke-opacity="0.6"
                    :marker-end="`url(#arrow-${node.relationType || 'different_work'})`"
                  />
                  <rect
                    :x="(findNodeBySchemeId(layout, predId)!.x + NODE_WIDTH + node.x - 10) / 2 - 42"
                    :y="(findNodeBySchemeId(layout, predId)!.y + node.y) / 2 + NODE_HEIGHT / 2 - 10"
                    width="84"
                    height="20"
                    rx="10"
                    fill="white"
                    :stroke="getNodeColor(node)"
                    stroke-opacity="0.4"
                    stroke-width="1"
                  />
                  <text
                    :x="(findNodeBySchemeId(layout, predId)!.x + NODE_WIDTH + node.x - 10) / 2"
                    :y="(findNodeBySchemeId(layout, predId)!.y + node.y) / 2 + NODE_HEIGHT / 2 + 4"
                    text-anchor="middle"
                    :fill="getNodeColor(node)"
                    font-size="10"
                    font-weight="600"
                  >
                    {{ formatSimilarity(node.similarityToPredecessor) }} · {{ getRelationLabel(node) }}
                  </text>
                </g>
              </template>
            </g>

            <g
              v-for="node in layout.nodes"
              :key="node.schemeId"
              class="cursor-pointer"
              :transform="`translate(${node.x}, ${node.y})`"
              @click="handleNodeClick(node.schemeId)"
              @mouseenter="hoveredNodeId = node.schemeId"
              @mouseleave="hoveredNodeId = null"
            >
              <rect
                width="140"
                height="56"
                rx="8"
                :fill="hoveredNodeId === node.schemeId ? '#F5F0E6' : 'white'"
                :stroke="getNodeColor(node)"
                stroke-width="2"
                :class="hoveredNodeId === node.schemeId ? 'drop-shadow-md' : ''"
              />
              <rect
                x="0"
                y="0"
                width="140"
                height="4"
                rx="8"
                :fill="getNodeColor(node)"
              />
              <text
                x="70"
                y="26"
                text-anchor="middle"
                class="fill-[#3D2B1F] select-none"
                font-size="12"
                font-weight="600"
              >
                {{ node.schemeName.length > 10 ? node.schemeName.slice(0, 10) + '…' : node.schemeName }}
              </text>
              <text
                x="70"
                y="44"
                text-anchor="middle"
                class="fill-[#8B7355] select-none"
                font-size="10"
              >
                第 {{ node.generation + 1 }} 代
              </text>

              <g v-if="hoveredNodeId === node.schemeId" transform="translate(0, -76)">
                <rect
                  x="-4"
                  y="0"
                  width="148"
                  height="68"
                  rx="6"
                  fill="#3D2B1F"
                  fill-opacity="0.95"
                />
                <text x="70" y="20" text-anchor="middle" fill="white" font-size="11" font-weight="600">
                  {{ node.schemeName.length > 14 ? node.schemeName.slice(0, 14) + '…' : node.schemeName }}
                </text>
                <text x="70" y="38" text-anchor="middle" fill="#d4c4a8" font-size="10">
                  代数：第 {{ node.generation + 1 }} 代
                </text>
                <text x="70" y="56" text-anchor="middle" fill="#d4c4a8" font-size="10">
                  与前驱相似度：{{ formatSimilarity(node.similarityToPredecessor) }}
                </text>
                <polygon points="66,68 74,68 70,76" fill="#3D2B1F" fill-opacity="0.95" />
              </g>
            </g>
          </g>
        </svg>
      </div>
    </template>
  </div>
</template>
