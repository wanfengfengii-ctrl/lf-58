import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Layer } from '../types'
import { generateId } from '../utils/geometry'

const LAYER_COLORS = [
  '#C41E3A',
  '#1D4E89',
  '#2E5D3B',
  '#E8A838',
  '#6B4E71',
  '#D35400',
  '#16A085',
  '#8E44AD'
]

export const useLayerStore = defineStore('layer', () => {
  const layers = ref<Layer[]>([])
  const projectId = ref<string>('')

  const sortedLayers = computed(() => {
    return [...layers.value].sort((a, b) => a.order - b.order)
  })

  const visibleLayers = computed(() => {
    return sortedLayers.value.filter((l) => l.visible)
  })

  const visibleLayerIds = computed(() => {
    return visibleLayers.value.map((l) => l.id)
  })

  function setProjectId(id: string) {
    projectId.value = id
  }

  function getNextColor(): string {
    const usedColors = layers.value.map((l) => l.color)
    const available = LAYER_COLORS.find((c) => !usedColors.includes(c))
    return available || LAYER_COLORS[layers.value.length % LAYER_COLORS.length]
  }

  function addLayer(name?: string): Layer {
    const newLayer: Layer = {
      id: generateId(),
      projectId: projectId.value,
      name: name || `图层 ${layers.value.length + 1}`,
      color: getNextColor(),
      order: layers.value.length,
      visible: true,
      locked: false,
      createdAt: Date.now()
    }
    layers.value.push(newLayer)
    return newLayer
  }

  function updateLayer(id: string, updates: Partial<Layer>) {
    const index = layers.value.findIndex((l) => l.id === id)
    if (index !== -1) {
      layers.value[index] = { ...layers.value[index], ...updates }
    }
  }

  function deleteLayer(id: string) {
    const index = layers.value.findIndex((l) => l.id === id)
    if (index !== -1) {
      const deletedOrder = layers.value[index].order
      layers.value.splice(index, 1)
      layers.value.forEach((l) => {
        if (l.order > deletedOrder) {
          l.order--
        }
      })
    }
  }

  function moveLayer(id: string, direction: 'up' | 'down') {
    const index = layers.value.findIndex((l) => l.id === id)
    if (index === -1) return

    const current = layers.value[index]
    if (direction === 'up' && index > 0) {
      const prev = layers.value[index - 1]
      const tempOrder = current.order
      current.order = prev.order
      prev.order = tempOrder
    } else if (direction === 'down' && index < layers.value.length - 1) {
      const next = layers.value[index + 1]
      const tempOrder = current.order
      current.order = next.order
      next.order = tempOrder
    }
  }

  function toggleVisibility(id: string) {
    const layer = layers.value.find((l) => l.id === id)
    if (layer) {
      layer.visible = !layer.visible
    }
  }

  function toggleLock(id: string) {
    const layer = layers.value.find((l) => l.id === id)
    if (layer) {
      layer.locked = !layer.locked
    }
  }

  function getLayerById(id: string): Layer | undefined {
    return layers.value.find((l) => l.id === id)
  }

  function getLayerColor(id: string): string {
    const layer = layers.value.find((l) => l.id === id)
    return layer?.color || '#C41E3A'
  }

  function setLayers(newLayers: Layer[]) {
    layers.value = newLayers
  }

  function clearLayers() {
    layers.value = []
  }

  return {
    layers,
    projectId,
    sortedLayers,
    visibleLayers,
    visibleLayerIds,
    setProjectId,
    addLayer,
    updateLayer,
    deleteLayer,
    moveLayer,
    toggleVisibility,
    toggleLock,
    getLayerById,
    getLayerColor,
    setLayers,
    clearLayers
  }
})
