import React from 'react'
import type { CapsuleManifest } from '@contextforge/shared'
import { CapsuleCard } from './CapsuleCard'

interface Props {
  capsules: CapsuleManifest[]
  loading: boolean
}

export function CapsuleList({ capsules, loading }: Props) {
  if (loading) {
    return (
      <div role="status" aria-live="polite" style={{ padding: '16px', fontSize: '13px', color: '#9ca3af' }}>
        Loading…
      </div>
    )
  }

  if (capsules.length === 0) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
        No capsules yet. Capture a conversation to get started.
      </div>
    )
  }

  return (
    <div>
      {capsules.map((m) => (
        <CapsuleCard key={m.id} manifest={m} />
      ))}
    </div>
  )
}
