import React from 'react'
import { Handle, Position } from 'reactflow'
import type { NodeProps } from 'reactflow'
import type { CapsuleManifest } from '@contextforge/shared'

interface CapsuleNodeProps extends NodeProps<CapsuleManifest> {
  data: CapsuleManifest & { isActive?: boolean; isSelected?: boolean }
}

export function CapsuleNode({ data, selected }: CapsuleNodeProps) {
  const isMerge = data.parentIds.length > 1

  const borderColor = data.isActive
    ? '#2563eb'
    : selected
      ? '#16a34a'
      : isMerge
        ? '#7c3aed'
        : '#d1d5db'

  return (
    <div
      style={{
        width: 220,
        padding: '8px 12px',
        background: data.compressed ? '#fff' : '#fefce8',
        border: `2px solid ${borderColor}`,
        borderRadius: 8,
        fontSize: 12,
        boxShadow: selected ? '0 0 0 3px rgba(22,163,74,0.2)' : '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#9ca3af' }} />
      <div style={{ fontWeight: 600, color: '#111827', marginBottom: 2, fontSize: 13 }}>
        {data.title.length > 30 ? `${data.title.slice(0, 30)}…` : data.title}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, padding: '1px 4px', background: '#eff6ff', color: '#1d4ed8', borderRadius: 3 }}>
          {data.platform}
        </span>
        {!data.compressed && (
          <span style={{ fontSize: 10, padding: '1px 4px', background: '#fef9c3', color: '#854d0e', borderRadius: 3 }}>
            raw
          </span>
        )}
        {isMerge && (
          <span style={{ fontSize: 10, padding: '1px 4px', background: '#f3e8ff', color: '#7c3aed', borderRadius: 3 }}>
            merge
          </span>
        )}
        {data.isActive && (
          <span style={{ fontSize: 10, padding: '1px 4px', background: '#dbeafe', color: '#1d4ed8', borderRadius: 3 }}>
            active
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#9ca3af' }} />
    </div>
  )
}
