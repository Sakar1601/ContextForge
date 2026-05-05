import React, { useState } from 'react'
import type { ConflictMap, MergeResult } from '@contextforge/shared'
import type { CapsuleManifest } from '@contextforge/shared'

type MergeableKey = keyof Omit<CapsuleManifest, 'id' | 'parentIds' | 'updatedAt'>

interface Props {
  result: Extract<MergeResult, { type: 'conflict' }>
  leftId: string
  rightId: string
  onResolve: (resolved: Partial<CapsuleManifest>, parentIds: string[]) => void
  onCancel: () => void
}

function renderValue(v: unknown): string {
  if (Array.isArray(v)) return (v as string[]).join(', ') || '(empty)'
  return String(v)
}

export function MergeConflictModal({ result, leftId, rightId, onResolve, onCancel }: Props) {
  const conflictKeys = Object.keys(result.conflicts) as MergeableKey[]
  const [choices, setChoices] = useState<Record<string, 'left' | 'right'>>(() =>
    Object.fromEntries(conflictKeys.map((k) => [k, 'left' as const])),
  )

  function handleConfirm() {
    const resolved: Partial<CapsuleManifest> = { ...result.partial }
    for (const key of conflictKeys) {
      const conflict = (result.conflicts as ConflictMap)[key]
      if (conflict) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic field resolution
        ;(resolved as any)[key] = choices[key] === 'left' ? conflict.left : conflict.right
      }
    }
    onResolve(resolved, [leftId, rightId])
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 600, width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 16, color: '#111827' }}>Resolve merge conflicts</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
          {conflictKeys.length} field{conflictKeys.length > 1 ? 's' : ''} conflict. Choose which version to keep for each.
        </p>

        {conflictKeys.map((key) => {
          const conflict = (result.conflicts as ConflictMap)[key]
          if (!conflict) return null
          return (
            <div key={key} style={{ marginBottom: 16, borderBottom: '1px solid #f3f4f6', paddingBottom: 16 }}>
              <div style={{ fontWeight: 600, color: '#374151', marginBottom: 8, textTransform: 'capitalize' }}>{key}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setChoices((c) => ({ ...c, [key]: 'left' }))}
                  style={{
                    flex: 1, padding: '6px 8px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                    border: choices[key] === 'left' ? '2px solid #2563eb' : '1px solid #d1d5db',
                    background: choices[key] === 'left' ? '#eff6ff' : '#fff',
                    color: '#374151', textAlign: 'left',
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#2563eb', marginBottom: 2 }}>Left</div>
                  <div style={{ wordBreak: 'break-word' }}>{renderValue(conflict.left)}</div>
                </button>
                <button
                  onClick={() => setChoices((c) => ({ ...c, [key]: 'right' }))}
                  style={{
                    flex: 1, padding: '6px 8px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                    border: choices[key] === 'right' ? '2px solid #16a34a' : '1px solid #d1d5db',
                    background: choices[key] === 'right' ? '#f0fdf4' : '#fff',
                    color: '#374151', textAlign: 'left',
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#16a34a', marginBottom: 2 }}>Right</div>
                  <div style={{ wordBreak: 'break-word' }}>{renderValue(conflict.right)}</div>
                </button>
              </div>
            </div>
          )
        })}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onCancel} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            Cancel
          </button>
          <button onClick={handleConfirm} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            Confirm merge
          </button>
        </div>
      </div>
    </div>
  )
}
