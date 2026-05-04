import { describe, expect, it, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { ContextForgeDB } from '../db'
import { CapsuleRepository } from '../repositories/capsule-repository'
import type { CapsuleManifest } from '@contextforge/shared'

// ─── helpers ─────────────────────────────────────────────────────────────────

let dbCounter = 0
function makeDb() {
  return new ContextForgeDB(`capsule-test-${++dbCounter}`)
}

const NOW = '2024-01-01T12:00:00.000Z'
const LATER = '2024-01-02T12:00:00.000Z'
const LATEST = '2024-01-03T12:00:00.000Z'

function manifest(overrides: Partial<CapsuleManifest> = {}): CapsuleManifest {
  return {
    id: 'aaaa' + '0'.repeat(60),
    title: 'Test capsule',
    summary: 'Summary',
    goals: ['goal'],
    constraints: [],
    decisions: [],
    openQuestions: [],
    platform: 'claude',
    createdAt: NOW,
    updatedAt: NOW,
    turnCount: 1,
    tokenEstimate: 100,
    tags: [],
    parentIds: [],
    compressed: true,
    ...overrides,
  }
}

const manifestArb = fc.record<CapsuleManifest>({
  id: fc.hexaString({ minLength: 64, maxLength: 64 }),
  title: fc.string({ minLength: 1, maxLength: 80 }),
  summary: fc.string({ maxLength: 300 }),
  goals: fc.array(fc.string({ maxLength: 60 }), { maxLength: 5 }),
  constraints: fc.array(fc.string({ maxLength: 60 }), { maxLength: 5 }),
  decisions: fc.array(fc.string({ maxLength: 60 }), { maxLength: 5 }),
  openQuestions: fc.array(fc.string({ maxLength: 60 }), { maxLength: 5 }),
  platform: fc.constantFrom('claude', 'chatgpt', 'gemini', 'perplexity', 'deepseek', 'gmail'),
  createdAt: fc.date({ min: new Date(0) }).map((d) => d.toISOString()),
  updatedAt: fc.date({ min: new Date(0) }).map((d) => d.toISOString()),
  turnCount: fc.nat({ max: 1000 }),
  tokenEstimate: fc.nat({ max: 100000 }),
  tags: fc.array(fc.string({ maxLength: 20 }), { maxLength: 5 }),
  parentIds: fc.array(fc.hexaString({ minLength: 64, maxLength: 64 }), { maxLength: 2 }),
  compressed: fc.boolean(),
})

// ─── tests ────────────────────────────────────────────────────────────────────

describe('CapsuleRepository', () => {
  let db: ContextForgeDB
  let repo: CapsuleRepository

  beforeEach(() => {
    db = makeDb()
    repo = new CapsuleRepository(db)
  })

  describe('save + get', () => {
    it('retrieves the manifest that was saved', async () => {
      const m = manifest()
      await repo.save(m)
      expect(await repo.get(m.id)).toEqual(m)
    })

    it('returns undefined for an unknown id', async () => {
      expect(await repo.get('nonexistent')).toBeUndefined()
    })

    it('upserts — second save overwrites the first', async () => {
      const m = manifest()
      await repo.save(m)
      const updated = { ...m, title: 'Updated title' }
      await repo.save(updated)
      expect((await repo.get(m.id))?.title).toBe('Updated title')
    })
  })

  describe('listRecent', () => {
    it('returns manifests ordered by updatedAt descending', async () => {
      const a = manifest({ id: 'a'.repeat(64), updatedAt: NOW })
      const b = manifest({ id: 'b'.repeat(64), updatedAt: LATER })
      const c = manifest({ id: 'c'.repeat(64), updatedAt: LATEST })
      await repo.save(a)
      await repo.save(b)
      await repo.save(c)
      const list = await repo.listRecent(10)
      expect(list.map((m) => m.id)).toEqual(['c'.repeat(64), 'b'.repeat(64), 'a'.repeat(64)])
    })

    it('respects the limit', async () => {
      for (let i = 0; i < 5; i++) {
        await repo.save(manifest({ id: String(i).padStart(64, '0') }))
      }
      expect(await repo.listRecent(3)).toHaveLength(3)
    })
  })

  describe('listByPlatform', () => {
    it('returns only manifests for the requested platform', async () => {
      await repo.save(manifest({ id: 'a'.repeat(64), platform: 'claude' }))
      await repo.save(manifest({ id: 'b'.repeat(64), platform: 'chatgpt' }))
      await repo.save(manifest({ id: 'c'.repeat(64), platform: 'claude' }))
      const results = await repo.listByPlatform('claude')
      expect(results).toHaveLength(2)
      expect(results.every((m) => m.platform === 'claude')).toBe(true)
    })
  })

  describe('delete', () => {
    it('removes the manifest', async () => {
      const m = manifest()
      await repo.save(m)
      await repo.delete(m.id)
      expect(await repo.get(m.id)).toBeUndefined()
    })

    it('removes dag edges where this capsule is a child', async () => {
      const parent = manifest({ id: 'p'.repeat(64) })
      const child = manifest({ id: 'c'.repeat(64), parentIds: ['p'.repeat(64)] })
      await repo.save(parent)
      await repo.save(child)
      await repo.delete(child.id)
      expect(await repo.getChildren('p'.repeat(64))).toEqual([])
    })

    it('removes dag edges where this capsule is a parent', async () => {
      const parent = manifest({ id: 'p'.repeat(64) })
      const child = manifest({ id: 'c'.repeat(64), parentIds: ['p'.repeat(64)] })
      await repo.save(parent)
      await repo.save(child)
      await repo.delete(parent.id)
      const edges = await db.dagEdges.where('parentId').equals('p'.repeat(64)).toArray()
      expect(edges).toHaveLength(0)
    })
  })

  describe('getChildren', () => {
    it('returns child ids for a parent', async () => {
      const parent = manifest({ id: 'p'.repeat(64) })
      const child1 = manifest({ id: 'c'.repeat(64), parentIds: ['p'.repeat(64)] })
      const child2 = manifest({ id: 'd'.repeat(64), parentIds: ['p'.repeat(64)] })
      await repo.save(parent)
      await repo.save(child1)
      await repo.save(child2)
      const children = await repo.getChildren('p'.repeat(64))
      expect(children.sort()).toEqual(['c'.repeat(64), 'd'.repeat(64)].sort())
    })

    it('returns empty array for a node with no children', async () => {
      await repo.save(manifest())
      expect(await repo.getChildren('nonexistent')).toEqual([])
    })
  })

  describe('property-based roundtrip', () => {
    it('save + get is an identity for any valid manifest', async () => {
      await fc.assert(
        fc.asyncProperty(manifestArb, async (m) => {
          const freshRepo = new CapsuleRepository(makeDb())
          await freshRepo.save(m)
          const retrieved = await freshRepo.get(m.id)
          expect(retrieved).toEqual(m)
        }),
        { numRuns: 50 },
      )
    })
  })
})
