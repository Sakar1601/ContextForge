import React, { useState } from 'react'

interface Props {
  capsuleId: string
  initialScore?: number | undefined
}

export function LiftBadge({ capsuleId, initialScore }: Props) {
  const [score, setScore] = useState<number | undefined>(initialScore)
  const [saving, setSaving] = useState(false)

  async function rate(value: 1 | -1) {
    setSaving(true)
    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_LIFT_SCORE_REQUEST',
        capsuleId,
        liftScore: value,
      })
      setScore(value)
    } finally {
      setSaving(false)
    }
  }

  if (score !== undefined) {
    return (
      <span
        title={`Lift score: ${score > 0 ? '+' : ''}${score}`}
        style={{
          fontSize: '10px',
          padding: '1px 5px',
          borderRadius: '4px',
          background: score > 0 ? '#dcfce7' : '#fee2e2',
          color: score > 0 ? '#166534' : '#991b1b',
          cursor: 'pointer',
        }}
        onClick={() => setScore(undefined)}
      >
        {score > 0 ? '👍' : '👎'}
      </span>
    )
  }

  return (
    <span style={{ display: 'flex', gap: '2px' }}>
      <button
        disabled={saving}
        onClick={(e) => { e.stopPropagation(); void rate(1) }}
        title="This capsule improved the response"
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '0 1px', lineHeight: 1 }}
      >
        👍
      </button>
      <button
        disabled={saving}
        onClick={(e) => { e.stopPropagation(); void rate(-1) }}
        title="This capsule did not help"
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '0 1px', lineHeight: 1 }}
      >
        👎
      </button>
    </span>
  )
}
