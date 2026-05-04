# Phase 1 Design: Capsule Core (`/packages/shared`)

## Goal
Define all types, Zod schemas, and pure-logic functions that the rest of the
codebase imports. Nothing in this phase touches the network or IndexedDB.

## Module layout

```
src/
  types/
    platform.ts      — Platform enum + schema
    capsule.ts       — CapsuleManifest, CapsuleBody, Capsule, Chunk
    provenance.ts    — ProvenanceMap
    adapter.ts       — SiteAdapter, AdapterHealth, ConversationTurn,
                       InjectionResolution
    messaging.ts     — ExtensionMessage discriminated union
  dag/
    hash.ts          — computeCapsuleId (async SHA-256, Web Crypto)
    operations.ts    — commit, branchFrom, merge, diff, cherryPickFields
  index.ts           — re-exports entire public API
```

## ID derivation

`capsuleId = SHA-256( canonical_manifest )`

Where `canonical_manifest = JSON.stringify(manifest_without_id, sorted_keys)`.

This handles both initial captures (the compression pipeline fills all fields)
and subsequent DAG commits (merge, edit) uniformly. Uses `globalThis.crypto.subtle`
which is available in browsers and Node 18+.

## Merge algorithm

For each mergeable field (everything except `id`, `parentIds`, `updatedAt`):

| left changed? | right changed? | result                                        |
|:---:|:---:|---|
| no  | no  | keep base value                              |
| yes | no  | take left                                    |
| no  | yes | take right                                   |
| yes | yes | same value → take either; differ → **conflict** |

"Changed" is detected by `JSON.stringify` equality (order-sensitive for arrays).
This is conservative for arrays: reordering goals counts as a change.
The Phase 5 UI offers sorting/dedup tools to resolve ordering differences.

Merge returns `MergeableFields` — the caller appends `parentIds`, `updatedAt`,
then calls `commit()` to obtain the new `id`.

## Key type decisions

- `compressed: boolean` on `CapsuleManifest` — not in the original SPEC field
  list, but required by the failure mode "mark `compressed: false`, queue for
  retry". Kept on the manifest (never evicted) so the popup can show a
  "pending compression" badge.

- `CapsuleBody.full` is `string | undefined` — matches the eviction policy.

- `Branch` is a named pointer `{ name, tipId }`. The full DAG is reconstructable
  by traversing `parentIds`. Branches are in-memory in Phase 1, persisted to
  Dexie in Phase 2.

## Coverage requirement

90%+ lines, branches, and functions before phase exit. Enforced via
`@vitest/coverage-v8` thresholds in `vitest.config.ts`.
