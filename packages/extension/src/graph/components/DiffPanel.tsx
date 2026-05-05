import React from 'react'
import { diff } from '@contextforge/shared'
import type { CapsuleManifest } from '@contextforge/shared'

const SKIP_FIELDS: Array<keyof CapsuleManifest> = ['id', 'parentIds', 'createdAt', 'updatedAt']

interface Props {
  from: CapsuleManifest
  to: CapsuleManifest
}

export function DiffPanel({ from, to }: Props) {
  const result = diff(from, to)
  const changed = (Object.keys(result) as Array<keyof CapsuleManifest>).filter(
    (k) => !SKIP_FIELDS.includes(k) && result[k]?.type === 'changed',
  )

  if (changed.length === 0) {
    return (
      <div style={{ padding: '8px 12px', fontSize: 12, color: '#6b7280' }}>
        No content changes from parent.
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 12px', fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: '#111827' }}>
        Changes from parent ({changed.length} field{changed.length > 1 ? 's' : ''})
      </div>
      {changed.map((field) => {
        const entry = result[field]
        if (entry?.type !== 'changed') return null
        const fromVal = JSON.stringify(entry.from)
        const toVal = JSON.stringify(entry.to)
        return (
          <div key={field} style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 500, color: '#374151', textTransform: 'capitalize' }}>
              {field}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
              <div style={{ flex: 1, background: '#fee2e2', borderRadius: 4, padding: '2px 6px', wordBreak: 'break-word', color: '#991b1b' }}>
                {fromVal.length > 120 ? `${fromVal.slice(0, 120)}…` : fromVal}
              </div>
              <div style={{ flex: 1, background: '#dcfce7', borderRadius: 4, padding: '2px 6px', wordBreak: 'break-word', color: '#166534' }}>
                {toVal.length > 120 ? `${toVal.slice(0, 120)}…` : toVal}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
