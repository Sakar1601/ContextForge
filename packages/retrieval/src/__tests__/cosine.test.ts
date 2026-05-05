import { describe, expect, it } from 'vitest'
import { cosineSimilarity, dotProduct, magnitude } from '../cosine'

describe('dotProduct', () => {
  it('computes correctly', () => {
    expect(dotProduct([1, 2, 3], [4, 5, 6])).toBe(32)
  })
  it('handles different lengths (uses shorter)', () => {
    expect(dotProduct([1, 2], [3, 4, 5])).toBe(11)
  })
})

describe('magnitude', () => {
  it('returns correct L2 norm', () => {
    expect(magnitude([3, 4])).toBeCloseTo(5)
  })
  it('returns 0 for zero vector', () => {
    expect(magnitude([0, 0, 0])).toBe(0)
  })
})

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1)
  })

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0)
  })

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1)
  })

  it('returns 0 when a vector is the zero vector', () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0)
  })

  it('handles non-unit vectors correctly', () => {
    const a = [3, 4]
    const b = [6, 8] // same direction, 2× magnitude
    expect(cosineSimilarity(a, b)).toBeCloseTo(1)
  })
})
