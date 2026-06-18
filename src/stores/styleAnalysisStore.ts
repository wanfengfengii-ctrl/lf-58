import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  AnnotationScheme,
  EngraverStyleProfile,
  VersionDiffSummary,
  SameEngraverAssociation,
  ManualRevision,
  JudgmentEvidence,
  StyleAnalysisResult,
  ResearchReport
} from '../types'
import {
  generateEngraverStyleProfile,
  generateVersionDiffSummary,
  findSameEngraverAssociations,
  addManualRevision as createRevision,
  addJudgmentEvidence as createEvidence,
  generateResearchReport as createReport,
  downloadResearchReport
} from '../utils/styleAnalysis'
import { useProjectStore } from './projectStore'
import { useLayerStore } from './layerStore'
import { useBladePathStore } from './bladePathStore'

export const useStyleAnalysisStore = defineStore('styleAnalysis', () => {
  const isAnalyzing = ref(false)
  const importedSchemes = ref<AnnotationScheme[]>([])
  const styleProfiles = ref<EngraverStyleProfile[]>([])
  const versionDiffs = ref<VersionDiffSummary[]>([])
  const associations = ref<SameEngraverAssociation[]>([])
  const manualRevisions = ref<ManualRevision[]>([])
  const evidences = ref<JudgmentEvidence[]>([])
  const selectedProfileId = ref<string | null>(null)
  const selectedDiffId = ref<string | null>(null)
  const selectedAssociationId = ref<string | null>(null)

  const currentResult = computed<StyleAnalysisResult | null>(() => {
    if (styleProfiles.value.length === 0 && versionDiffs.value.length === 0 && associations.value.length === 0) {
      return null
    }
    return {
      styleProfiles: styleProfiles.value,
      versionDiffs: versionDiffs.value,
      associations: associations.value,
      manualRevisions: manualRevisions.value,
      evidences: evidences.value
    }
  })

  const hasAnyAnalysis = computed(() => {
    return styleProfiles.value.length > 0
  })

  function getCurrentScheme(): AnnotationScheme | null {
    const projectStore = useProjectStore()
    const layerStore = useLayerStore()
    const bladePathStore = useBladePathStore()

    if (!projectStore.currentScheme) return null

    return {
      ...projectStore.currentScheme,
      layers: layerStore.sortedLayers,
      bladePaths: bladePathStore.allBladePaths
    }
  }

  function addImportedScheme(scheme: AnnotationScheme) {
    const exists = importedSchemes.value.some((s) => s.id === scheme.id)
    if (!exists) {
      importedSchemes.value.push({ ...scheme, importedAt: Date.now() })
    }
  }

  function removeImportedScheme(schemeId: string) {
    const idx = importedSchemes.value.findIndex((s) => s.id === schemeId)
    if (idx !== -1) {
      importedSchemes.value.splice(idx, 1)
    }
    styleProfiles.value = styleProfiles.value.filter((p) => p.schemeId !== schemeId)
    versionDiffs.value = versionDiffs.value.filter(
      (d) => d.schemeAId !== schemeId && d.schemeBId !== schemeId
    )
  }

  function getAllSchemes(): AnnotationScheme[] {
    const schemes: AnnotationScheme[] = []
    const current = getCurrentScheme()
    if (current) {
      schemes.push(current)
    }
    schemes.push(...importedSchemes.value)
    return schemes
  }

  function generateStyleProfileForScheme(schemeId: string): EngraverStyleProfile | null {
    const schemes = getAllSchemes()
    const scheme = schemes.find((s) => s.id === schemeId)
    if (!scheme) return null

    const existing = styleProfiles.value.find((p) => p.schemeId === schemeId)
    if (existing) return existing

    const profile = generateEngraverStyleProfile(scheme)
    styleProfiles.value.push(profile)
    return profile
  }

  function analyzeCurrentScheme() {
    const current = getCurrentScheme()
    if (!current) return null

    const existing = styleProfiles.value.findIndex((p) => p.schemeId === current.id)
    if (existing !== -1) {
      styleProfiles.value.splice(existing, 1)
    }

    const profile = generateEngraverStyleProfile(current)
    styleProfiles.value.push(profile)
    return profile
  }

  async function analyzeAllSchemes() {
    isAnalyzing.value = true
    try {
      const schemes = getAllSchemes()
      styleProfiles.value = []
      schemes.forEach((scheme) => {
        const profile = generateEngraverStyleProfile(scheme)
        styleProfiles.value.push(profile)
      })
      associations.value = findSameEngraverAssociations(styleProfiles.value)
      versionDiffs.value = []
    } finally {
      isAnalyzing.value = false
    }
  }

  function compareTwoSchemes(schemeAId: string, schemeBId: string): VersionDiffSummary | null {
    if (schemeAId === schemeBId) return null

    let profileA = styleProfiles.value.find((p) => p.schemeId === schemeAId)
    let profileB = styleProfiles.value.find((p) => p.schemeId === schemeBId)

    if (!profileA) profileA = generateStyleProfileForScheme(schemeAId)
    if (!profileB) profileB = generateStyleProfileForScheme(schemeBId)

    if (!profileA || !profileB) return null

    const existing = versionDiffs.value.find(
      (d) =>
        (d.schemeAId === schemeAId && d.schemeBId === schemeBId) ||
        (d.schemeAId === schemeBId && d.schemeBId === schemeAId)
    )
    if (existing) return existing

    const diff = generateVersionDiffSummary(profileA, profileB)
    versionDiffs.value.push(diff)
    return diff
  }

  function findAssociations() {
    associations.value = findSameEngraverAssociations(styleProfiles.value)
  }

  function selectProfile(profileId: string | null) {
    selectedProfileId.value = profileId
    selectedDiffId.value = null
    selectedAssociationId.value = null
  }

  function selectDiff(schemeAId: string, schemeBId: string) {
    const diff = versionDiffs.value.find(
      (d) =>
        (d.schemeAId === schemeAId && d.schemeBId === schemeBId) ||
        (d.schemeAId === schemeBId && d.schemeBId === schemeAId)
    )
    if (diff) {
      selectedDiffId.value = `${diff.schemeAId}-${diff.schemeBId}`
      selectedProfileId.value = null
      selectedAssociationId.value = null
    }
  }

  function selectAssociation(index: number) {
    if (index >= 0 && index < associations.value.length) {
      selectedAssociationId.value = associations.value[index].schemeIds.join('-')
      selectedProfileId.value = null
      selectedDiffId.value = null
    }
  }

  function addManualRevision(
    targetType: 'style_profile' | 'version_diff' | 'association',
    targetId: string,
    fieldName: string,
    originalValue: string,
    revisedValue: string,
    revisedBy: string,
    reason: string
  ) {
    const revision = createRevision(
      targetType,
      targetId,
      fieldName,
      originalValue,
      revisedValue,
      revisedBy,
      reason
    )
    manualRevisions.value.push(revision)
    return revision
  }

  function addJudgmentEvidence(
    targetType: 'style_profile' | 'version_diff' | 'association',
    targetId: string,
    content: string,
    evidenceType: 'text_note' | 'path_reference' | 'marker_reference',
    referencedIds: string[],
    createdBy: string
  ) {
    const evidence = createEvidence(
      targetType,
      targetId,
      content,
      evidenceType,
      referencedIds,
      createdBy
    )
    evidences.value.push(evidence)
    return evidence
  }

  function getEvidencesForTarget(
    targetType: 'style_profile' | 'version_diff' | 'association',
    targetId: string
  ) {
    return evidences.value.filter(
      (e) => e.targetType === targetType && e.targetId === targetId
    )
  }

  function getRevisionsForTarget(
    targetType: 'style_profile' | 'version_diff' | 'association',
    targetId: string
  ) {
    return manualRevisions.value.filter(
      (r) => r.targetType === targetType && r.targetId === targetId
    )
  }

  function updateStyleProfileField(profileId: string, field: string, value: string, revisedBy: string, reason: string) {
    const idx = styleProfiles.value.findIndex((p) => p.schemeId === profileId)
    if (idx === -1) return

    const profile = styleProfiles.value[idx]
    const originalValue = (profile as any)[field]?.toString() || ''

    addManualRevision('style_profile', profileId, field, originalValue, value, revisedBy, reason)

    if (field === 'overallStyleDescription') {
      profile.overallStyleDescription = value
    } else if (field === 'styleTags') {
      profile.styleTags = value.split(',').map((t) => t.trim()).filter(Boolean)
    }
  }

  function updateVersionDiffField(diffId: string, field: string, value: string, revisedBy: string, reason: string) {
    const [aId, bId] = diffId.split('-')
    const diff = versionDiffs.value.find(
      (d) =>
        (d.schemeAId === aId && d.schemeBId === bId) ||
        (d.schemeAId === bId && d.schemeBId === aId)
    )
    if (!diff) return

    const originalValue = (diff as any)[field]?.toString() || ''
    addManualRevision('version_diff', diffId, field, originalValue, value, revisedBy, reason)

    if (field === 'summaryText') {
      diff.summaryText = value
    } else if (field === 'suspectedVersionRelation') {
      diff.suspectedVersionRelation = value
    }
  }

  function updateAssociationField(assocId: string, field: string, value: string, revisedBy: string, reason: string) {
    const ids = assocId.split('-')
    const assoc = associations.value.find(
      (a) => a.schemeIds.every((id, i) => id === ids[i]) || a.schemeIds.join('-') === assocId
    )
    if (!assoc) return

    const originalValue = (assoc as any)[field]?.toString() || ''
    addManualRevision('association', assocId, field, originalValue, value, revisedBy, reason)

    if (field === 'analysisNotes') {
      assoc.analysisNotes = value
    } else if (field === 'sharedFeatures') {
      assoc.sharedFeatures = value.split(',').map((t) => t.trim()).filter(Boolean)
    } else if (field === 'distinctiveFeatures') {
      assoc.distinctiveFeatures = value.split(',').map((t) => t.trim()).filter(Boolean)
    }
  }

  function generateReport(title: string, generatedBy: string, additionalNotes: string): ResearchReport {
    return createReport(
      title,
      generatedBy,
      styleProfiles.value,
      versionDiffs.value,
      associations.value,
      manualRevisions.value,
      evidences.value,
      additionalNotes
    )
  }

  function exportReport(title: string, generatedBy: string, additionalNotes: string) {
    const report = generateReport(title, generatedBy, additionalNotes)
    downloadResearchReport(report)
  }

  function clearAll() {
    styleProfiles.value = []
    versionDiffs.value = []
    associations.value = []
    manualRevisions.value = []
    evidences.value = []
    importedSchemes.value = []
    selectedProfileId.value = null
    selectedDiffId.value = null
    selectedAssociationId.value = null
  }

  return {
    isAnalyzing,
    importedSchemes,
    styleProfiles,
    versionDiffs,
    associations,
    manualRevisions,
    evidences,
    selectedProfileId,
    selectedDiffId,
    selectedAssociationId,
    currentResult,
    hasAnyAnalysis,
    getCurrentScheme,
    addImportedScheme,
    removeImportedScheme,
    getAllSchemes,
    generateStyleProfileForScheme,
    analyzeCurrentScheme,
    analyzeAllSchemes,
    compareTwoSchemes,
    findAssociations,
    selectProfile,
    selectDiff,
    selectAssociation,
    addManualRevision,
    addJudgmentEvidence,
    getEvidencesForTarget,
    getRevisionsForTarget,
    updateStyleProfileField,
    updateVersionDiffField,
    updateAssociationField,
    generateReport,
    exportReport,
    clearAll
  }
})
