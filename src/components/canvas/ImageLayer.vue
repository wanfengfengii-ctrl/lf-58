<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useProjectStore } from '../../stores/projectStore'

const props = defineProps<{
  width: number
  height: number
}>()

const projectStore = useProjectStore()
const imageNode = ref<any>(null)
const imageObj = ref<HTMLImageElement | null>(null)

function loadImage() {
  if (!projectStore.currentScheme?.image?.url) {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imageObj.value = img
      if (imageNode.value) {
        imageNode.value.getLayer()?.batchDraw()
      }
    }
    img.src = projectStore.currentScheme.image.url
  }
}

watch(
  () => projectStore.currentScheme?.image?.url,
  () => {
    loadImage()
  }
)

onMounted(() => {
  loadImage()
})
</script>

<template>
  <v-layer>
    <v-rect :width="props.width" :height="props.height" fill="#F5F0E6" />
    <v-image
      v-if="imageObj"
      ref="imageNode"
      :image="imageObj"
      :width="props.width"
      :height="props.height"
      :opacity="0.9"
    />
    <v-rect
      :width="props.width"
      :height="props.height"
      :stroke="'#8B7355'"
      :stroke-width="2"
      :fill-enabled="false"
    />
  </v-layer>
</template>
