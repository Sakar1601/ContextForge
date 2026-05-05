import type { CapsuleManifest } from '@contextforge/shared'
import { buildBM25, scoreBM25 } from './bm25'
import { cosineSimilarity } from './cosine'

const COSINE_WEIGHT = 0.6
const BM25_WEIGHT = 0.4

function capsuleText(m: CapsuleManifest): string {
  const parts = [m.title, m.summary]
  if (m.goals.length) parts.push(`Goals: ${m.goals.join('. ')}`)
  if (m.constraints.length) parts.push(`Constraints: ${m.constraints.join('. ')}`)
  return parts.join('. ')
}

function normaliseScores(scores: Map<string, number>): Map<string, number> {
  const max = Math.max(...scores.values(), 1e-9)
  const out = new Map<string, number>()
  for (const [id, s] of scores) out.set(id, s / max)
  return out
}

export function hybridSearch(
  query: string,
  queryEmbedding: number[] | null,
  manifests: CapsuleManifest[],
  embeddingMap: Map<string, number[]>,
  limit: number,
): string[] {
  if (manifests.length === 0) return []

  const docs = manifests.map((m) => ({ id: m.id, text: capsuleText(m) }))
  const bm25Index = buildBM25(docs)
  const rawBm25 = scoreBM25(bm25Index, query)
  const normBm25 = normaliseScores(rawBm25)

  const combined = new Map<string, number>()

  for (const { id } of docs) {
    const bm25Score = (normBm25.get(id) ?? 0) * BM25_WEIGHT
    let cosineScore = 0
    if (queryEmbedding !== null) {
      const stored = embeddingMap.get(id)
      if (stored) {
        cosineScore = Math.max(0, cosineSimilarity(queryEmbedding, stored)) * COSINE_WEIGHT
      }
    }
    const total = bm25Score + cosineScore
    if (total > 0) combined.set(id, total)
  }

  return [...combined.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id)
}

export { capsuleText }
