import { describe, expect, it } from 'vitest'
import { hybridSearch, capsuleText } from '../search'
import type { CapsuleManifest } from '@contextforge/shared'

function makeManifest(id: string, overrides: Partial<CapsuleManifest> = {}): CapsuleManifest {
  return {
    id,
    title: 'Test capsule',
    summary: 'A test summary',
    goals: [],
    constraints: [],
    decisions: [],
    openQuestions: [],
    platform: 'claude',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    turnCount: 1,
    tokenEstimate: 100,
    tags: [],
    parentIds: [],
    compressed: true,
    ...overrides,
  }
}

const MANIFESTS: CapsuleManifest[] = [
  makeManifest('m1', { title: 'pnpm monorepo setup', goals: ['configure workspace'] }),
  makeManifest('m2', { title: 'React hooks tutorial', goals: ['learn useState'] }),
  makeManifest('m3', { title: 'TypeScript strict mode', goals: ['enable strict', 'fix errors'] }),
]

describe('hybridSearch', () => {
  it('returns empty array for empty manifests', () => {
    expect(hybridSearch('pnpm', null, [], new Map(), 5)).toEqual([])
  })

  it('BM25-only mode (null embedding) returns relevant results', () => {
    const result = hybridSearch('pnpm workspace', null, MANIFESTS, new Map(), 5)
    expect(result[0]).toBe('m1')
  })

  it('respects the limit parameter', () => {
    const result = hybridSearch('typescript', null, MANIFESTS, new Map(), 1)
    expect(result.length).toBeLessThanOrEqual(1)
  })

  it('embedding boost promotes semantically similar results', () => {
    const embeddingMap = new Map<string, number[]>([
      ['m1', [1, 0, 0]],
      ['m2', [0, 1, 0]],
      ['m3', [0, 0, 1]],
    ])
    const queryEmbedding = [1, 0, 0] // closest to m1
    const result = hybridSearch('monorepo', queryEmbedding, MANIFESTS, embeddingMap, 3)
    expect(result[0]).toBe('m1')
  })

  it('returns no results when query matches nothing', () => {
    const result = hybridSearch('zzzznothing', null, MANIFESTS, new Map(), 5)
    expect(result).toEqual([])
  })
})

describe('capsuleText', () => {
  it('includes title, summary, and goals', () => {
    const m = makeManifest('x', { title: 'My title', summary: 'My summary', goals: ['goal one'] })
    const text = capsuleText(m)
    expect(text).toContain('My title')
    expect(text).toContain('My summary')
    expect(text).toContain('goal one')
  })
})
