import React, { useState } from 'react'
import type { AdapterHealth } from '@contextforge/shared'

interface Props {
  health: AdapterHealth | null
  tabId: number | null
  onCaptured: () => void
}

export function CaptureButton({ health, tabId, onCaptured }: Props) {
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isHealthy = health?.status === 'healthy'
  const disabledReason =
    health === null
      ? 'Checking adapter…'
      : health.status === 'unhealthy'
        ? health.reason
        : null

  async function handleCapture() {
    if (!tabId || !isHealthy) return
    setCapturing(true)
    setError(null)
    try {
      const res = (await chrome.runtime.sendMessage({
        type: 'CAPTURE_REQUEST',
        tabId,
      })) as { capsuleId: string; error?: string }
      if (res.error) {
        setError(res.error)
      } else {
        onCaptured()
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setCapturing(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleCapture}
        disabled={!isHealthy || capturing || tabId === null}
        title={disabledReason ?? undefined}
        style={{
          width: '100%',
          padding: '8px 12px',
          background: isHealthy ? '#2563eb' : '#9ca3af',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: isHealthy ? 'pointer' : 'not-allowed',
        }}
      >
        {capturing ? 'Capturing…' : 'Capture conversation'}
      </button>
      {disabledReason && (
        <p style={{ fontSize: '11px', color: '#6b7280', margin: '4px 0 0' }}>{disabledReason}</p>
      )}
      {error && (
        <p style={{ fontSize: '11px', color: '#dc2626', margin: '4px 0 0' }}>{error}</p>
      )}
    </div>
  )
}
