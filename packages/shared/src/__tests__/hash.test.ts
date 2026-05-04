import { describe, expect, it } from 'vitest'
import { computeCapsuleId } from '../dag/hash'
import type { CapsuleManifest } from '../types/capsule'

function baseFields(): Omit<CapsuleManifest, 'id'> {
  return {
    title: 'Test',
    summary: 'Summary',
    goals: ['goal A'],
    constraints: [],
    decisions: [],
    openQuestions: [],
    platform: 'claude',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    turnCount: 1,
    tokenEstimate: 100,
    tags: [],
    parentIds: [],
    compressed: true,
  }
}

describe('computeCapsuleId', () => {
  it('returns a 64-character lowercase hex string (SHA-256)', async () => {
    const id = await computeCapsuleId(baseFields())
    expect(id).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic — same input always yields the same id', async () => {
    const fields = baseFields()
    expect(await computeCapsuleId(fields)).toBe(await computeCapsuleId(fields))
  })

  it('different title → different id', async () => {
    const id1 = await computeCapsuleId({ ...baseFields(), title: 'Alpha' })
    const id2 = await computeCapsuleId({ ...baseFields(), title: 'Beta' })
    expect(id1).not.toBe(id2)
  })

  it('different platform → different id', async () => {
    const id1 = await computeCapsuleId({ ...baseFields(), platform: 'claude' })
    const id2 = await computeCapsuleId({ ...baseFields(), platform: 'chatgpt' })
    expect(id1).not.toBe(id2)
  })

  it('array order matters — goals [A, B] ≠ goals [B, A]', async () => {
    const id1 = await computeCapsuleId({ ...baseFields(), goals: ['A', 'B'] })
    const id2 = await computeCapsuleId({ ...baseFields(), goals: ['B', 'A'] })
    expect(id1).not.toBe(id2)
  })

  it('different compressed flag → different id', async () => {
    const id1 = await computeCapsuleId({ ...baseFields(), compressed: true })
    const id2 = await computeCapsuleId({ ...baseFields(), compressed: false })
    expect(id1).not.toBe(id2)
  })

  it('extra whitespace in content → different id', async () => {
    const id1 = await computeCapsuleId({ ...baseFields(), summary: 'hello' })
    const id2 = await computeCapsuleId({ ...baseFields(), summary: 'hello ' })
    expect(id1).not.toBe(id2)
  })
})
