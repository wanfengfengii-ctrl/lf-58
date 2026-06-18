<script setup lang="ts">
import { computed } from 'vue'
import type { Marker } from '../../types'

const props = defineProps<{
  marker: Marker
  scale?: number
}>()

const markerColor = computed(() => {
  switch (props.marker.type) {
    case 'start':
      return '#2E5D3B'
    case 'end':
      return '#C41E3A'
    case 'revision':
      return '#E8A838'
    default:
      return '#333'
  }
})

const markerSymbol = computed(() => {
  switch (props.marker.type) {
    case 'start':
      return '起'
    case 'end':
      return '收'
    case 'revision':
      return '修'
    default:
      return ''
  }
})

const radius = computed(() => 10 / (props.scale || 1))

function handleClick(e: Event) {
  e.cancelBubble = true
}
</script>

<template>
  <v-group @click="handleClick">
    <v-circle
      :x="marker.x"
      :y="marker.y"
      :radius="radius"
      :fill="markerColor"
      :stroke="'#fff'"
      :stroke-width="2"
      :opacity="0.9"
    />
    <v-text
      :x="marker.x"
      :y="marker.y"
      :text="markerSymbol"
      :font-size="10"
      :fill="'#fff'"
      :align="'center'"
      :vertical-align="'middle'"
      :offset-y="1"
    />
  </v-group>
</template>
