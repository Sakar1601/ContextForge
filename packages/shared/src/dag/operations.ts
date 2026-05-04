import type { CapsuleManifest } from '../types/capsule'
import { computeCapsuleId } from './hash'

// ─── public types ─────────────────────────────────────────────────────────────

export type Branch = { name: string; tipId: string }

export type FieldChange<T> =
  | { type: 'unchanged'; value: T }
  | { type: 'changed'; from: T; to: T }

export type DiffResult = {
  [K in keyof CapsuleManifest]: FieldChange<CapsuleManifest[K]>
}

type MergeableFields = Omit<CapsuleManifest, 'id' | 'parentIds' | 'updatedAt'>

export type FieldConflict<T> = { base: T; left: T; right: T }

export type ConflictMap = {
  [K in keyof MergeableFields]?: FieldConflict<MergeableFields[K]>
}

export type MergeResult =
  | { type: 'clean'; manifest: MergeableFields }
  | { type: 'conflict'; partial: MergeableFields; conflicts: ConflictMap }

// ─── implementation helpers ───────────────────────────────────────────────────

const DAG_CONTROLLED = new Set<keyof CapsuleManifest>(['id', 'parentIds', 'updatedAt'])

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function strSetDiff(a: string[], b: string[]): string[] {
  const bSet = new Set(b)
  return a.filter((x) => !bSet.has(x))
}

function strSetUnion(...arrays: string[][]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const arr of arrays) {
    for (const x of arr) {
      if (!seen.has(x)) {
        seen.add(x)
        result.push(x)
      }
    }
  }
  return result
}

type ArrayMergeOutcome =
  | { conflict: false; merged: string[] }
  | { conflict: true }

function mergeStringArrays(base: string[], left: string[], right: string[]): ArrayMergeOutcome {
  const leftAdded = strSetDiff(left, base)
  const leftRemoved = strSetDiff(base, left)
  const rightAdded = strSetDiff(right, base)
  const rightRemoved = strSetDiff(base, right)

  // Conflict: one side added items while the other removed items from the same array.
  // This indicates structurally incompatible intentions (e.g. left extends while right wipes).
  const hasConflict =
    (leftAdded.length > 0 && rightRemoved.length > 0) ||
    (rightAdded.length > 0 && leftRemoved.length > 0)

  if (hasConflict) return { conflict: true }

  const merged = strSetDiff(
    strSetUnion(base, leftAdded, rightAdded),
    strSetUnion(leftRemoved, rightRemoved),
  )
  return { conflict: false, merged }
}

// ─── public API ───────────────────────────────────────────────────────────────

export async function commit(fields: Omit<CapsuleManifest, 'id'>): Promise<CapsuleManifest> {
  const id = await computeCapsuleId(fields)
  return { ...fields, id }
}

export function branchFrom(name: string, tip: CapsuleManifest): Branch {
  return { name, tipId: tip.id }
}

export function merge(
  base: CapsuleManifest,
  left: CapsuleManifest,
  right: CapsuleManifest,
): MergeResult {
  const mergeableKeys = (Object.keys(base) as Array<keyof CapsuleManifest>).filter(
    (k) => !DAG_CONTROLLED.has(k),
  )

  const partialRecord: Record<string, unknown> = {}
  const conflictsRecord: Record<string, unknown> = {}

  for (const key of mergeableKeys) {
    const baseVal: unknown = base[key]
    const leftVal: unknown = left[key]
    const rightVal: unknown = right[key]

    const leftChanged = !deepEqual(leftVal, baseVal)
    const rightChanged = !deepEqual(rightVal, baseVal)

    if (!leftChanged && !rightChanged) {
      partialRecord[key] = baseVal
    } else if (leftChanged && !rightChanged) {
      partialRecord[key] = leftVal
    } else if (!leftChanged && rightChanged) {
      partialRecord[key] = rightVal
    } else if (deepEqual(leftVal, rightVal)) {
      partialRecord[key] = leftVal
    } else if (Array.isArray(baseVal) && Array.isArray(leftVal) && Array.isArray(rightVal)) {
      const outcome = mergeStringArrays(
        baseVal as string[],
        leftVal as string[],
        rightVal as string[],
      )
      if (outcome.conflict) {
        conflictsRecord[key] = { base: baseVal, left: leftVal, right: rightVal }
        partialRecord[key] = leftVal
      } else {
        partialRecord[key] = outcome.merged
      }
    } else {
      conflictsRecord[key] = { base: baseVal, left: leftVal, right: rightVal }
      partialRecord[key] = leftVal
    }
  }

  const manifest = partialRecord as MergeableFields
  const conflicts = conflictsRecord as ConflictMap

  if (Object.keys(conflictsRecord).length === 0) {
    return { type: 'clean', manifest }
  }
  return { type: 'conflict', partial: manifest, conflicts }
}

export function diff(a: CapsuleManifest, b: CapsuleManifest): DiffResult {
  const resultRecord: Record<string, unknown> = {}

  for (const key of Object.keys(a) as Array<keyof CapsuleManifest>) {
    const aVal: unknown = a[key]
    const bVal: unknown = b[key]
    resultRecord[key] = deepEqual(aVal, bVal)
      ? { type: 'unchanged', value: aVal }
      : { type: 'changed', from: aVal, to: bVal }
  }

  return resultRecord as DiffResult
}

export function cherryPickFields(
  source: CapsuleManifest,
  fields: ReadonlyArray<keyof CapsuleManifest>,
): Partial<CapsuleManifest> {
  const result: Record<string, unknown> = {}
  for (const key of fields) {
    result[key] = source[key]
  }
  return result as Partial<CapsuleManifest>
}
