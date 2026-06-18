<script setup lang="ts">
import { computed, ref } from 'vue'
import type { BladePath } from '../../types'
import { useCanvasStore } from '../../stores/canvasStore'
import { useLayerStore } from '../../stores/layerStore'
import { formatLength } from '../../utils/geometry'
import MarkerRenderer from './MarkerRenderer.vue'

const props = defineProps<{
  bladePath: BladePath
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
}>()

const canvasStore = useCanvasStore()
const layerStore = useLayerStore()
const showTooltip = ref(false)
const tooltipPos = ref({ x: 0, y: 0 })

const isSelected = computed(() => canvasStore.selectedPathId === props.bladePath.id)

const strokeColor = computed(() => {
  return layerStore.getLayerColor(props.bladePath.layerId)
})

const strokeWidth = computed(() => {
  const baseWidth = props.bladePath.bladeWidth
  return isSelected.value ? baseWidth + 2 : baseWidth
})

const linePoints = computed(() => {
  return props.bladePath.points.flatMap((p) => [p.x, p.y])
})

const dashEnabled = computed(() => {
  return !props.bladePath.isReviewed ? [5, 3] : []
})

const allMarkers = computed(() => {
  const markers: any[] = []
  if (props.bladePath.startMarker) {
    markers.push(props.bladePath.startMarker)
  }
  if (props.bladePath.endMarker) {
    markers.push(props.bladePath.endMarker)
  }
  markers.push(...props.bladePath.revisionMarkers)
  return markers
})

const midPoint = computed(() => {
  const points = props.bladePath.points
  if (points.length === 0) return { x: 0, y: 0 }
  const midIndex = Math.floor(points.length / 2)
  return points[midIndex]
})

function handleMouseMove(e: any) {
  const pos = e.target.getStage().getPointerPosition()
  tooltipPos.value = { x: pos.x + 10, y: pos.y + 10 }
  showTooltip.value = true
}

function handleMouseLeave() {
  showTooltip.value = false
}

function handleClick(e: Event) {
  e.cancelBubble = true
  emit('select', props.bladePath.id)
}
</script>

<template>
  <v-group>
    <v-line
      :points="linePoints"
      :stroke="strokeColor"
      :stroke-width="strokeWidth"
      :line-cap="'round'"
      :line-join="'round'"
      :dash="dashEnabled"
      :opacity="isSelected ? 1 : 0.85"
      shadow-color="rgba(0,0,0,0.3)"
      shadow-blur="3"
      @click="handleClick"
      @mousemove="handleMouseMove"
      @mouseleave="handleMouseLeave"
    />

    <template v-if="isSelected">
      <v-circle
        v-for="(point, idx) in bladePath.points"
        :key="idx"
        :x="point.x"
        :y="point.y"
        :radius="4"
        :fill="'#fff'"
        :stroke="strokeColor"
        :stroke-width="2"
      />
    </template>

    <template v-for="marker in allMarkers" :key="marker.id">
      <MarkerRenderer :marker="marker" :scale="canvasStore.scale" />
    </template>

    <v-label
      v-if="showTooltip"
      :x="tooltipPos.x / canvasStore.scale - canvasStore.offsetX / canvasStore.scale"
      :y="tooltipPos.y / canvasStore.scale - canvasStore.offsetY / canvasStore.scale"
    >
      <v-tag
        :fill="'rgba(0,0,0,0.85)'"
        :stroke="'none'"
        :pointer-direction="'right'"
        :corner-radius="4"
      >
        <v-text
          :text="`${bladePath.pathNumber} | ${formatLength(bladePath.length)}`"
          :font-size="12"
          :fill="'#fff'"
          :padding="6"
        />
      </v-tag>
    </v-label>

    <v-text
      :x="midPoint.x"
      :y="midPoint.y - 12"
      :text="bladePath.pathNumber"
      :font-size="11"
      :fill="strokeColor"
      :align="'center'"
      :font-weight="'bold'"
    />
  </v-group>
</template>
