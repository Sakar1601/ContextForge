import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { CapsuleBody, CapsuleManifest, ProvenanceMap } from '@contextforge/shared'

export type DagEdge = {
  id?: number
  parentId: string
  childId: string
}

// Version history:
//   1 — initial schema
// Rule: never remove a table or rename a primary key. Only additive changes.
// Pattern for future versions:
//   this.version(2).stores({ capsules: '&id, ..., newIndex' }).upgrade(_tx => { /* if needed */ })

export class ContextForgeDB extends Dexie {
  capsules!: Table<CapsuleManifest, string>
  bodies!: Table<CapsuleBody, string>
  provenanceMaps!: Table<ProvenanceMap, string>
  dagEdges!: Table<DagEdge, number>

  // `name` is 'contextforge' in production; unique per-test to guarantee isolation.
  constructor(name = 'contextforge') {
    super(name)
    this.version(1).stores({
      capsules: '&id, platform, updatedAt, compressed',
      bodies: '&capsuleId',
      provenanceMaps: '&id, turnId, platform',
      dagEdges: '++id, parentId, childId',
    })
  }
}
