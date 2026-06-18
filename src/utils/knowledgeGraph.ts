import type {
  AnnotationScheme,
  EngraverStyleProfile,
  VersionDiffSummary,
  SameEngraverAssociation,
  ManualRevision,
  JudgmentEvidence,
  KnowledgeGraph,
  GraphNode,
  GraphEdge,
  GraphNodeType,
  GraphEdgeType,
  ConfidenceSnapshot,
  ConfidenceLevel,
  ResearcherOpinion,
  DissentGroup,
  VersionEvolutionChain,
  VersionEvolutionNode
} from '../types'
import { generateId } from './geometry'
import { calculateProfileSimilarity } from './styleAnalysis'

const NODE_COLORS: Record<GraphNodeType, string> = {
  scheme: '#1D4E89',
  style_profile: '#6B4E71',
  blade_path: '#2E5D3B',
  marker: '#C41E3A',
  version_diff: '#8B4513',
  association: '#DAA520',
  evidence: '#4682B4',
  revision: '#A0522D',
  researcher: '#708090'
}

const EDGE_LABELS: Record<GraphEdgeType, string> = {
  belongs_to: '属于',
  has_feature: '具有特征',
  references: '引用',
  supports: '支持',
  contradicts: '质疑',
  revises: '修订',
  similar_to: '相似',
  different_from: '差异',
  derived_from: '源自',
  authored_by: '由...研究'
}

function createNode(
  type: GraphNodeType,
  id: string,
  label: string,
  description?: string,
  metadata?: Record<string, any>
): GraphNode {
  return {
    id,
    type,
    label,
    description,
    metadata,
    color: NODE_COLORS[type],
    size: type === 'scheme' || type === 'style_profile' ? 28 : 20
  }
}

function createEdge(
  type: GraphEdgeType,
  source: string,
  target: string,
  weight?: number,
  metadata?: Record<string, any>
): GraphEdge {
  return {
    id: `edge-${source}-${target}-${type}`,
    source,
    target,
    type,
    label: EDGE_LABELS[type],
    weight: weight ?? 1,
    metadata
  }
}

function confidenceToValue(level: ConfidenceLevel): number {
  switch (level) {
    case 'high': return 0.9
    case 'medium': return 0.6
    case 'low': return 0.3
  }
}

export function buildKnowledgeGraph(
  schemes: AnnotationScheme[],
  profiles: EngraverStyleProfile[],
  diffs: VersionDiffSummary[],
  associations: SameEngraverAssociation[],
  revisions: ManualRevision[],
  evidences: JudgmentEvidence[]
): KnowledgeGraph {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const nodeIds = new Set<string>()

  const addNode = (node: GraphNode) => {
    if (!nodeIds.has(node.id)) {
      nodes.push(node)
      nodeIds.add(node.id)
    }
  }

  const addEdge = (edge: GraphEdge) => {
    edges.push(edge)
  }

  const researcherSet = new Set<string>()

  schemes.forEach((scheme) => {
    addNode(createNode('scheme', `scheme-${scheme.id}`, scheme.projectName, `研究员: ${scheme.researcher}`, {
      researcher: scheme.researcher,
      pathCount: scheme.bladePaths?.length ?? 0,
      importedAt: scheme.importedAt
    }))

    if (scheme.researcher) {
      researcherSet.add(scheme.researcher)
    }

    scheme.bladePaths?.forEach((path) => {
      addNode(createNode('blade_path', `path-${scheme.id}-${path.id}`, `刀路 ${path.pathNumber}`, `长度: ${path.length.toFixed(1)}`, {
        schemeId: scheme.id,
        pathNumber: path.pathNumber,
        length: path.length,
        bladeWidth: path.bladeWidth
      }))
      addEdge(createEdge('belongs_to', `path-${scheme.id}-${path.id}`, `scheme-${scheme.id}`))

      if (path.startMarker) {
        addNode(createNode('marker', `marker-${scheme.id}-${path.id}-start`, `起刀标记·${path.pathNumber}`, path.startMarker.label, {
          schemeId: scheme.id,
          pathId: path.id,
          type: 'start'
        }))
        addEdge(createEdge('belongs_to', `marker-${scheme.id}-${path.id}-start`, `path-${scheme.id}-${path.id}`))
      }
      if (path.endMarker) {
        addNode(createNode('marker', `marker-${scheme.id}-${path.id}-end`, `收刀标记·${path.pathNumber}`, path.endMarker.label, {
          schemeId: scheme.id,
          pathId: path.id,
          type: 'end'
        }))
        addEdge(createEdge('belongs_to', `marker-${scheme.id}-${path.id}-end`, `path-${scheme.id}-${path.id}`))
      }
      path.revisionMarkers?.forEach((m, idx) => {
        addNode(createNode('marker', `marker-${scheme.id}-${path.id}-rev-${idx}`, `修版标记·${path.pathNumber}`, m.label, {
          schemeId: scheme.id,
          pathId: path.id,
          type: 'revision'
        }))
        addEdge(createEdge('belongs_to', `marker-${scheme.id}-${path.id}-rev-${idx}`, `path-${scheme.id}-${path.id}`))
      })
    })
  })

  profiles.forEach((profile) => {
    addNode(createNode('style_profile', `profile-${profile.schemeId}`, `风格画像·${profile.schemeName}`, profile.overallStyleDescription, {
      schemeId: profile.schemeId,
      researcher: profile.researcher,
      dominantType: profile.pathMorphology.dominantType,
      styleTags: profile.styleTags
    }))
    addEdge(createEdge('derived_from', `profile-${profile.schemeId}`, `scheme-${profile.schemeId}`))

    if (profile.researcher) {
      researcherSet.add(profile.researcher)
    }
  })

  diffs.forEach((diff) => {
    addNode(createNode('version_diff', `diff-${diff.schemeAId}-${diff.schemeBId}`, `版次对比`, diff.suspectedVersionRelation, {
      schemeA: diff.schemeAName,
      schemeB: diff.schemeBName,
      similarity: diff.overallSimilarity,
      diffCount: diff.diffItems.length
    }))
    addEdge(createEdge('different_from', `diff-${diff.schemeAId}-${diff.schemeBId}`, `scheme-${diff.schemeAId}`, diff.overallSimilarity))
    addEdge(createEdge('different_from', `diff-${diff.schemeAId}-${diff.schemeBId}`, `scheme-${diff.schemeBId}`, diff.overallSimilarity))
  })

  associations.forEach((assoc, idx) => {
    const assocId = `assoc-${assoc.schemeIds.join('-')}`
    addNode(createNode('association', assocId, `同工关联·${idx + 1}`, assoc.analysisNotes, {
      schemeIds: assoc.schemeIds,
      similarity: assoc.similarityScore,
      confidence: assoc.confidence,
      sharedFeatures: assoc.sharedFeatures
    }))
    assoc.schemeIds.forEach((sid) => {
      addEdge(createEdge('similar_to', assocId, `scheme-${sid}`, assoc.similarityScore))
    })
  })

  evidences.forEach((evidence) => {
    const targetNodeId = evidence.targetType === 'style_profile'
      ? `profile-${evidence.targetId}`
      : evidence.targetType === 'version_diff'
        ? `diff-${evidence.targetId}`
        : `assoc-${evidence.targetId}`

    addNode(createNode('evidence', `evidence-${evidence.id}`, `判读依据`, evidence.content, {
      evidenceType: evidence.evidenceType,
      createdBy: evidence.createdBy,
      referencedIds: evidence.referencedIds
    }))
    addEdge(createEdge('supports', `evidence-${evidence.id}`, targetNodeId))

    evidence.referencedIds.forEach((refId) => {
      if (refId.startsWith('marker-') || nodeIds.has(`marker-${refId}`)) {
        addEdge(createEdge('references', `evidence-${evidence.id}`, refId))
      } else {
        const schemeMarkerId = refId.includes('-') ? `marker-${refId}` : refId
        if (nodeIds.has(schemeMarkerId)) {
          addEdge(createEdge('references', `evidence-${evidence.id}`, schemeMarkerId))
        }
      }
    })

    if (evidence.createdBy) {
      researcherSet.add(evidence.createdBy)
    }
  })

  revisions.forEach((revision) => {
    const targetNodeId = revision.targetType === 'style_profile'
      ? `profile-${revision.targetId}`
      : revision.targetType === 'version_diff'
        ? `diff-${revision.targetId}`
        : `assoc-${revision.targetId}`

    addNode(createNode('revision', `revision-${revision.id}`, `修订记录`, revision.reason, {
      fieldName: revision.fieldName,
      revisedBy: revision.revisedBy,
      originalValue: revision.originalValue,
      revisedValue: revision.revisedValue
    }))
    addEdge(createEdge('revises', `revision-${revision.id}`, targetNodeId))

    if (revision.revisedBy) {
      researcherSet.add(revision.revisedBy)
    }
  })

  researcherSet.forEach((researcher) => {
    const researcherId = `researcher-${researcher}`
    addNode(createNode('researcher', researcherId, `研究员·${researcher}`, undefined, { name: researcher }))

    schemes.forEach((scheme) => {
      if (scheme.researcher === researcher) {
        addEdge(createEdge('authored_by', `scheme-${scheme.id}`, researcherId))
      }
    })
    profiles.forEach((profile) => {
      if (profile.researcher === researcher) {
        addEdge(createEdge('authored_by', `profile-${profile.schemeId}`, researcherId))
      }
    })
  })

  return {
    nodes,
    edges,
    generatedAt: Date.now()
  }
}

export function layoutGraphForceDirected(graph: KnowledgeGraph, width: number, height: number): KnowledgeGraph {
  const nodes = graph.nodes.map((n) => ({ ...n }))
  const edges = [...graph.edges]

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const centerX = width / 2
  const centerY = height / 2

  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / nodes.length
    const radius = Math.min(width, height) * 0.3
    node.x = centerX + radius * Math.cos(angle)
    node.y = centerY + radius * Math.sin(angle)
  })

  const iterations = 200
  const repulsionStrength = 5000
  const attractionStrength = 0.01
  const damping = 0.85
  const centerStrength = 0.01

  for (let iter = 0; iter < iterations; iter++) {
    const forces = new Map(nodes.map((n) => [n.id, { fx: 0, fy: 0 }]))

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]
        const dx = (a.x ?? 0) - (b.x ?? 0)
        const dy = (a.y ?? 0) - (b.y ?? 0)
        const distSq = dx * dx + dy * dy + 0.01
        const dist = Math.sqrt(distSq)
        const force = repulsionStrength / distSq
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        const fa = forces.get(a.id)!
        const fb = forces.get(b.id)!
        fa.fx += fx
        fa.fy += fy
        fb.fx -= fx
        fb.fy -= fy
      }
    }

    edges.forEach((edge) => {
      const source = nodeMap.get(edge.source)
      const target = nodeMap.get(edge.target)
      if (!source || !target) return
      const dx = (target.x ?? 0) - (source.x ?? 0)
      const dy = (target.y ?? 0) - (source.y ?? 0)
      const dist = Math.sqrt(dx * dx + dy * dy) + 0.01
      const weight = edge.weight ?? 1
      const force = dist * attractionStrength * (0.5 + weight * 0.5)
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      const fs = forces.get(source.id)!
      const ft = forces.get(target.id)!
      fs.fx += fx
      fs.fy += fy
      ft.fx -= fx
      ft.fy -= fy
    })

    nodes.forEach((node) => {
      const f = forces.get(node.id)!
      const cx = centerX - (node.x ?? 0)
      const cy = centerY - (node.y ?? 0)
      f.fx += cx * centerStrength
      f.fy += cy * centerStrength
      node.x = (node.x ?? 0) + f.fx * damping
      node.y = (node.y ?? 0) + f.fy * damping
      node.x = Math.max(40, Math.min(width - 40, node.x!))
      node.y = Math.max(40, Math.min(height - 40, node.y!))
    })
  }

  return {
    nodes,
    edges,
    generatedAt: graph.generatedAt
  }
}

export function createConfidenceSnapshot(
  targetType: 'style_profile' | 'version_diff' | 'association',
  targetId: string,
  confidenceLevel: ConfidenceLevel,
  recordedBy: string,
  reason?: string,
  evidenceIds: string[] = [],
  revisionIds: string[] = [],
  customValue?: number
): ConfidenceSnapshot {
  return {
    id: generateId(),
    targetType,
    targetId,
    confidenceValue: customValue ?? confidenceToValue(confidenceLevel),
    confidenceLevel,
    recordedAt: Date.now(),
    recordedBy,
    reason,
    evidenceIds,
    revisionIds
  }
}

export function computeConfidenceFromContext(
  evidences: JudgmentEvidence[],
  revisions: ManualRevision[],
  baseConfidence: ConfidenceLevel
): { value: number; level: ConfidenceLevel } {
  const baseValue = confidenceToValue(baseConfidence)
  const evidenceBoost = Math.min(0.2, evidences.length * 0.05)
  const revisionImpact = revisions.length > 0 ? -0.05 : 0
  let value = Math.max(0, Math.min(1, baseValue + evidenceBoost + revisionImpact))

  let level: ConfidenceLevel = 'low'
  if (value >= 0.8) level = 'high'
  else if (value >= 0.5) level = 'medium'

  return { value, level }
}

export function collectResearcherOpinions(
  profiles: EngraverStyleProfile[],
  diffs: VersionDiffSummary[],
  associations: SameEngraverAssociation[],
  revisions: ManualRevision[],
  evidences: JudgmentEvidence[]
): DissentGroup[] {
  const groups: DissentGroup[] = []

  const opinions: Map<string, ResearcherOpinion[]> = new Map()

  const addOpinion = (key: string, op: ResearcherOpinion) => {
    if (!opinions.has(key)) opinions.set(key, [])
    opinions.get(key)!.push(op)
  }

  profiles.forEach((profile) => {
    const schemeEvidences = evidences.filter((e) => e.targetType === 'style_profile' && e.targetId === profile.schemeId)
    const schemeRevisions = revisions.filter((r) => r.targetType === 'style_profile' && r.targetId === profile.schemeId)

    if (profile.researcher) {
      const { value } = computeConfidenceFromContext(schemeEvidences, schemeRevisions, 'medium')
      addOpinion(`profile-${profile.schemeId}`, {
        researcher: profile.researcher,
        targetType: 'style_profile',
        targetId: profile.schemeId,
        judgment: profile.overallStyleDescription,
        confidence: value >= 0.8 ? 'high' : value >= 0.5 ? 'medium' : 'low',
        confidenceValue: value,
        reasoning: `基于 ${profile.pathMorphology.totalPaths} 条刀路的自动风格分析`,
        evidenceIds: schemeEvidences.map((e) => e.id),
        createdAt: profile.generatedAt
      })
    }

    schemeRevisions.forEach((rev) => {
      const existingIdx = opinions.get(`profile-${profile.schemeId}`)?.findIndex((o) => o.researcher === rev.revisedBy)
      if (existingIdx !== undefined && existingIdx >= 0) {
        const existing = opinions.get(`profile-${profile.schemeId}`)![existingIdx]
        opinions.get(`profile-${profile.schemeId}`)![existingIdx] = {
          ...existing,
          judgment: rev.revisedValue,
          reasoning: rev.reason,
          createdAt: rev.revisedAt
        }
      } else {
        addOpinion(`profile-${profile.schemeId}`, {
          researcher: rev.revisedBy,
          targetType: 'style_profile',
          targetId: profile.schemeId,
          judgment: rev.revisedValue,
          confidence: 'medium',
          confidenceValue: 0.6,
          reasoning: rev.reason,
          evidenceIds: schemeEvidences.map((e) => e.id),
          createdAt: rev.revisedAt
        })
      }
    })
  })

  diffs.forEach((diff) => {
    const diffId = `${diff.schemeAId}-${diff.schemeBId}`
    const diffEvidences = evidences.filter((e) => e.targetType === 'version_diff' && e.targetId === diffId)
    const diffRevisions = revisions.filter((r) => r.targetType === 'version_diff' && r.targetId === diffId)
    const sim = diff.overallSimilarity
    const level: ConfidenceLevel = sim >= 0.85 ? 'high' : sim >= 0.7 ? 'medium' : 'low'

    addOpinion(`diff-${diffId}`, {
      researcher: '自动分析',
      targetType: 'version_diff',
      targetId: diffId,
      judgment: diff.suspectedVersionRelation,
      confidence: level,
      confidenceValue: sim,
      reasoning: diff.summaryText,
      evidenceIds: diffEvidences.map((e) => e.id),
      createdAt: diff.generatedAt
    })

    diffRevisions.forEach((rev) => {
      addOpinion(`diff-${diffId}`, {
        researcher: rev.revisedBy,
        targetType: 'version_diff',
        targetId: diffId,
        judgment: rev.revisedValue,
        confidence: 'medium',
        confidenceValue: 0.6,
        reasoning: rev.reason,
        evidenceIds: diffEvidences.map((e) => e.id),
        createdAt: rev.revisedAt
      })
    })
  })

  associations.forEach((assoc) => {
    const assocId = assoc.schemeIds.join('-')
    const assocEvidences = evidences.filter((e) => e.targetType === 'association' && e.targetId === assocId)
    const assocRevisions = revisions.filter((r) => r.targetType === 'association' && r.targetId === assocId)

    addOpinion(`assoc-${assocId}`, {
      researcher: '自动分析',
      targetType: 'association',
      targetId: assocId,
      judgment: assoc.analysisNotes,
      confidence: assoc.confidence,
      confidenceValue: assoc.similarityScore,
      reasoning: `共同特征: ${assoc.sharedFeatures.join(', ')}`,
      evidenceIds: assocEvidences.map((e) => e.id),
      createdAt: Date.now()
    })

    assocRevisions.forEach((rev) => {
      addOpinion(`assoc-${assocId}`, {
        researcher: rev.revisedBy,
        targetType: 'association',
        targetId: assocId,
        judgment: rev.revisedValue,
        confidence: 'medium',
        confidenceValue: 0.6,
        reasoning: rev.reason,
        evidenceIds: assocEvidences.map((e) => e.id),
        createdAt: rev.revisedAt
      })
    })
  })

  opinions.forEach((opList, key) => {
    const first = opList[0]
    const uniqueResearchers = new Set(opList.map((o) => o.researcher))

    const judgmentCounts = new Map<string, number>()
    opList.forEach((o) => {
      judgmentCounts.set(o.judgment, (judgmentCounts.get(o.judgment) ?? 0) + 1)
    })
    let dominantJudgment: string | undefined
    let maxCount = 0
    judgmentCounts.forEach((count, j) => {
      if (count > maxCount) {
        maxCount = count
        dominantJudgment = j
      }
    })

    const consensusLevel = uniqueResearchers.size <= 1 ? 1 : maxCount / opList.length

    let targetLabel = ''
    if (first.targetType === 'style_profile') {
      const p = profiles.find((x) => x.schemeId === first.targetId)
      targetLabel = p ? `风格画像·${p.schemeName}` : first.targetId
    } else if (first.targetType === 'version_diff') {
      const d = diffs.find((x) => `${x.schemeAId}-${x.schemeBId}` === first.targetId)
      targetLabel = d ? `版次对比·${d.schemeAName}↔${d.schemeBName}` : first.targetId
    } else {
      const a = associations.find((x) => x.schemeIds.join('-') === first.targetId)
      targetLabel = a ? `同工关联·${a.schemeNames.join('↔')}` : first.targetId
    }

    groups.push({
      id: key,
      targetType: first.targetType,
      targetId: first.targetId,
      targetLabel,
      opinions: opList,
      consensusLevel,
      dominantJudgment
    })
  })

  return groups.sort((a, b) => a.consensusLevel - b.consensusLevel)
}

export function buildVersionEvolutionChains(
  profiles: EngraverStyleProfile[],
  diffs: VersionDiffSummary[],
  associations: SameEngraverAssociation[]
): VersionEvolutionChain[] {
  if (profiles.length === 0) return []

  const chains: VersionEvolutionChain[] = []
  const visited = new Set<string>()

  const similarityMatrix = new Map<string, Map<string, number>>()
  profiles.forEach((a) => {
    similarityMatrix.set(a.schemeId, new Map())
    profiles.forEach((b) => {
      if (a.schemeId !== b.schemeId) {
        const sim = calculateProfileSimilarity(a, b)
        similarityMatrix.get(a.schemeId)!.set(b.schemeId, sim)
      }
    })
  })

  diffs.forEach((d) => {
    if (!similarityMatrix.has(d.schemeAId)) similarityMatrix.set(d.schemeAId, new Map())
    similarityMatrix.get(d.schemeAId)!.set(d.schemeBId, d.overallSimilarity)
    if (!similarityMatrix.has(d.schemeBId)) similarityMatrix.set(d.schemeBId, new Map())
    similarityMatrix.get(d.schemeBId)!.set(d.schemeAId, d.overallSimilarity)
  })

  const buildChain = (rootId: string): VersionEvolutionChain => {
    const rootProfile = profiles.find((p) => p.schemeId === rootId)!
    const nodes: VersionEvolutionNode[] = []
    const nodeMap = new Map<string, VersionEvolutionNode>()
    const queue: Array<{ id: string; generation: number }> = [{ id: rootId, generation: 0 }]

    while (queue.length > 0) {
      const { id, generation } = queue.shift()!
      if (nodeMap.has(id)) continue
      visited.add(id)

      const profile = profiles.find((p) => p.schemeId === id)
      if (!profile) continue

      const predecessors: string[] = []
      let similarityToPredecessor: number | undefined

      if (generation > 0) {
        const sims = similarityMatrix.get(id) ?? new Map()
        let bestPred = ''
        let bestSim = 0
        nodeMap.forEach((_, nid) => {
          const s = sims.get(nid) ?? similarityMatrix.get(nid)?.get(id) ?? 0
          if (s > bestSim && s >= 0.5) {
            bestSim = s
            bestPred = nid
          }
        })
        if (bestPred) {
          predecessors.push(bestPred)
          similarityToPredecessor = bestSim
          if (nodeMap.has(bestPred)) {
            nodeMap.get(bestPred)!.successors.push(id)
          }
        }
      }

      let relationType: VersionEvolutionNode['relationType'] = 'different_work'
      if (similarityToPredecessor !== undefined) {
        if (similarityToPredecessor >= 0.9) relationType = 'same_edition'
        else if (similarityToPredecessor >= 0.75) relationType = 'revised_edition'
        else if (similarityToPredecessor >= 0.55) relationType = 'derived_edition'
      }

      const node: VersionEvolutionNode = {
        schemeId: id,
        schemeName: profile.schemeName,
        order: nodes.length,
        generation,
        predecessors,
        successors: [],
        relationType,
        similarityToPredecessor
      }
      nodes.push(node)
      nodeMap.set(id, node)

      const sims = similarityMatrix.get(id) ?? new Map()
      sims.forEach((sim, nid) => {
        if (!nodeMap.has(nid) && sim >= 0.55) {
          queue.push({ id: nid, generation: generation + 1 })
        }
      })
    }

    associations.forEach((assoc) => {
      assoc.schemeIds.forEach((sid, i) => {
        if (nodeMap.has(sid)) {
          assoc.schemeIds.forEach((other, j) => {
            if (i !== j && nodeMap.has(other) && !nodeMap.get(sid)!.successors.includes(other)) {
            }
          })
        }
      })
    })

    let maxGeneration = 0
    nodes.forEach((n) => {
      maxGeneration = Math.max(maxGeneration, n.generation)
    })

    return {
      id: `chain-${rootId}`,
      rootSchemeId: rootId,
      rootSchemeName: rootProfile.schemeName,
      nodes: nodes.sort((a, b) => a.generation - b.generation || a.order - b.order),
      totalGenerations: maxGeneration + 1,
      description: `以「${rootProfile.schemeName}」为根的版本演化链，共 ${nodes.length} 个版本，${maxGeneration + 1} 代`
    }
  }

  profiles.forEach((p) => {
    if (!visited.has(p.schemeId)) {
      const chain = buildChain(p.schemeId)
      if (chain.nodes.length > 0) {
        chains.push(chain)
      }
    }
  })

  return chains.sort((a, b) => b.nodes.length - a.nodes.length)
}

export { NODE_COLORS, EDGE_LABELS }
