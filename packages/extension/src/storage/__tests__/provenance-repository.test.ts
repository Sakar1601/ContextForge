import { describe, expect, it, beforeEach } from 'vitest'
import { ContextForgeDB } from '../db'
import { ProvenanceRepository } from '../repositories/provenance-repository'
import type { ProvenanceMap } from '@contextforge/shared'

let dbCounter = 0
function makeDb() {
  return new ContextForgeDB(`provenance-test-${++dbCounter}`)
}

const NOW = '2024-01-01T12:00:00.000Z'

function pm(overrides: Partial<ProvenanceMap> = {}): ProvenanceMap {
  return {
    id: 'pm-1',
    turnId: 'turn-1',
    capsuleIds: ['cap-1'],
    platform: 'claude',
    injectedAt: NOW,
    ...overrides,
  }
}

describe('ProvenanceRepository', () => {
  let repo: ProvenanceRepository

  beforeEach(() => {
    repo = new ProvenanceRepository(makeDb())
  })

  describe('save + getByTurn', () => {
    it('retrieves the provenance map by its turnId', async () => {
      const p = pm()
      await repo.save(p)
      const results = await repo.getByTurn(p.turnId)
      expect(results).toHaveLength(1)
      expect(results[0]).toEqual(p)
    })

    it('returns empty array for an unknown turnId', async () => {
      expect(await repo.getByTurn('nonexistent-turn')).toEqual([])
    })

    it('returns all provenance maps for the same turn', async () => {
      await repo.save(pm({ id: 'pm-1', capsuleIds: ['cap-1'] }))
      await repo.save(pm({ id: 'pm-2', capsuleIds: ['cap-2'] }))
      const results = await repo.getByTurn('turn-1')
      expect(results).toHaveLength(2)
    })

    it('does not mix up maps from different turns', async () => {
      await repo.save(pm({ id: 'pm-1', turnId: 'turn-A' }))
      await repo.save(pm({ id: 'pm-2', turnId: 'turn-B' }))
      const results = await repo.getByTurn('turn-A')
      expect(results).toHaveLength(1)
      expect(results[0]?.id).toBe('pm-1')
    })

    it('upserts — second save with same id overwrites', async () => {
      await repo.save(pm({ capsuleIds: ['cap-1'] }))
      await repo.save(pm({ capsuleIds: ['cap-1', 'cap-2'] }))
      const results = await repo.getByTurn('turn-1')
      expect(results[0]?.capsuleIds).toEqual(['cap-1', 'cap-2'])
    })
  })
})
