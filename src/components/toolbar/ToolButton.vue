<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  active?: boolean
  disabled?: boolean
  title?: string
}>()

const emit = defineEmits<{
  (e: 'click'): void
}>()

const buttonClass = computed(() => [
  'w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200',
  {
    'bg-[#C41E3A] text-white shadow-md': props.active,
    'bg-white hover:bg-[#F5F0E6] text-[#3D2B1F] border border-[#D4C4A8]': !props.active && !props.disabled,
    'opacity-50 cursor-not-allowed bg-gray-100': props.disabled
  }
])
</script>

<template>
  <button
    :class="buttonClass"
    :title="title"
    :disabled="disabled"
    @click="emit('click')"
  >
    <slot />
  </button>
</template>
