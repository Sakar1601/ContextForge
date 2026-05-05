import React, { useEffect, useState } from 'react'
import { CaptureButton } from './components/CaptureButton'
import { CapsuleList } from './components/CapsuleList'
import { useAdapterHealth } from './hooks/useAdapterHealth'
import { useCapsules } from './hooks/useCapsules'

export default function App() {
  const [tabId, setTabId] = useState<number | null>(null)

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      setTabId(tabs[0]?.id ?? null)
    })
  }, [])

  const health = useAdapterHealth(tabId)
  const { capsules, loading, refresh } = useCapsules(20)

  return (
    <div style={{ width: '380px', fontFamily: 'system-ui, sans-serif' }}>
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: '15px', color: '#111827' }}>ContextForge</span>
        <span
          style={{
            fontSize: '10px',
            padding: '2px 6px',
            borderRadius: '4px',
            background: health?.status === 'healthy' ? '#dcfce7' : '#f3f4f6',
            color: health?.status === 'healthy' ? '#166534' : '#6b7280',
          }}
        >
          {health === null ? '…' : health.status}
        </span>
      </div>

      <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
        <CaptureButton health={health} tabId={tabId} onCaptured={refresh} />
      </div>

      <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
        <CapsuleList capsules={capsules} loading={loading} />
      </div>
    </div>
  )
}
