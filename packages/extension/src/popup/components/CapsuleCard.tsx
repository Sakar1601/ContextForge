import React from 'react'
import type { CapsuleManifest } from '@contextforge/shared'
import { DROP_MIME } from '@contextforge/adapter-claude'

const PLATFORM_LABELS: Record<string, string> = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  perplexity: 'Perplexity',
  deepseek: 'DeepSeek',
  gmail: 'Gmail',
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

interface Props {
  manifest: CapsuleManifest
}

export function CapsuleCard({ manifest }: Props) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DROP_MIME, manifest.id)
        e.dataTransfer.effectAllowed = 'copy'
      }}
      style={{
        padding: '10px 12px',
        borderBottom: '1px solid #f3f4f6',
        cursor: 'grab',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
        {/* Drag handle indicator */}
        <span style={{ fontSize: '12px', color: '#d1d5db', marginRight: '2px' }} title="Drag to inject">
          ⠿
        </span>
        <span
          style={{
            fontSize: '10px',
            padding: '1px 5px',
            background: '#eff6ff',
            color: '#1d4ed8',
            borderRadius: '4px',
            fontWeight: 600,
          }}
        >
          {PLATFORM_LABELS[manifest.platform] ?? manifest.platform}
        </span>
        {!manifest.compressed && (
          <span
            style={{
              fontSize: '10px',
              padding: '1px 5px',
              background: '#fef9c3',
              color: '#854d0e',
              borderRadius: '4px',
            }}
          >
            raw
          </span>
        )}
        <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: 'auto' }}>
          {timeAgo(manifest.updatedAt)}
        </span>
      </div>
      <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>{manifest.title}</div>
      {manifest.summary && (
        <div
          style={{
            fontSize: '11px',
            color: '#6b7280',
            marginTop: '2px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {manifest.summary}
        </div>
      )}
    </div>
  )
}
