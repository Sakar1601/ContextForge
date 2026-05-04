import type { ProvenanceMap } from '@contextforge/shared'
import type { ContextForgeDB } from '../db'

export class ProvenanceRepository {
  constructor(private readonly db: ContextForgeDB) {}

  async save(map: ProvenanceMap): Promise<void> {
    await this.db.provenanceMaps.put(map)
  }

  async getByTurn(turnId: string): Promise<ProvenanceMap[]> {
    return this.db.provenanceMaps.where('turnId').equals(turnId).toArray()
  }
}
