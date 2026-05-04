# Phase 2 Design: Persistence (`/packages/extension/src/storage`)

## Goal
Add the Dexie.js IndexedDB layer that the service worker uses for all
capsule storage. Nothing in this phase changes the extension's visible
behaviour — it is infrastructure only.

## Location rationale
Dexie is a browser-runtime API (IndexedDB). It belongs in
`/packages/extension`, not `/packages/shared` (which is pure logic only).
The service worker is the sole caller, consistent with ADR-0002.

## Dexie schema — version 1

| Table          | PK           | Indices                        |
|----------------|--------------|--------------------------------|
| `capsules`     | `&id`        | `platform`, `updatedAt`, `compressed` |
| `bodies`       | `&capsuleId` | —                              |
| `provenanceMaps` | `&id`      | `turnId`, `platform`           |
| `dagEdges`     | `++id`       | `parentId`, `childId`          |

`dagEdges` normalises the parent→child relationship so children of a node
can be found without scanning all manifests. Each `save` on a manifest
atomically syncs the edges for its `parentIds`.

## Test isolation
`ContextForgeDB` accepts an optional `IDBFactory` in its constructor.
Tests pass `new IDBFactory()` from `fake-indexeddb`; production omits it
and uses the browser global. Each test creates a fresh `IDBFactory` to
guarantee isolation.

## LRU eviction policy
Triggered by `maybeEvict()` before saving a new body when quota usage
exceeds 80% (configurable). Eviction:
1. Fetch oldest N capsule ids (by `updatedAt` asc).
2. For each, set `body.full = undefined` (keep `chunks`).
3. Return count evicted.

The `estimateFn` is injectable so the threshold test doesn't need a real
browser quota.

## Migrations pattern
```typescript
// Adding a new index in a future version:
this.version(2).stores({
  capsules: '&id, platform, updatedAt, compressed, tags',  // added tags
}).upgrade(_tx => {
  // no data migration needed — Dexie rebuilds indices automatically
})
```
Rule: never remove a table or rename a primary key.
