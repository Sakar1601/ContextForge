import { describe, expect, it, beforeEach } from 'vitest'
import { ContextForgeDB } from '../db'
import { BodyRepository } from '../repositories/body-repository'
import type { CapsuleBody } from '@contextforge/shared'

let dbCounter = 0
function makeDb() {
  return new ContextForgeDB(`body-test-${++dbCounter}`)
}

function body(overrides: Partial<CapsuleBody> = {}): CapsuleBody {
  return {
    capsuleId: 'capsule-1',
    full: 'The full conversation text.',
    chunks: [],
    ...overrides,
  }
}

describe('BodyRepository', () => {
  let repo: BodyRepository

  beforeEach(() => {
    repo = new BodyRepository(makeDb())
  })

  describe('save + get', () => {
    it('retrieves the body that was saved', async () => {
      const b = body()
      await repo.save(b)
      expect(await repo.get(b.capsuleId)).toEqual(b)
    })

    it('returns undefined for an unknown capsuleId', async () => {
      expect(await repo.get('no-such-id')).toBeUndefined()
    })

    it('accepts a body without full text (already evicted)', async () => {
      const b = body({ full: undefined })
      await repo.save(b)
      expect((await repo.get(b.capsuleId))?.full).toBeUndefined()
    })

    it('upserts — second save overwrites the first', async () => {
      await repo.save(body())
      await repo.save(body({ full: 'Updated text' }))
      expect((await repo.get('capsule-1'))?.full).toBe('Updated text')
    })
  })

  describe('evictFullText', () => {
    it('sets full to undefined and returns the eviction count', async () => {
      await repo.save(body({ capsuleId: 'c1', full: 'text 1' }))
      await repo.save(body({ capsuleId: 'c2', full: 'text 2' }))

      const evicted = await repo.evictFullText(2, ['c1', 'c2'])

      expect(evicted).toBe(2)
      expect((await repo.get('c1'))?.full).toBeUndefined()
      expect((await repo.get('c2'))?.full).toBeUndefined()
    })

    it('respects the count limit', async () => {
      await repo.save(body({ capsuleId: 'c1', full: 'text 1' }))
      await repo.save(body({ capsuleId: 'c2', full: 'text 2' }))
      await repo.save(body({ capsuleId: 'c3', full: 'text 3' }))

      const evicted = await repo.evictFullText(2, ['c1', 'c2', 'c3'])

      expect(evicted).toBe(2)
      expect((await repo.get('c3'))?.full).toBe('text 3')
    })

    it('skips bodies already lacking full text and does not count them', async () => {
      await repo.save(body({ capsuleId: 'c1', full: undefined }))
      await repo.save(body({ capsuleId: 'c2', full: 'text 2' }))

      const evicted = await repo.evictFullText(1, ['c1', 'c2'])

      expect(evicted).toBe(1)
      expect((await repo.get('c2'))?.full).toBeUndefined()
    })

    it('returns 0 when the orderedIds list is empty', async () => {
      expect(await repo.evictFullText(5, [])).toBe(0)
    })

    it('preserves chunks after eviction', async () => {
      const chunk = { id: '1', text: 'hello', startChar: 0, endChar: 5 }
      await repo.save(body({ capsuleId: 'c1', full: 'text', chunks: [chunk] }))
      await repo.evictFullText(1, ['c1'])
      expect((await repo.get('c1'))?.chunks).toEqual([chunk])
    })
  })
})
