import { describe, expect, it } from 'vitest'
import { branchFrom, cherryPickFields, commit, diff, merge } from '../dag/operations'
import type { CapsuleManifest } from '../types/capsule'

// ─── fixtures ────────────────────────────────────────────────────────────────

const NOW = '2024-06-01T12:00:00.000Z'

function makeManifest(overrides: Partial<CapsuleManifest> = {}): CapsuleManifest {
  return {
    id: 'base-id',
    title: 'Research session',
    summary: 'Exploring Dexie.js',
    goals: ['understand the API'],
    constraints: ['no eval', 'MV3 only'],
    decisions: ['use Dexie'],
    openQuestions: ['what is the quota?'],
    platform: 'claude',
    createdAt: NOW,
    updatedAt: NOW,
    turnCount: 5,
    tokenEstimate: 800,
    tags: ['research'],
    parentIds: [],
    compressed: true,
    ...overrides,
  }
}

// ─── commit ──────────────────────────────────────────────────────────────────

describe('commit', () => {
  it('returns a manifest that passes schema validation', async () => {
    const { CapsuleManifestSchema } = await import('../types/capsule')
    const fields = makeManifest()
    const { id: _id, ...fieldsWithoutId } = fields
    const result = await commit(fieldsWithoutId)
    expect(() => CapsuleManifestSchema.parse(result)).not.toThrow()
  })

  it('computes a 64-char hex id', async () => {
    const { id: _id, ...fields } = makeManifest()
    const result = await commit(fields)
    expect(result.id).toMatch(/^[0-9a-f]{64}$/)
  })

  it('preserves all provided fields', async () => {
    const { id: _id, ...fields } = makeManifest({ title: 'Special title' })
    const result = await commit(fields)
    expect(result.title).toBe('Special title')
    expect(result.goals).toEqual(['understand the API'])
  })

  it('same input always produces the same id (determinism)', async () => {
    const { id: _id, ...fields } = makeManifest()
    const r1 = await commit(fields)
    const r2 = await commit(fields)
    expect(r1.id).toBe(r2.id)
  })

  it('different titles produce different ids', async () => {
    const base = makeManifest()
    const { id: _1, ...f1 } = { ...base, title: 'Alpha' }
    const { id: _2, ...f2 } = { ...base, title: 'Beta' }
    const r1 = await commit(f1)
    const r2 = await commit(f2)
    expect(r1.id).not.toBe(r2.id)
  })
})

// ─── branchFrom ───────────────────────────────────────────────────────────────

describe('branchFrom', () => {
  it('creates a branch with the given name and tip id', () => {
    const tip = makeManifest({ id: 'tip-001' })
    const branch = branchFrom('feature/retrieval', tip)
    expect(branch.name).toBe('feature/retrieval')
    expect(branch.tipId).toBe('tip-001')
  })
})

// ─── merge ────────────────────────────────────────────────────────────────────

describe('merge', () => {
  it('is clean when left changed a scalar and right did not', () => {
    const base = makeManifest()
    const left = makeManifest({ title: 'Improved title' })
    const right = makeManifest()

    const result = merge(base, left, right)
    expect(result.type).toBe('clean')
    if (result.type === 'clean') {
      expect(result.manifest.title).toBe('Improved title')
    }
  })

  it('is clean when right changed a scalar and left did not', () => {
    const base = makeManifest()
    const left = makeManifest()
    const right = makeManifest({ summary: 'New summary from right' })

    const result = merge(base, left, right)
    expect(result.type).toBe('clean')
    if (result.type === 'clean') {
      expect(result.manifest.summary).toBe('New summary from right')
    }
  })

  it('is clean when both sides changed different scalars', () => {
    const base = makeManifest()
    const left = makeManifest({ title: 'Left title' })
    const right = makeManifest({ summary: 'Right summary' })

    const result = merge(base, left, right)
    expect(result.type).toBe('clean')
    if (result.type === 'clean') {
      expect(result.manifest.title).toBe('Left title')
      expect(result.manifest.summary).toBe('Right summary')
    }
  })

  it('is clean when both sides made identical changes', () => {
    const base = makeManifest()
    const left = makeManifest({ title: 'Same title' })
    const right = makeManifest({ title: 'Same title' })

    const result = merge(base, left, right)
    expect(result.type).toBe('clean')
    if (result.type === 'clean') {
      expect(result.manifest.title).toBe('Same title')
    }
  })

  it('reports a conflict when both sides changed a scalar to different values', () => {
    const base = makeManifest()
    const left = makeManifest({ title: 'Left title' })
    const right = makeManifest({ title: 'Right title' })

    const result = merge(base, left, right)
    expect(result.type).toBe('conflict')
    if (result.type === 'conflict') {
      expect(result.conflicts.title).toEqual({
        base: 'Research session',
        left: 'Left title',
        right: 'Right title',
      })
    }
  })

  it('is clean when both sides added different items to an array', () => {
    const base = makeManifest({ goals: ['goal A'] })
    const left = makeManifest({ goals: ['goal A', 'goal B'] })
    const right = makeManifest({ goals: ['goal A', 'goal C'] })

    const result = merge(base, left, right)
    expect(result.type).toBe('clean')
    if (result.type === 'clean') {
      expect(result.manifest.goals).toContain('goal B')
      expect(result.manifest.goals).toContain('goal C')
    }
  })

  it('reports a conflict when both sides modified the same array differently', () => {
    const base = makeManifest({ constraints: ['no eval'] })
    const left = makeManifest({ constraints: ['no eval', 'MV3 only'] })
    const right = makeManifest({ constraints: [] })

    const result = merge(base, left, right)
    expect(result.type).toBe('conflict')
    if (result.type === 'conflict') {
      expect(result.conflicts.constraints).toBeDefined()
    }
  })

  it('does not include id, parentIds, or updatedAt in the result', () => {
    const base = makeManifest()
    const result = merge(base, makeManifest(), makeManifest())
    if (result.type === 'clean') {
      expect(result.manifest).not.toHaveProperty('id')
      expect(result.manifest).not.toHaveProperty('parentIds')
      expect(result.manifest).not.toHaveProperty('updatedAt')
    }
  })
})

// ─── diff ─────────────────────────────────────────────────────────────────────

describe('diff', () => {
  it('marks all fields as unchanged for identical manifests', () => {
    const m = makeManifest()
    const result = diff(m, m)
    for (const entry of Object.values(result)) {
      expect(entry.type).toBe('unchanged')
    }
  })

  it('marks a changed scalar field correctly', () => {
    const a = makeManifest()
    const b = makeManifest({ title: 'New title' })
    const result = diff(a, b)
    expect(result.title.type).toBe('changed')
    if (result.title.type === 'changed') {
      expect(result.title.from).toBe('Research session')
      expect(result.title.to).toBe('New title')
    }
  })

  it('marks unchanged fields as unchanged even when another field changed', () => {
    const a = makeManifest()
    const b = makeManifest({ title: 'X' })
    const result = diff(a, b)
    expect(result.platform.type).toBe('unchanged')
  })

  it('marks a changed array field correctly', () => {
    const a = makeManifest({ goals: ['A'] })
    const b = makeManifest({ goals: ['A', 'B'] })
    const result = diff(a, b)
    expect(result.goals.type).toBe('changed')
  })

  it('covers every key in CapsuleManifest', () => {
    const m = makeManifest()
    const result = diff(m, m)
    const keys = Object.keys(m) as Array<keyof CapsuleManifest>
    for (const k of keys) {
      expect(result[k]).toBeDefined()
    }
  })
})

// ─── cherryPickFields ─────────────────────────────────────────────────────────

describe('cherryPickFields', () => {
  it('returns only the specified fields', () => {
    const source = makeManifest({ title: 'Picked title', tags: ['a', 'b'] })
    const picked = cherryPickFields(source, ['title', 'tags'])
    expect(Object.keys(picked).sort()).toEqual(['tags', 'title'])
    expect(picked.title).toBe('Picked title')
    expect(picked.tags).toEqual(['a', 'b'])
  })

  it('does not return fields that were not requested', () => {
    const source = makeManifest()
    const picked = cherryPickFields(source, ['goals'])
    expect(picked).not.toHaveProperty('title')
    expect(picked).not.toHaveProperty('summary')
  })

  it('returns an empty object for an empty field list', () => {
    expect(cherryPickFields(makeManifest(), [])).toEqual({})
  })
})
