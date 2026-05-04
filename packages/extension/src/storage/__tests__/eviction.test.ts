import { describe, expect, it, beforeEach } from 'vitest'
import { ContextForgeDB } from '../db'
import { CapsuleRepository } from '../repositories/capsule-repository'
import { BodyRepository } from '../repositories/body-repository'
import { maybeEvict } from '../eviction'
import type { CapsuleManifest } from '@contextforge/shared'

let dbCounter = 0
function makeRepos() {
  const db = new ContextForgeDB(`eviction-test-${++dbCounter}`)
  return {
    capsuleRepo: new CapsuleRepository(db),
    bodyRepo: new BodyRepository(db),
  }
}

const BASE_TIME = new Date('2024-01-01T00:00:00.000Z')

function manifest(id: string, minutesOld: number): CapsuleManifest {
  const updatedAt = new Date(BASE_TIME.getTime() - minutesOld * 60_000).toISOString()
  return {
    id: id.padEnd(64, '0'),
    title: `Capsule ${id}`,
    summary: '',
    goals: [],
    constraints: [],
    decisions: [],
    openQuestions: [],
    platform: 'claude',
    createdAt: updatedAt,
    updatedAt,
    turnCount: 1,
    tokenEstimate: 100,
    tags: [],
    parentIds: [],
    compressed: true,
  }
}

describe('maybeEvict', () => {
  let capsuleRepo: CapsuleRepository
  let bodyRepo: BodyRepository

  beforeEach(() => {
    const repos = makeRepos()
    capsuleRepo = repos.capsuleRepo
    bodyRepo = repos.bodyRepo
  })

  it('returns 0 and evicts nothing when below the quota threshold', async () => {
    await capsuleRepo.save(manifest('a', 60))
    await bodyRepo.save({ capsuleId: 'a'.padEnd(64, '0'), full: 'text', chunks: [] })

    const evicted = await maybeEvict(capsuleRepo, bodyRepo, {
      estimateFn: async () => ({ usage: 100, quota: 10_000 }),
    })

    expect(evicted).toBe(0)
    expect((await bodyRepo.get('a'.padEnd(64, '0')))?.full).toBe('text')
  })

  it('evicts bodies when above the quota threshold', async () => {
    await capsuleRepo.save(manifest('a', 60))
    await capsuleRepo.save(manifest('b', 30))
    await bodyRepo.save({ capsuleId: 'a'.padEnd(64, '0'), full: 'text a', chunks: [] })
    await bodyRepo.save({ capsuleId: 'b'.padEnd(64, '0'), full: 'text b', chunks: [] })

    const evicted = await maybeEvict(capsuleRepo, bodyRepo, {
      estimateFn: async () => ({ usage: 9, quota: 10 }),
      batchSize: 5,
    })

    expect(evicted).toBe(2)
  })

  it('evicts oldest capsules first (by updatedAt asc)', async () => {
    await capsuleRepo.save(manifest('a', 60))
    await capsuleRepo.save(manifest('b', 5))
    await bodyRepo.save({ capsuleId: 'a'.padEnd(64, '0'), full: 'old text', chunks: [] })
    await bodyRepo.save({ capsuleId: 'b'.padEnd(64, '0'), full: 'new text', chunks: [] })

    await maybeEvict(capsuleRepo, bodyRepo, {
      estimateFn: async () => ({ usage: 9, quota: 10 }),
      batchSize: 1,
    })

    expect((await bodyRepo.get('a'.padEnd(64, '0')))?.full).toBeUndefined()
    expect((await bodyRepo.get('b'.padEnd(64, '0')))?.full).toBe('new text')
  })

  it('handles zero quota gracefully without dividing by zero', async () => {
    const evicted = await maybeEvict(capsuleRepo, bodyRepo, {
      estimateFn: async () => ({ usage: 0, quota: 0 }),
    })
    expect(evicted).toBe(0)
  })

  it('returns 0 when there are no bodies to evict', async () => {
    const evicted = await maybeEvict(capsuleRepo, bodyRepo, {
      estimateFn: async () => ({ usage: 9, quota: 10 }),
    })
    expect(evicted).toBe(0)
  })
})
