import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  CarvingExperiment,
  ExperimentRound,
  BladeToolParams,
  PathExecutionOrder,
  ExperimentConclusion,
  SimulationContext,
  AnnotationScheme,
  ExperimentConfig
} from '../types'
import {
  createNewExperiment,
  executeExperimentRound,
  suggestNextRoundParams,
  generateExperimentConclusion,
  finalizeExperiment,
  compareRounds
} from '../utils/carvingExperiment'
import {
  DEFAULT_PRESET_TOOLS,
  DEFAULT_EXPERIMENT_CONFIG,
  generateDefaultExecutionOrders
} from '../utils/carvingSimulation'

export const useCarvingExperimentStore = defineStore('carvingExperiment', () => {
  const experiments = ref<CarvingExperiment[]>([])
  const activeExperimentId = ref<string | null>(null)
  const currentTools = ref<BladeToolParams[]>(JSON.parse(JSON.stringify(DEFAULT_PRESET_TOOLS)))
  const currentOrders = ref<PathExecutionOrder[]>([])
  const experimentConfig = ref<ExperimentConfig>({ ...DEFAULT_EXPERIMENT_CONFIG })
  const isSimulating = ref(false)

  const activeExperiment = computed(() => {
    if (!activeExperimentId.value) return null
    return experiments.value.find((e) => e.id === activeExperimentId.value) || null
  })

  const currentRound = computed(() => {
    if (!activeExperiment.value) return null
    const idx = activeExperiment.value.currentRoundIndex
    if (idx < 0 || idx >= activeExperiment.value.rounds.length) return null
    return activeExperiment.value.rounds[idx]
  })

  const allExperiments = computed(() => experiments.value)

  function setActiveExperiment(id: string | null) {
    activeExperimentId.value = id
    if (id) {
      const exp = experiments.value.find((e) => e.id === id)
      if (exp && exp.rounds.length > 0) {
        const last = exp.rounds[exp.rounds.length - 1]
        currentTools.value = JSON.parse(JSON.stringify(Object.values(last.toolParamsMap)))
        currentOrders.value = JSON.parse(JSON.stringify(last.executionOrders))
      }
    }
  }

  function initDefaultOrders(scheme: AnnotationScheme) {
    currentOrders.value = generateDefaultExecutionOrders(
      scheme.bladePaths || [],
      scheme.layers || []
    )
  }

  function updateToolParams(toolId: string, updates: Partial<BladeToolParams>) {
    const idx = currentTools.value.findIndex((t) => t.id === toolId)
    if (idx !== -1) {
      currentTools.value[idx] = { ...currentTools.value[idx], ...updates }
    }
  }

  function addCustomTool(tool: BladeToolParams) {
    currentTools.value.push(tool)
  }

  function removeTool(toolId: string) {
    currentTools.value = currentTools.value.filter((t) => t.id !== toolId)
  }

  function updateExecutionOrder(pathId: string, updates: Partial<PathExecutionOrder>) {
    const idx = currentOrders.value.findIndex((o) => o.pathId === pathId)
    if (idx !== -1) {
      currentOrders.value[idx] = { ...currentOrders.value[idx], ...updates }
    }
  }

  function updateStrokeConfig(pathId: string, strokeUpdates: Partial<PathExecutionOrder['strokeConfig']>) {
    const idx = currentOrders.value.findIndex((o) => o.pathId === pathId)
    if (idx !== -1) {
      currentOrders.value[idx] = {
        ...currentOrders.value[idx],
        strokeConfig: { ...currentOrders.value[idx].strokeConfig, ...strokeUpdates }
      }
    }
  }

  function moveOrder(pathId: string, newIndex: number) {
    const idx = currentOrders.value.findIndex((o) => o.pathId === pathId)
    if (idx === -1) return
    const [item] = currentOrders.value.splice(idx, 1)
    currentOrders.value.splice(newIndex, 0, item)
    currentOrders.value.forEach((o, i) => { o.orderIndex = i })
  }

  function createExperiment(scheme: AnnotationScheme, createdBy?: string) {
    const exp = createNewExperiment(scheme, createdBy)
    experiments.value.push(exp)
    initDefaultOrders(scheme)
    setActiveExperiment(exp.id)
    return exp
  }

  async function runRound(
    scheme: AnnotationScheme,
    roundName?: string,
    notes?: string
  ): Promise<{ experiment: CarvingExperiment; round: ExperimentRound } | null> {
    if (!activeExperiment.value) return null

    isSimulating.value = true
    try {
      await new Promise((r) => setTimeout(r, 300))

      const result = executeExperimentRound(
        activeExperiment.value,
        scheme,
        JSON.parse(JSON.stringify(currentTools.value)),
        JSON.parse(JSON.stringify(currentOrders.value)),
        experimentConfig.value,
        roundName,
        notes
      )

      const idx = experiments.value.findIndex((e) => e.id === activeExperimentId.value)
      if (idx !== -1) {
        experiments.value[idx] = result.experiment
      }

      isSimulating.value = false
      return result
    } catch (e) {
      isSimulating.value = false
      throw e
    }
  }

  function getSuggestedParams() {
    if (!currentRound.value) return null
    return suggestNextRoundParams(
      currentRound.value,
      currentTools.value,
      currentOrders.value
    )
  }

  function applySuggestedParams() {
    const suggested = getSuggestedParams()
    if (suggested) {
      currentTools.value = suggested.toolParams
      currentOrders.value = suggested.executionOrders
      return suggested.suggestions
    }
    return []
  }

  function selectRound(roundIndex: number) {
    if (!activeExperiment.value) return
    if (roundIndex < 0 || roundIndex >= activeExperiment.value.rounds.length) return
    const idx = experiments.value.findIndex((e) => e.id === activeExperimentId.value)
    if (idx !== -1) {
      experiments.value[idx] = {
        ...experiments.value[idx],
        currentRoundIndex: roundIndex
      }
      const round = experiments.value[idx].rounds[roundIndex]
      currentTools.value = JSON.parse(JSON.stringify(Object.values(round.toolParamsMap)))
      currentOrders.value = JSON.parse(JSON.stringify(round.executionOrders))
    }
  }

  function getRoundComparison(roundAIndex: number, roundBIndex: number) {
    if (!activeExperiment.value) return null
    const a = activeExperiment.value.rounds[roundAIndex]
    const b = activeExperiment.value.rounds[roundBIndex]
    if (!a || !b) return null
    return compareRounds(a, b)
  }

  function generateConclusion(): ExperimentConclusion | null {
    if (!activeExperiment.value) return null
    return generateExperimentConclusion(activeExperiment.value)
  }

  function completeExperiment() {
    if (!activeExperiment.value) return null
    const idx = experiments.value.findIndex((e) => e.id === activeExperimentId.value)
    if (idx !== -1) {
      const finalized = finalizeExperiment(experiments.value[idx])
      experiments.value[idx] = finalized
      return finalized
    }
    return null
  }

  function resetExperiment() {
    currentTools.value = JSON.parse(JSON.stringify(DEFAULT_PRESET_TOOLS))
    currentOrders.value = []
  }

  function setExperimentConfig(config: Partial<ExperimentConfig>) {
    experimentConfig.value = { ...experimentConfig.value, ...config }
  }

  function getExperimentById(id: string): CarvingExperiment | undefined {
    return experiments.value.find((e) => e.id === id)
  }

  function deleteExperiment(id: string) {
    experiments.value = experiments.value.filter((e) => e.id !== id)
    if (activeExperimentId.value === id) {
      activeExperimentId.value = null
    }
  }

  return {
    experiments,
    activeExperimentId,
    currentTools,
    currentOrders,
    experimentConfig,
    isSimulating,
    activeExperiment,
    currentRound,
    allExperiments,
    setActiveExperiment,
    initDefaultOrders,
    updateToolParams,
    addCustomTool,
    removeTool,
    updateExecutionOrder,
    updateStrokeConfig,
    moveOrder,
    createExperiment,
    runRound,
    getSuggestedParams,
    applySuggestedParams,
    selectRound,
    getRoundComparison,
    generateConclusion,
    completeExperiment,
    resetExperiment,
    setExperimentConfig,
    getExperimentById,
    deleteExperiment
  }
})
