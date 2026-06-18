<script setup lang="ts">
import { ref, onMounted, watch, computed, nextTick } from 'vue'
import type { KnowledgeGraph, GraphNode, GraphEdge, GraphNodeType } from '../../types'
import { layoutGraphForceDirected, NODE_COLORS } from '../../utils/knowledgeGraph'

const props = defineProps<{
  graph: KnowledgeGraph
  highlightNodeId?: string
  onNodeClick?: (node: GraphNode) => void
}>()

const NODE_ICONS: Record<GraphNodeType, string> = {
  scheme: '方',
  style_profile: '画',
  blade_path: '刀',
  marker: '标',
  version_diff: '差',
  association: '联',
  evidence: '证',
  revision: '修',
  researcher: '研'
}

const NODE_TYPE_LABELS: Record<GraphNodeType, string> = {
  scheme: '标注方案',
  style_profile: '风格画像',
  blade_path: '刀路',
  marker: '标记',
  version_diff: '版次对比',
  association: '同工关联',
  evidence: '判读依据',
  revision: '修订记录',
  researcher: '研究员'
}

const svgRef = ref<SVGSVGElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const layoutGraph = ref<KnowledgeGraph>({ nodes: [], edges: [], generatedAt: 0 })
const containerWidth = ref(800)
const containerHeight = ref(600)
const viewBox = ref({ x: 0, y: 0, w: 800, h: 600 })
const isPanning = ref(false)
const panStart = ref({ x: 0, y: 0 })
const viewBoxStart = ref({ x: 0, y: 0 })
const hoveredNodeId = ref<string | null>(null)
const selectedNodeId = ref<string | null>(null)
const scale = ref(1)

const nodeMap = computed(() => {
  const map = new Map<string, GraphNode>()
  layoutGraph.value.nodes.forEach((n) => map.set(n.id, n))
  return map
})

const uniqueNodeTypes = computed(() => {
  const types = new Set<GraphNodeType>()
  layoutGraph.value.nodes.forEach((n) => types.add(n.type))
  return Array.from(types)
})

function runLayout() {
  if (!props.graph || props.graph.nodes.length === 0) {
    layoutGraph.value = { nodes: [], edges: [], generatedAt: 0 }
    return
  }
  const paddedW = containerWidth.value || 800
  const paddedH = containerHeight.value || 600
  layoutGraph.value = layoutGraphForceDirected(props.graph, paddedW, paddedH)
}

function fitView() {
  if (layoutGraph.value.nodes.length === 0) {
    viewBox.value = { x: 0, y: 0, w: containerWidth.value, h: containerHeight.value }
    scale.value = 1
    return
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  layoutGraph.value.nodes.forEach((n) => {
    const size = n.size ?? 20
    const x = n.x ?? 0
    const y = n.y ?? 0
    minX = Math.min(minX, x - size * 2)
    minY = Math.min(minY, y - size * 2)
    maxX = Math.max(maxX, x + size * 2)
    maxY = Math.max(maxY, y + size * 2)
  })

  const padding = 60
  const graphW = maxX - minX + padding * 2
  const graphH = maxY - minY + padding * 2
  const scaleX = containerWidth.value / graphW
  const scaleY = containerHeight.value / graphH
  const newScale = Math.min(scaleX, scaleY, 1)

  viewBox.value = {
    x: minX - padding,
    y: minY - padding,
    w: graphW,
    h: graphH
  }
  scale.value = newScale
}

function handleResize() {
  if (!containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  containerWidth.value = rect.width || 800
  containerHeight.value = rect.height || 600
  nextTick(() => {
    runLayout()
    fitView()
  })
}

function handleWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? 1.1 : 0.9
  const newW = viewBox.value.w * delta
  const newH = viewBox.value.h * delta
  const rect = svgRef.value?.getBoundingClientRect()
  if (!rect) return

  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top
  const svgX = viewBox.value.x + (mouseX / rect.width) * viewBox.value.w
  const svgY = viewBox.value.y + (mouseY / rect.height) * viewBox.value.h

  viewBox.value = {
    x: svgX - (mouseX / rect.width) * newW,
    y: svgY - (mouseY / rect.height) * newH,
    w: newW,
    h: newH
  }
  scale.value *= (1 / delta)
}

function handleMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  isPanning.value = true
  panStart.value = { x: e.clientX, y: e.clientY }
  viewBoxStart.value = { x: viewBox.value.x, y: viewBox.value.y }
}

function handleMouseMove(e: MouseEvent) {
  if (!isPanning.value) return
  const rect = svgRef.value?.getBoundingClientRect()
  if (!rect) return

  const dx = ((e.clientX - panStart.value.x) / rect.width) * viewBox.value.w
  const dy = ((e.clientY - panStart.value.y) / rect.height) * viewBox.value.h

  viewBox.value = {
    ...viewBox.value,
    x: viewBoxStart.value.x - dx,
    y: viewBoxStart.value.y - dy
  }
}

function handleMouseUp() {
  isPanning.value = false
}

function handleNodeClick(node: GraphNode) {
  selectedNodeId.value = selectedNodeId.value === node.id ? null : node.id
  if (props.onNodeClick) {
    props.onNodeClick(node)
  }
}

function handleNodeEnter(nodeId: string) {
  hoveredNodeId.value = nodeId
}

function handleNodeLeave() {
  hoveredNodeId.value = null
}

function isNodeHighlighted(nodeId: string): boolean {
  if (props.highlightNodeId && props.highlightNodeId === nodeId) return true
  if (selectedNodeId.value === nodeId) return true
  if (hoveredNodeId.value === nodeId) return true
  return false
}

function isNodeConnected(nodeId: string): boolean {
  if (!hoveredNodeId.value && !selectedNodeId.value && !props.highlightNodeId) return false
  const activeId = selectedNodeId.value || hoveredNodeId.value || props.highlightNodeId
  if (!activeId) return false
  if (activeId === nodeId) return false
  return layoutGraph.value.edges.some(
    (e) => (e.source === activeId && e.target === nodeId) || (e.target === activeId && e.source === nodeId)
  )
}

function isEdgeHighlighted(edge: GraphEdge): boolean {
  const activeId = selectedNodeId.value || hoveredNodeId.value || props.highlightNodeId
  if (!activeId) return false
  return edge.source === activeId || edge.target === activeId
}

function getNodeOpacity(nodeId: string): number {
  const activeId = selectedNodeId.value || hoveredNodeId.value || props.highlightNodeId
  if (!activeId) return 1
  if (isNodeHighlighted(nodeId) || isNodeConnected(nodeId)) return 1
  return 0.25
}

function getEdgeOpacity(edge: GraphEdge): number {
  const activeId = selectedNodeId.value || hoveredNodeId.value || props.highlightNodeId
  if (!activeId) return 0.6
  if (isEdgeHighlighted(edge)) return 1
  return 0.1
}

function getEdgePath(edge: GraphEdge): string {
  const source = nodeMap.value.get(edge.source)
  const target = nodeMap.value.get(edge.target)
  if (!source || !target) return ''

  const sx = source.x ?? 0
  const sy = source.y ?? 0
  const tx = target.x ?? 0
  const ty = target.y ?? 0
  const sourceSize = source.size ?? 20
  const targetSize = target.size ?? 20

  const dx = tx - sx
  const dy = ty - sy
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  const ux = dx / dist
  const uy = dy / dist

  const startX = sx + ux * sourceSize
  const startY = sy + uy * sourceSize
  const endX = tx - ux * (targetSize + 8)
  const endY = ty - uy * (targetSize + 8)

  return `M ${startX} ${startY} L ${endX} ${endY}`
}

function getEdgeLabelPosition(edge: GraphEdge): { x: number; y: number } {
  const source = nodeMap.value.get(edge.source)
  const target = nodeMap.value.get(edge.target)
  if (!source || !target) return { x: 0, y: 0 }

  const sx = source.x ?? 0
  const sy = source.y ?? 0
  const tx = target.x ?? 0
  const ty = target.y ?? 0

  return {
    x: (sx + tx) / 2,
    y: (sy + ty) / 2 - 8
  }
}

function getSvgData(): string {
  if (!svgRef.value) return ''
  const clone = svgRef.value.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(containerWidth.value))
  clone.setAttribute('height', String(containerHeight.value))
  const serializer = new XMLSerializer()
  return serializer.serializeToString(clone)
}

defineExpose({
  getSvgData
})

onMounted(() => {
  handleResize()
  window.addEventListener('resize', handleResize)
})

watch(
  () => props.graph,
  () => {
    nextTick(() => {
      handleResize()
    })
  },
  { deep: true }
)

watch(
  () => props.highlightNodeId,
  (val) => {
    if (val) {
      selectedNodeId.value = null
      hoveredNodeId.value = null
    }
  }
)
</script>

<template>
  <div
    ref="containerRef"
    class="w-full h-full relative select-none"
    :class="{ 'cursor-grabbing': isPanning, 'cursor-grab': !isPanning }"
  >
    <svg
      ref="svgRef"
      class="w-full h-full block"
      :viewBox="`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`"
      @wheel="handleWheel"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
    >
      <defs>
        <marker
          id="arrowhead-default"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#8B7355" />
        </marker>
        <marker
          id="arrowhead-highlight"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#1D4E89" />
        </marker>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g>
        <path
          v-for="edge in layoutGraph.edges"
          :key="edge.id"
          :d="getEdgePath(edge)"
          fill="none"
          :stroke="isEdgeHighlighted(edge) ? '#1D4E89' : '#8B7355'"
          :stroke-width="isEdgeHighlighted(edge) ? 2.5 : 1.5"
          :stroke-opacity="getEdgeOpacity(edge)"
          :marker-end="isEdgeHighlighted(edge) ? 'url(#arrowhead-highlight)' : 'url(#arrowhead-default)'"
          style="transition: stroke-opacity 0.2s, stroke-width 0.2s"
        />

        <g
          v-for="edge in layoutGraph.edges"
          :key="`label-${edge.id}`"
          :transform="`translate(${getEdgeLabelPosition(edge).x}, ${getEdgeLabelPosition(edge).y})`"
          :style="{ opacity: getEdgeOpacity(edge), transition: 'opacity 0.2s' }"
        >
          <rect
            :x="-(edge.label?.length ?? 0) * 6 - 6"
            y="-10"
            :width="(edge.label?.length ?? 0) * 12 + 12"
            height="18"
            rx="4"
            fill="white"
            fill-opacity="0.9"
            stroke="#D4C4A8"
            stroke-width="0.5"
          />
          <text
            text-anchor="middle"
            dominant-baseline="middle"
            font-size="11"
            fill="#5c4a3a"
            font-weight="500"
          >
            {{ edge.label }}
          </text>
        </g>
      </g>

      <g>
        <g
          v-for="node in layoutGraph.nodes"
          :key="node.id"
          :transform="`translate(${node.x ?? 0}, ${node.y ?? 0})`"
          :style="{ cursor: 'pointer', opacity: getNodeOpacity(node.id), transition: 'opacity 0.2s' }"
          @click.stop="handleNodeClick(node)"
          @mouseenter.stop="handleNodeEnter(node.id)"
          @mouseleave.stop="handleNodeLeave"
        >
          <circle
            :r="(node.size ?? 20) + (isNodeHighlighted(node.id) ? 4 : 0)"
            fill="white"
            :stroke="NODE_COLORS[node.type]"
            :stroke-width="isNodeHighlighted(node.id) ? 3 : 2"
            :filter="isNodeHighlighted(node.id) ? 'url(#glow)' : undefined"
            style="transition: r 0.2s, stroke-width 0.2s"
          />
          <circle
            :r="node.size ?? 20"
            :fill="NODE_COLORS[node.type]"
            style="transition: r 0.2s"
          />
          <text
            text-anchor="middle"
            dominant-baseline="central"
            :font-size="(node.size ?? 20) * 0.9"
            fill="white"
            font-weight="bold"
            :y="1"
          >
            {{ NODE_ICONS[node.type] }}
          </text>

          <g :transform="`translate(0, ${(node.size ?? 20) + 16})`">
            <rect
              :x="-(node.label.length) * 6 - 8"
              y="-11"
              :width="node.label.length * 12 + 16"
              height="20"
              rx="10"
              fill="white"
              fill-opacity="0.95"
              :stroke="isNodeHighlighted(node.id) ? NODE_COLORS[node.type] : '#D4C4A8'"
              stroke-width="1"
            />
            <text
              text-anchor="middle"
              dominant-baseline="middle"
              font-size="12"
              :fill="isNodeHighlighted(node.id) ? NODE_COLORS[node.type] : '#3D2B1F'"
              font-weight="500"
            >
              {{ node.label }}
            </text>
          </g>
        </g>
      </g>
    </svg>

    <div
      class="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-[#D4C4A8] p-3"
      style="min-width: 140px"
    >
      <div class="text-xs font-semibold text-[#3D2B1F] mb-2 flex items-center gap-1">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
        图例
      </div>
      <div class="space-y-1.5">
        <div
          v-for="type in uniqueNodeTypes"
          :key="type"
          class="flex items-center gap-2"
        >
          <span
            class="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] font-bold"
            :style="{ backgroundColor: NODE_COLORS[type] }"
          >
            {{ NODE_ICONS[type] }}
          </span>
          <span class="text-xs text-[#5c4a3a]">
            {{ NODE_TYPE_LABELS[type] }}
          </span>
        </div>
      </div>
    </div>

    <div class="absolute bottom-3 left-3 flex items-center gap-2 text-[11px] text-[#8B7355] bg-white/80 backdrop-blur-sm px-2.5 py-1.5 rounded-md border border-[#D4C4A8]">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
      </svg>
      滚轮缩放 · 拖拽平移 · 点击节点
    </div>
  </div>
</template>
