import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  SchemeVersion,
  ReviewComment,
  MergeProposal,
  DiffAnalysisResult,
  DiffType,
  AnnotationScheme,
  DiffDetail
} from '../types'
import { generateId } from '../utils/geometry'
import { analyzeSchemeDiff } from '../utils/diffAnalysis'
import { useProjectStore } from './projectStore'
import { useLayerStore } from './layerStore'
import { useBladePathStore } from './bladePathStore'

export const useCollaborationStore = defineStore('collaboration', () => {
  const versions = ref<SchemeVersion[]>([])
  const comments = ref<ReviewComment[]>([])
  const mergeProposals = ref<MergeProposal[]>([])
  const activeDiffResult = ref<DiffAnalysisResult | null>(null)
  const selectedDiffTypes = ref<DiffType[]>([])
  const currentReviewer = ref('主复核员')

  const versionsByScheme = computed(() => {
    const projectStore = useProjectStore()
    const schemeId = projectStore.currentScheme?.id
    if (!schemeId) return []
    return versions.value
      .filter((v) => v.schemeId === schemeId)
      .sort((a, b) => b.versionNumber - a.versionNumber)
  })

  const latestVersion = computed(() => {
    return versionsByScheme.value[0] || null
  })

  const openComments = computed(() => {
    const projectStore = useProjectStore()
    const schemeId = projectStore.currentScheme?.id
    if (!schemeId) return []
    return comments.value.filter(
      (c) => c.schemeId === schemeId && c.status === 'open'
    )
  })

  const pendingMergeProposals = computed(() => {
    return mergeProposals.value.filter((m) => m.status === 'pending')
  })

  function createVersion(
    name: string,
    description: string,
    tags: string[] = []
  ): SchemeVersion {
    const projectStore = useProjectStore()
    const layerStore = useLayerStore()
    const bladePathStore = useBladePathStore()

    if (!projectStore.currentScheme) {
      throw new Error('没有可保存版本的方案')
    }

    const existingVersions = versions.value.filter(
      (v) => v.schemeId === projectStore.currentScheme!.id
    )
    const nextVersionNumber = existingVersions.length + 1

    const snapshot: AnnotationScheme = {
      ...projectStore.currentScheme,
      layers: [...layerStore.sortedLayers],
      bladePaths: bladePathStore.allBladePaths.map((p) => ({ ...p }))
    }

    const version: SchemeVersion = {
      id: generateId(),
      schemeId: projectStore.currentScheme.id,
      versionNumber: nextVersionNumber,
      name,
      description,
      researcher: projectStore.researcher,
      snapshot,
      createdAt: Date.now(),
      parentVersionId: latestVersion.value?.id,
      tags
    }

    versions.value.push(version)
    return version
  }

  function restoreVersion(versionId: string): boolean {
    const version = versions.value.find((v) => v.id === versionId)
    if (!version) return false

    const projectStore = useProjectStore()
    const layerStore = useLayerStore()
    const bladePathStore = useBladePathStore()

    const snapshot = version.snapshot

    if (projectStore.currentScheme) {
      projectStore.currentScheme = { ...snapshot, id: projectStore.currentScheme.id }
    }

    layerStore.setLayers(snapshot.layers)
    bladePathStore.setBladePaths(snapshot.bladePaths)

    return true
  }

  function deleteVersion(versionId: string): boolean {
    const index = versions.value.findIndex((v) => v.id === versionId)
    if (index === -1) return false
    versions.value.splice(index, 1)
    return true
  }

  function addComment(
    content: string,
    pathId?: string,
    pathNumber?: string
  ): ReviewComment {
    const projectStore = useProjectStore()
    if (!projectStore.currentScheme) {
      throw new Error('没有可添加评论的方案')
    }

    const comment: ReviewComment = {
      id: generateId(),
      schemeId: projectStore.currentScheme.id,
      pathId,
      pathNumber,
      author: currentReviewer.value,
      content,
      status: 'open',
      createdAt: Date.now(),
      replies: []
    }

    comments.value.push(comment)
    return comment
  }

  function replyToComment(
    commentId: string,
    content: string
  ): ReviewComment | null {
    const parentComment = comments.value.find((c) => c.id === commentId)
    if (!parentComment) return null

    const reply: ReviewComment = {
      id: generateId(),
      schemeId: parentComment.schemeId,
      pathId: parentComment.pathId,
      pathNumber: parentComment.pathNumber,
      author: currentReviewer.value,
      content,
      status: 'open',
      createdAt: Date.now(),
      replies: []
    }

    parentComment.replies.push(reply)
    return reply
  }

  function resolveComment(commentId: string): boolean {
    const comment = comments.value.find((c) => c.id === commentId)
    if (!comment) return false

    comment.status = 'resolved'
    comment.resolvedAt = Date.now()
    comment.resolvedBy = currentReviewer.value

    return true
  }

  function rejectComment(commentId: string): boolean {
    const comment = comments.value.find((c) => c.id === commentId)
    if (!comment) return false

    comment.status = 'rejected'
    comment.resolvedAt = Date.now()
    comment.resolvedBy = currentReviewer.value

    return true
  }

  function getCommentsByPath(pathId: string): ReviewComment[] {
    return comments.value.filter((c) => c.pathId === pathId)
  }

  function analyzeDiff(
    schemeA: AnnotationScheme,
    schemeB: AnnotationScheme
  ): DiffAnalysisResult {
    const result = analyzeSchemeDiff(schemeA, schemeB)
    activeDiffResult.value = result
    return result
  }

  function clearDiffResult(): void {
    activeDiffResult.value = null
  }

  function toggleDiffType(type: DiffType): void {
    const index = selectedDiffTypes.value.indexOf(type)
    if (index === -1) {
      selectedDiffTypes.value.push(type)
    } else {
      selectedDiffTypes.value.splice(index, 1)
    }
  }

  function getFilteredDiffs(): DiffDetail[] {
    if (!activeDiffResult.value) return []
    if (selectedDiffTypes.value.length === 0) {
      return activeDiffResult.value.diffs
    }
    return activeDiffResult.value.diffs.filter((d) =>
      selectedDiffTypes.value.includes(d.type)
    )
  }

  function createMergeProposal(
    sourceSchemeId: string,
    targetSchemeId: string,
    title: string,
    description: string,
    reviewers: string[] = []
  ): MergeProposal {
    const projectStore = useProjectStore()

    const proposal: MergeProposal = {
      id: generateId(),
      sourceSchemeId,
      targetSchemeId,
      title,
      description,
      createdBy: currentReviewer.value,
      createdAt: Date.now(),
      status: 'draft',
      selectedPathIds: [],
      reviewers
    }

    mergeProposals.value.push(proposal)
    return proposal
  }

  function submitMergeProposal(proposalId: string): boolean {
    const proposal = mergeProposals.value.find((p) => p.id === proposalId)
    if (!proposal) return false

    const projectStore = useProjectStore()
    const sourceScheme = projectStore.compareSchemes.find(
      (s) => s.id === proposal.sourceSchemeId
    )
    const targetScheme = projectStore.currentScheme

    if (!sourceScheme || !targetScheme) return false

    const diffResult = analyzeDiff(sourceScheme, targetScheme)
    proposal.diffResult = diffResult
    proposal.status = 'pending'

    return true
  }

  function approveMergeProposal(proposalId: string): boolean {
    const proposal = mergeProposals.value.find((p) => p.id === proposalId)
    if (!proposal) return false
    proposal.status = 'approved'
    return true
  }

  function rejectMergeProposal(proposalId: string): boolean {
    const proposal = mergeProposals.value.find((p) => p.id === proposalId)
    if (!proposal) return false
    proposal.status = 'rejected'
    return true
  }

  function setCurrentReviewer(name: string): void {
    currentReviewer.value = name
  }

  function getSchemeForComparison(schemeId: string): AnnotationScheme | null {
    const projectStore = useProjectStore()
    if (projectStore.currentScheme?.id === schemeId) {
      return projectStore.currentScheme
    }
    return projectStore.compareSchemes.find((s) => s.id === schemeId) || null
  }

  function clearAll(): void {
    versions.value = []
    comments.value = []
    mergeProposals.value = []
    activeDiffResult.value = null
    selectedDiffTypes.value = []
  }

  return {
    versions,
    comments,
    mergeProposals,
    activeDiffResult,
    selectedDiffTypes,
    currentReviewer,
    versionsByScheme,
    latestVersion,
    openComments,
    pendingMergeProposals,
    createVersion,
    restoreVersion,
    deleteVersion,
    addComment,
    replyToComment,
    resolveComment,
    rejectComment,
    getCommentsByPath,
    analyzeDiff,
    clearDiffResult,
    toggleDiffType,
    getFilteredDiffs,
    createMergeProposal,
    submitMergeProposal,
    approveMergeProposal,
    rejectMergeProposal,
    setCurrentReviewer,
    getSchemeForComparison,
    clearAll
  }
})
