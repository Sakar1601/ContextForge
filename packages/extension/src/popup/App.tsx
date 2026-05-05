import React, { useCallback, useEffect, useState } from 'react'
import { CaptureButton } from './components/CaptureButton'
import { CapsuleList } from './components/CapsuleList'
import { SearchBar } from './components/SearchBar'
import { useAdapterHealth } from './hooks/useAdapterHealth'
import { useCapsules } from './hooks/useCapsules'
import type { CapsuleManifest } from '@contextforge/shared'

export default function App() {
  const [tabId, setTabId] = useState<number | null>(null)
  const [searchResults, setSearchResults] = useState<CapsuleManifest[] | null>(null)

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      setTabId(tabs[0]?.id ?? null)
    })
  }, [])

  const health = useAdapterHealth(tabId)
  const { capsules, loading, refresh } = useCapsules(20)

  const handleSearch = useCallback((query: string) => {
    chrome.runtime
      .sendMessage({ type: 'SEARCH_REQUEST', query, limit: 10 })
      .then((r: { capsuleIds?: string[] }) => {
        const ids = r.capsuleIds ?? []
        const matched = ids
          .map((id) => capsules.find((m) => m.id === id))
          .filter(Boolean) as CapsuleManifest[]
        setSearchResults(matched)
      })
      .catch(() => setSearchResults([]))
  }, [capsules])

  const handleSearchClear = useCallback(() => setSearchResults(null), [])

  const displayList = searchResults ?? capsules
  const displayLoading = loading && searchResults === null

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

      <div style={{ padding: '8px 16px', borderBottom: '1px solid #e5e7eb' }}>
        <SearchBar onSearch={handleSearch} onClear={handleSearchClear} />
      </div>

      <div style={{ padding: '8px 16px', borderBottom: '1px solid #e5e7eb' }}>
        <CaptureButton health={health} tabId={tabId} onCaptured={refresh} />
      </div>

      <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
        {searchResults !== null && searchResults.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
            No capsules match your search.
          </div>
        ) : (
          <CapsuleList capsules={displayList} loading={displayLoading} />
        )}
      </div>
    </div>
  )
}
