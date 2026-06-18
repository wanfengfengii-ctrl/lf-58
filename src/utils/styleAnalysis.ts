import type {
  AnnotationScheme,
  BladePath,
  Layer,
  Point,
  PathMorphologyType,
  BladeCutStyle,
  RevisionDensityLevel,
  ConfidenceLevel,
  PathMorphologyFeature,
  BladeWidthDistribution,
  BladeCutHabit,
  RevisionDensityFeature,
  LayerStructureFeature,
  EngraverStyleProfile,
  VersionDiffSummary,
  VersionDiffItem,
  SameEngraverAssociation,
  ResearchReport,
  JudgmentEvidence,
  ManualRevision
} from '../types'
import { calculatePathLength, generateId } from './geometry'

function calculateAngleBetweenVectors(p1: Point, p2: Point, p3: Point): number {
  const v1x = p2.x - p1.x
  const v1y = p2.y - p1.y
  const v2x = p3.x - p2.x
  const v2y = p3.y - p2.y
  const dot = v1x * v2x + v1y * v2y
  const mag1 = Math.sqrt(v1x * v1x + v1y * v1y)
  const mag2 = Math.sqrt(v2x * v2x + v2y * v2y)
  if (mag1 === 0 || mag2 === 0) return 0
  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)))
  return Math.acos(cos) * (180 / Math.PI)
}

function classifyPathMorphology(points: Point[]): PathMorphologyType {
  if (points.length < 3) return 'smooth'

  let sharpTurns = 0
  let smoothTurns = 0
  const threshold = 45

  for (let i = 1; i < points.length - 1; i++) {
    const angle = calculateAngleBetweenVectors(points[i - 1], points[i], points[i + 1])
    if (angle > threshold) {
      sharpTurns++
    } else if (angle > 10) {
      smoothTurns++
    }
  }

  const totalTurns = sharpTurns + smoothTurns
  if (totalTurns === 0) return 'smooth'
  if (sharpTurns / totalTurns > 0.6) return 'angular'
  if (smoothTurns / totalTurns > 0.6) return 'smooth'
  return 'mixed'
}

export function extractPathMorphology(paths: BladePath[]): PathMorphologyFeature {
  const totalPaths = paths.length
  if (totalPaths === 0) {
    return {
      totalPaths: 0,
      smoothPaths: 0,
      angularPaths: 0,
      mixedPaths: 0,
      avgPathLength: 0,
      avgSegmentLength: 0,
      avgTurningAngle: 0,
      curvatureDistribution: [],
      dominantType: 'mixed'
    }
  }

  let smoothPaths = 0
  let angularPaths = 0
  let mixedPaths = 0
  let totalLength = 0
  let totalSegments = 0
  let totalAngle = 0
  let angleCount = 0
  const angleBuckets = new Array(18).fill(0)

  paths.forEach((path) => {
    const type = classifyPathMorphology(path.points)
    if (type === 'smooth') smoothPaths++
    else if (type === 'angular') angularPaths++
    else mixedPaths++

    totalLength += path.length
    totalSegments += Math.max(1, path.points.length - 1)

    for (let i = 1; i < path.points.length - 1; i++) {
      const angle = calculateAngleBetweenVectors(
        path.points[i - 1],
        path.points[i],
        path.points[i + 1]
      )
      totalAngle += angle
      angleCount++
      const bucketIndex = Math.min(17, Math.floor(angle / 10))
      angleBuckets[bucketIndex]++
    }
  })

  let dominantType: PathMorphologyType = 'mixed'
  const maxCount = Math.max(smoothPaths, angularPaths, mixedPaths)
  if (maxCount === smoothPaths && smoothPaths > 0) dominantType = 'smooth'
  else if (maxCount === angularPaths && angularPaths > 0) dominantType = 'angular'

  return {
    totalPaths,
    smoothPaths,
    angularPaths,
    mixedPaths,
    avgPathLength: totalLength / totalPaths,
    avgSegmentLength: totalSegments > 0 ? totalLength / totalSegments : 0,
    avgTurningAngle: angleCount > 0 ? totalAngle / angleCount : 0,
    curvatureDistribution: angleBuckets,
    dominantType
  }
}

export function extractWidthDistribution(paths: BladePath[]): BladeWidthDistribution {
  if (paths.length === 0) {
    return {
      minWidth: 0,
      maxWidth: 0,
      avgWidth: 0,
      medianWidth: 0,
      stdDev: 0,
      widthHistogram: [],
      consistencyScore: 0
    }
  }

  const widths = paths.map((p) => p.bladeWidth).sort((a, b) => a - b)
  const minWidth = widths[0]
  const maxWidth = widths[widths.length - 1]
  const avgWidth = widths.reduce((a, b) => a + b, 0) / widths.length
  const medianWidth =
    widths.length % 2 === 0
      ? (widths[widths.length / 2 - 1] + widths[widths.length / 2]) / 2
      : widths[Math.floor(widths.length / 2)]

  const variance = widths.reduce((sum, w) => sum + (w - avgWidth) ** 2, 0) / widths.length
  const stdDev = Math.sqrt(variance)

  const histogram: { range: string; count: number }[] = []
  if (maxWidth > minWidth) {
    const bucketCount = 5
    const bucketSize = (maxWidth - minWidth) / bucketCount
    for (let i = 0; i < bucketCount; i++) {
      const start = minWidth + i * bucketSize
      const end = i === bucketCount - 1 ? maxWidth + 0.01 : minWidth + (i + 1) * bucketSize
      const count = widths.filter((w) => w >= start && w < end).length
      histogram.push({
        range: `${start.toFixed(1)}-${end.toFixed(1)}`,
        count
      })
    }
  } else {
    histogram.push({ range: `${minWidth.toFixed(1)}`, count: widths.length })
  }

  const consistencyScore = avgWidth > 0 ? Math.max(0, 1 - stdDev / avgWidth) : 0

  return {
    minWidth,
    maxWidth,
    avgWidth,
    medianWidth,
    stdDev,
    widthHistogram: histogram,
    consistencyScore
  }
}

function calculateStartAngle(points: Point[]): number {
  if (points.length < 2) return 0
  const dx = points[1].x - points[0].x
  const dy = points[1].y - points[0].y
  return Math.atan2(dy, dx) * (180 / Math.PI)
}

function calculateEndAngle(points: Point[]): number {
  if (points.length < 2) return 0
  const last = points.length - 1
  const dx = points[last].x - points[last - 1].x
  const dy = points[last].y - points[last - 1].y
  return Math.atan2(dy, dx) * (180 / Math.PI)
}

function classifyCutStyle(angles: number[]): BladeCutStyle {
  if (angles.length < 2) return 'steady'
  const avg = angles.reduce((a, b) => a + b, 0) / angles.length
  const variance = angles.reduce((sum, a) => sum + (a - avg) ** 2, 0) / angles.length
  const stdDev = Math.sqrt(variance)

  if (stdDev < 15) return 'steady'
  if (stdDev < 45) return 'gradual'
  return 'abrupt'
}

export function extractCutHabit(paths: BladePath[]): BladeCutHabit {
  const startMarkerCount = paths.filter((p) => p.startMarker).length
  const endMarkerCount = paths.filter((p) => p.endMarker).length
  const totalPaths = paths.length || 1
  const startEndCoverageRate =
    paths.filter((p) => p.startMarker && p.endMarker).length / totalPaths

  const startAngles: number[] = []
  const endAngles: number[] = []
  const directions: string[] = []

  paths.forEach((path) => {
    if (path.points.length >= 2) {
      const startAngle = calculateStartAngle(path.points)
      const endAngle = calculateEndAngle(path.points)
      startAngles.push(startAngle)
      endAngles.push(endAngle)

      const absAngle = Math.abs(startAngle)
      if (absAngle < 45 || absAngle > 135) directions.push('horizontal')
      else directions.push('vertical')
    }
  })

  const avgStartAngle =
    startAngles.length > 0 ? startAngles.reduce((a, b) => a + b, 0) / startAngles.length : 0
  const avgEndAngle =
    endAngles.length > 0 ? endAngles.reduce((a, b) => a + b, 0) / endAngles.length : 0

  const horizontalCount = directions.filter((d) => d === 'horizontal').length
  const verticalCount = directions.length - horizontalCount
  let directionalPreference = '均衡'
  if (directions.length > 0) {
    if (horizontalCount / directions.length > 0.6) directionalPreference = '横向为主'
    else if (verticalCount / directions.length > 0.6) directionalPreference = '纵向为主'
  }

  return {
    startMarkerCount,
    endMarkerCount,
    startEndCoverageRate,
    avgStartAngle,
    avgEndAngle,
    startStyle: classifyCutStyle(startAngles),
    endStyle: classifyCutStyle(endAngles),
    directionalPreference
  }
}

export function extractRevisionDensity(
  paths: BladePath[],
  imageWidth: number,
  imageHeight: number
): RevisionDensityFeature {
  const totalRevisionMarkers = paths.reduce(
    (sum, path) => sum + path.revisionMarkers.length,
    0
  )
  const totalPaths = paths.length || 1
  const avgRevisionPerPath = totalRevisionMarkers / totalPaths

  const area = imageWidth * imageHeight || 1
  const revisionDensityPerUnitArea = totalRevisionMarkers / area * 10000

  let revisionDensityLevel: RevisionDensityLevel = 'low'
  if (avgRevisionPerPath > 1) revisionDensityLevel = 'high'
  else if (avgRevisionPerPath > 0.3) revisionDensityLevel = 'medium'

  const gridSize = 50
  const hotspotMap = new Map<string, { x: number; y: number; count: number }>()

  paths.forEach((path) => {
    path.revisionMarkers.forEach((marker) => {
      const gridX = Math.floor(marker.x / gridSize)
      const gridY = Math.floor(marker.y / gridSize)
      const key = `${gridX}-${gridY}`
      if (!hotspotMap.has(key)) {
        hotspotMap.set(key, {
          x: gridX * gridSize + gridSize / 2,
          y: gridY * gridSize + gridSize / 2,
          count: 0
        })
      }
      hotspotMap.get(key)!.count++
    })
  })

  const revisionHotspots = Array.from(hotspotMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    totalRevisionMarkers,
    avgRevisionPerPath,
    revisionDensityPerUnitArea,
    revisionDensityLevel,
    revisionHotspots
  }
}

export function extractLayerStructure(
  paths: BladePath[],
  layers: Layer[]
): LayerStructureFeature {
  const totalLayers = layers.length
  const totalPaths = paths.length

  const layerDistribution = layers.map((layer) => {
    const layerPaths = paths.filter((p) => p.layerId === layer.id)
    const totalLength = layerPaths.reduce((sum, p) => sum + p.length, 0)
    return {
      layerName: layer.name,
      pathCount: layerPaths.length,
      totalLength
    }
  })

  const avgPathsPerLayer = totalLayers > 0 ? totalPaths / totalLayers : 0

  let layerComplexityScore = 0
  if (layerDistribution.length > 0) {
    const counts = layerDistribution.map((d) => d.pathCount)
    const maxCount = Math.max(...counts, 1)
    const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length
    const variance = counts.reduce((s, c) => s + (c - avgCount) ** 2, 0) / counts.length
    layerComplexityScore = Math.max(0, 1 - Math.sqrt(variance) / maxCount)
  }

  const interLayerSimilarity = totalLayers > 1 ? 1 / totalLayers : 1

  return {
    totalLayers,
    layerDistribution,
    avgPathsPerLayer,
    layerComplexityScore,
    interLayerSimilarity
  }
}

function generateStyleDescription(profile: Omit<EngraverStyleProfile, 'overallStyleDescription' | 'styleTags'>): string {
  const parts: string[] = []

  const typeDesc: Record<PathMorphologyType, string> = {
    smooth: '线条流畅圆润，以曲线为主',
    angular: '线条刚劲有力，转折分明',
    mixed: '线条形态丰富，曲直结合'
  }
  parts.push(`路径形态：${typeDesc[profile.pathMorphology.dominantType]}`)

  if (profile.widthDistribution.consistencyScore > 0.8) {
    parts.push('刀痕宽度高度一致，显示出娴熟的控刀技巧')
  } else if (profile.widthDistribution.consistencyScore > 0.5) {
    parts.push('刀痕宽度略有变化，呈现自然的手工质感')
  } else {
    parts.push('刀痕宽度变化较大，可能包含多次修版或不同工具')
  }

  parts.push(`起刀风格：${profile.cutHabit.startStyle === 'steady' ? '稳定一致' : profile.cutHabit.startStyle === 'gradual' ? '渐进变化' : '变化剧烈'}`)
  parts.push(`方向偏好：${profile.cutHabit.directionalPreference}`)

  if (profile.revisionDensity.revisionDensityLevel === 'high') {
    parts.push('修版痕迹密集，可能经过反复修改或为后期补刻')
  } else if (profile.revisionDensity.revisionDensityLevel === 'medium') {
    parts.push('存在一定数量的修版痕迹')
  } else {
    parts.push('修版痕迹较少，刻工较为自信')
  }

  return parts.join('；')
}

function generateStyleTags(profile: Omit<EngraverStyleProfile, 'overallStyleDescription' | 'styleTags'>): string[] {
  const tags: string[] = []

  if (profile.pathMorphology.dominantType === 'smooth') tags.push('线条流畅')
  else if (profile.pathMorphology.dominantType === 'angular') tags.push('刚劲有力')
  else tags.push('曲直兼备')

  if (profile.widthDistribution.consistencyScore > 0.8) tags.push('刀痕均匀')
  else if (profile.widthDistribution.consistencyScore < 0.5) tags.push('刀痕多变')

  if (profile.cutHabit.startEndCoverageRate > 0.7) tags.push('标注规范')

  if (profile.revisionDensity.revisionDensityLevel === 'high') tags.push('多修版')
  else if (profile.revisionDensity.revisionDensityLevel === 'low') tags.push('少修版')

  if (profile.layerStructure.totalLayers > 3) tags.push('层次丰富')

  return tags
}

export function generateEngraverStyleProfile(
  scheme: AnnotationScheme
): EngraverStyleProfile {
  const pathMorphology = extractPathMorphology(scheme.bladePaths)
  const widthDistribution = extractWidthDistribution(scheme.bladePaths)
  const cutHabit = extractCutHabit(scheme.bladePaths)
  const revisionDensity = extractRevisionDensity(
    scheme.bladePaths,
    scheme.image.width,
    scheme.image.height
  )
  const layerStructure = extractLayerStructure(scheme.bladePaths, scheme.layers)

  const partial: Omit<EngraverStyleProfile, 'overallStyleDescription' | 'styleTags'> = {
    schemeId: scheme.id,
    schemeName: scheme.projectName,
    researcher: scheme.researcher,
    generatedAt: Date.now(),
    pathMorphology,
    widthDistribution,
    cutHabit,
    revisionDensity,
    layerStructure
  }

  return {
    ...partial,
    overallStyleDescription: generateStyleDescription(partial),
    styleTags: generateStyleTags(partial)
  }
}

function comparePathMorphology(a: PathMorphologyFeature, b: PathMorphologyFeature): number {
  if (a.totalPaths === 0 || b.totalPaths === 0) return 0
  let score = 0
  if (a.dominantType === b.dominantType) score += 0.4
  const smoothDiff = Math.abs(a.smoothPaths / a.totalPaths - b.smoothPaths / b.totalPaths)
  const angularDiff = Math.abs(a.angularPaths / a.totalPaths - b.angularPaths / b.totalPaths)
  score += (1 - smoothDiff) * 0.3
  score += (1 - angularDiff) * 0.3
  return score
}

function compareWidthDistribution(a: BladeWidthDistribution, b: BladeWidthDistribution): number {
  if (a.avgWidth === 0 || b.avgWidth === 0) return 0
  const avgDiff = Math.abs(a.avgWidth - b.avgWidth) / Math.max(a.avgWidth, b.avgWidth)
  const consistencyDiff = Math.abs(a.consistencyScore - b.consistencyScore)
  return (1 - avgDiff) * 0.6 + (1 - consistencyDiff) * 0.4
}

function compareCutHabit(a: BladeCutHabit, b: BladeCutHabit): number {
  let score = 0
  if (a.startStyle === b.startStyle) score += 0.25
  if (a.endStyle === b.endStyle) score += 0.25
  if (a.directionalPreference === b.directionalPreference) score += 0.25
  const coverageDiff = Math.abs(a.startEndCoverageRate - b.startEndCoverageRate)
  score += (1 - coverageDiff) * 0.25
  return score
}

function compareRevisionDensity(a: RevisionDensityFeature, b: RevisionDensityFeature): number {
  if (a.revisionDensityLevel === b.revisionDensityLevel) return 1
  const levels: RevisionDensityLevel[] = ['low', 'medium', 'high']
  const diff = Math.abs(levels.indexOf(a.revisionDensityLevel) - levels.indexOf(b.revisionDensityLevel))
  return 1 - diff * 0.5
}

function compareLayerStructure(a: LayerStructureFeature, b: LayerStructureFeature): number {
  const layerCountDiff = Math.abs(a.totalLayers - b.totalLayers)
  const layerScore = Math.max(0, 1 - layerCountDiff * 0.2)
  const complexityDiff = Math.abs(a.layerComplexityScore - b.layerComplexityScore)
  return layerScore * 0.5 + (1 - complexityDiff) * 0.5
}

export function calculateProfileSimilarity(a: EngraverStyleProfile, b: EngraverStyleProfile): number {
  const weights = {
    pathMorphology: 0.3,
    widthDistribution: 0.25,
    cutHabit: 0.25,
    revisionDensity: 0.1,
    layerStructure: 0.1
  }

  return (
    comparePathMorphology(a.pathMorphology, b.pathMorphology) * weights.pathMorphology +
    compareWidthDistribution(a.widthDistribution, b.widthDistribution) * weights.widthDistribution +
    compareCutHabit(a.cutHabit, b.cutHabit) * weights.cutHabit +
    compareRevisionDensity(a.revisionDensity, b.revisionDensity) * weights.revisionDensity +
    compareLayerStructure(a.layerStructure, b.layerStructure) * weights.layerStructure
  )
}

export function generateVersionDiffSummary(
  profileA: EngraverStyleProfile,
  profileB: EngraverStyleProfile
): VersionDiffSummary {
  const overallSimilarity = calculateProfileSimilarity(profileA, profileB)
  const diffItems: VersionDiffItem[] = []

  if (profileA.pathMorphology.dominantType !== profileB.pathMorphology.dominantType) {
    diffItems.push({
      category: '路径形态',
      description: `主导线条类型存在差异：${profileA.schemeName}以${profileA.pathMorphology.dominantType === 'smooth' ? '流畅曲线' : profileA.pathMorphology.dominantType === 'angular' ? '刚劲折线' : '混合形态'}为主，${profileB.schemeName}以${profileB.pathMorphology.dominantType === 'smooth' ? '流畅曲线' : profileB.pathMorphology.dominantType === 'angular' ? '刚劲折线' : '混合形态'}为主`,
      severity: overallSimilarity < 0.5 ? 'significant' : 'moderate',
      affectedFeatures: ['路径形态'],
      quantitativeData: {
        similarity: comparePathMorphology(profileA.pathMorphology, profileB.pathMorphology)
      }
    })
  }

  const widthDiff = Math.abs(profileA.widthDistribution.avgWidth - profileB.widthDistribution.avgWidth)
  if (widthDiff > 0.5) {
    diffItems.push({
      category: '刀痕宽度',
      description: `平均刀痕宽度差异明显：${profileA.schemeName}为${profileA.widthDistribution.avgWidth.toFixed(2)}px，${profileB.schemeName}为${profileB.widthDistribution.avgWidth.toFixed(2)}px，相差${widthDiff.toFixed(2)}px`,
      severity: widthDiff > 1.5 ? 'significant' : 'moderate',
      affectedFeatures: ['刀痕宽度分布'],
      quantitativeData: {
        widthA: profileA.widthDistribution.avgWidth,
        widthB: profileB.widthDistribution.avgWidth,
        difference: widthDiff
      }
    })
  }

  if (profileA.cutHabit.startStyle !== profileB.cutHabit.startStyle || profileA.cutHabit.endStyle !== profileB.cutHabit.endStyle) {
    diffItems.push({
      category: '起收刀习惯',
      description: `起收刀风格存在差异：${profileA.schemeName}起刀${profileA.cutHabit.startStyle}、收刀${profileA.cutHabit.endStyle}；${profileB.schemeName}起刀${profileB.cutHabit.startStyle}、收刀${profileB.cutHabit.endStyle}`,
      severity: 'moderate',
      affectedFeatures: ['起收刀习惯']
    })
  }

  if (profileA.revisionDensity.revisionDensityLevel !== profileB.revisionDensity.revisionDensityLevel) {
    const levelMap = { low: '低', medium: '中', high: '高' }
    diffItems.push({
      category: '修版密度',
      description: `修版密度级别不同：${profileA.schemeName}为${levelMap[profileA.revisionDensity.revisionDensityLevel]}修版（${profileA.revisionDensity.totalRevisionMarkers}处），${profileB.schemeName}为${levelMap[profileB.revisionDensity.revisionDensityLevel]}修版（${profileB.revisionDensity.totalRevisionMarkers}处）`,
      severity: 'minor',
      affectedFeatures: ['修版位置密度'],
      quantitativeData: {
        revisionsA: profileA.revisionDensity.totalRevisionMarkers,
        revisionsB: profileB.revisionDensity.totalRevisionMarkers
      }
    })
  }

  const layerDiff = Math.abs(profileA.layerStructure.totalLayers - profileB.layerStructure.totalLayers)
  if (layerDiff > 0) {
    diffItems.push({
      category: '图层结构',
      description: `图层数量不同：${profileA.schemeName}有${profileA.layerStructure.totalLayers}层，${profileB.schemeName}有${profileB.layerStructure.totalLayers}层`,
      severity: layerDiff > 2 ? 'moderate' : 'minor',
      affectedFeatures: ['图层结构'],
      quantitativeData: {
        layersA: profileA.layerStructure.totalLayers,
        layersB: profileB.layerStructure.totalLayers
      }
    })
  }

  let summaryText = ''
  let suspectedRelation = ''

  if (overallSimilarity >= 0.85) {
    summaryText = `两方案高度相似（相似度${(overallSimilarity * 100).toFixed(1)}%），整体风格特征趋于一致，刻工习惯具有高度重叠。`
    suspectedRelation = '极有可能为同一刻工的同一版次'
  } else if (overallSimilarity >= 0.7) {
    summaryText = `两方案较为相似（相似度${(overallSimilarity * 100).toFixed(1)}%），主要风格特征相近，但在细节上存在一些差异。`
    suspectedRelation = '疑似同一刻工的不同版次或不同阶段作品'
  } else if (overallSimilarity >= 0.5) {
    summaryText = `两方案存在一定差异（相似度${(overallSimilarity * 100).toFixed(1)}%），部分风格特征重叠，但核心刻法存在明显区别。`
    suspectedRelation = '可能为不同刻工的仿刻作品，或有师承关系'
  } else {
    summaryText = `两方案差异较大（相似度${(overallSimilarity * 100).toFixed(1)}%），刻工风格特征区别明显。`
    suspectedRelation = '大概率为不同刻工作品'
  }

  if (diffItems.length > 0) {
    summaryText += ` 主要差异点共${diffItems.length}处：${diffItems.map((d) => d.category).join('、')}。`
  }

  return {
    schemeAId: profileA.schemeId,
    schemeAName: profileA.schemeName,
    schemeBId: profileB.schemeId,
    schemeBName: profileB.schemeName,
    generatedAt: Date.now(),
    overallSimilarity,
    diffItems,
    summaryText,
    suspectedVersionRelation: suspectedRelation
  }
}

export function findSameEngraverAssociations(
  profiles: EngraverStyleProfile[]
): SameEngraverAssociation[] {
  const associations: SameEngraverAssociation[] = []
  const processed = new Set<string>()

  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      const key = `${profiles[i].schemeId}-${profiles[j].schemeId}`
      if (processed.has(key)) continue

      const similarity = calculateProfileSimilarity(profiles[i], profiles[j])
      if (similarity >= 0.65) {
        processed.add(key)

        let confidence: ConfidenceLevel = 'low'
        if (similarity >= 0.85) confidence = 'high'
        else if (similarity >= 0.75) confidence = 'medium'

        const sharedTags = profiles[i].styleTags.filter((t) => profiles[j].styleTags.includes(t))
        const allTags = new Set([...profiles[i].styleTags, ...profiles[j].styleTags])
        const distinctive = Array.from(allTags).filter((t) => !sharedTags.includes(t))

        let notes = ''
        if (confidence === 'high') {
          notes = '两方案在多个维度上呈现高度一致性，强烈建议判定为同工作品。'
        } else if (confidence === 'medium') {
          notes = '两方案存在显著相似性，建议结合其他证据进一步研判。'
        } else {
          notes = '两方案存在一定相似性，但证据尚不充分，需谨慎判断。'
        }

        associations.push({
          schemeIds: [profiles[i].schemeId, profiles[j].schemeId],
          schemeNames: [profiles[i].schemeName, profiles[j].schemeName],
          similarityScore: similarity,
          confidence,
          sharedFeatures: sharedTags,
          distinctiveFeatures: distinctive,
          analysisNotes: notes
        })
      }
    }
  }

  return associations.sort((a, b) => b.similarityScore - a.similarityScore)
}

export function addManualRevision(
  targetType: 'style_profile' | 'version_diff' | 'association',
  targetId: string,
  fieldName: string,
  originalValue: string,
  revisedValue: string,
  revisedBy: string,
  reason: string
): ManualRevision {
  return {
    id: generateId(),
    targetType,
    targetId,
    fieldName,
    originalValue,
    revisedValue,
    revisedBy,
    revisedAt: Date.now(),
    reason
  }
}

export function addJudgmentEvidence(
  targetType: 'style_profile' | 'version_diff' | 'association',
  targetId: string,
  content: string,
  evidenceType: 'text_note' | 'path_reference' | 'marker_reference',
  referencedIds: string[],
  createdBy: string
): JudgmentEvidence {
  return {
    id: generateId(),
    targetType,
    targetId,
    content,
    evidenceType,
    referencedIds,
    createdBy,
    createdAt: Date.now()
  }
}

export function generateResearchReport(
  title: string,
  generatedBy: string,
  styleProfiles: EngraverStyleProfile[],
  versionDiffs: VersionDiffSummary[],
  associations: SameEngraverAssociation[],
  manualRevisions: ManualRevision[],
  evidences: JudgmentEvidence[],
  additionalNotes: string
): ResearchReport {
  return {
    title,
    generatedAt: Date.now(),
    generatedBy,
    styleProfiles,
    versionDiffs,
    associations,
    manualRevisions,
    evidences,
    additionalNotes
  }
}

export function downloadResearchReport(report: ResearchReport): void {
  const json = JSON.stringify(report, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  const dateStr = new Date().toISOString().split('T')[0]
  const safeTitle = report.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
  link.download = `${safeTitle}_刻工风格研究报告_${dateStr}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
