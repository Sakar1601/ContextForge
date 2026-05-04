import type { CapsuleManifest, Platform } from '@contextforge/shared'
import type { ContextForgeDB } from '../db'

export class CapsuleRepository {
  constructor(private readonly db: ContextForgeDB) {}

  async save(manifest: CapsuleManifest): Promise<void> {
    await this.db.transaction('rw', [this.db.capsules, this.db.dagEdges], async () => {
      await this.db.capsules.put(manifest)
      // Replace all child-side edges for this manifest atomically.
      await this.db.dagEdges.where('childId').equals(manifest.id).delete()
      await this.db.dagEdges.bulkAdd(
        manifest.parentIds.map((parentId) => ({ parentId, childId: manifest.id })),
      )
    })
  }

  async get(id: string): Promise<CapsuleManifest | undefined> {
    return this.db.capsules.get(id)
  }

  async listRecent(limit: number): Promise<CapsuleManifest[]> {
    return this.db.capsules.orderBy('updatedAt').reverse().limit(limit).toArray()
  }

  async listByPlatform(platform: Platform): Promise<CapsuleManifest[]> {
    return this.db.capsules.where('platform').equals(platform).toArray()
  }

  async delete(id: string): Promise<void> {
    await this.db.transaction('rw', [this.db.capsules, this.db.dagEdges], async () => {
      await this.db.capsules.delete(id)
      await this.db.dagEdges.where('childId').equals(id).delete()
      await this.db.dagEdges.where('parentId').equals(id).delete()
    })
  }

  async getChildren(parentId: string): Promise<string[]> {
    const edges = await this.db.dagEdges.where('parentId').equals(parentId).toArray()
    return edges.map((e) => e.childId)
  }

  async listOldestIds(limit: number): Promise<string[]> {
    const manifests = await this.db.capsules.orderBy('updatedAt').limit(limit).toArray()
    return manifests.map((m) => m.id)
  }
}
