import type { CapsuleManifest } from '../types/capsule'

async function sha256hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const buffer = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function canonicalize(fields: Omit<CapsuleManifest, 'id'>): string {
  const sortedKeys = Object.keys(fields).sort() as Array<keyof typeof fields>
  const ordered: Record<string, unknown> = {}
  for (const key of sortedKeys) {
    ordered[key] = fields[key]
  }
  return JSON.stringify(ordered)
}

export async function computeCapsuleId(fields: Omit<CapsuleManifest, 'id'>): Promise<string> {
  return sha256hex(canonicalize(fields))
}
