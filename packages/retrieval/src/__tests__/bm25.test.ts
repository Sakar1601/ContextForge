import { describe, expect, it } from 'vitest'
import { buildBM25, scoreBM25 } from '../bm25'

const DOCS = [
  { id: 'a', text: 'pnpm workspace monorepo TypeScript setup' },
  { id: 'b', text: 'react hooks useState useEffect tutorial' },
  { id: 'c', text: 'pnpm install workspace packages dependencies' },
]

describe('buildBM25', () => {
  it('builds an index with IDF entries for all terms', () => {
    const idx = buildBM25(DOCS)
    expect(idx.idf.size).toBeGreaterThan(0)
    expect(idx.N).toBe(3)
  })

  it('avgdl is positive for non-empty corpus', () => {
    const idx = buildBM25(DOCS)
    expect(idx.avgdl).toBeGreaterThan(0)
  })

  it('handles an empty corpus', () => {
    const idx = buildBM25([])
    expect(scoreBM25(idx, 'anything').size).toBe(0)
  })
})

describe('scoreBM25', () => {
  it('returns higher score for docs containing query terms', () => {
    const idx = buildBM25(DOCS)
    const scores = scoreBM25(idx, 'pnpm workspace')
    expect(scores.get('a')).toBeGreaterThan(0)
    expect(scores.get('c')).toBeGreaterThan(0)
    expect(scores.has('b')).toBe(false)
  })

  it('returns empty map for a query with no matching terms', () => {
    const idx = buildBM25(DOCS)
    expect(scoreBM25(idx, 'zzzznotaword').size).toBe(0)
  })

  it('a doc with higher term frequency scores higher than lower tf', () => {
    const idx = buildBM25([
      { id: 'hi', text: 'pnpm pnpm pnpm install' },
      { id: 'lo', text: 'pnpm install node' },
    ])
    const scores = scoreBM25(idx, 'pnpm')
    expect((scores.get('hi') ?? 0)).toBeGreaterThan(scores.get('lo') ?? 0)
  })
})
