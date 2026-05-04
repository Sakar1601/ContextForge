import type { CapsuleBody } from '@contextforge/shared'
import type { ContextForgeDB } from '../db'

export class BodyRepository {
  constructor(private readonly db: ContextForgeDB) {}

  async save(body: CapsuleBody): Promise<void> {
    await this.db.bodies.put(body)
  }

  async get(capsuleId: string): Promise<CapsuleBody | undefined> {
    return this.db.bodies.get(capsuleId)
  }

  async evictFullText(count: number, orderedIds: string[]): Promise<number> {
    let evicted = 0
    for (const id of orderedIds) {
      if (evicted >= count) break
      const body = await this.db.bodies.get(id)
      if (body?.full !== undefined) {
        const { full: _full, ...rest } = body
        await this.db.bodies.put(rest)
        evicted++
      }
    }
    return evicted
  }
}
