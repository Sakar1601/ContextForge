import React, { useCallback, useEffect, useRef, useState } from 'react'
import { CaptureButton } from './components/CaptureButton'
import { CapsuleList } from './components/CapsuleList'
import { SearchBar } from './components/SearchBar'
import { SettingsView } from './components/SettingsView'
import { useAdapterHealth } from './hooks/useAdapterHealth'
import { useCapsules } from './hooks/useCapsules'
import type { CapsuleManifest } from '@contextforge/shared'

export default function App() {
  const [tabId, setTabId] = useState<number | null>(null)
  const [searchResults, setSearchResults] = useState<CapsuleManifest[] | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const searchRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      setTabId(tabs[0]?.id ?? null)
    })
    // Show settings on first run if API key not yet set
    chrome.storage.local.get(['anthropicApiKey', 'onboardingDone']).then((s) => {
      if (!s['anthropicApiKey'] && !s['onboardingDone']) {
        setShowSettings(true)
        void chrome.storage.local.set({ onboardingDone: true })
      }
    })
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (document.activeElement as HTMLElement)?.tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA'
      if (e.key === '/' && !isInput) {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setSearchResults(null)
        setShowSettings(false)
      }
      if (e.key === 'g' && !isInput && !showSettings) {
        // Open graph for first capsule in list (if any)
        chrome.runtime
          .sendMessage({ type: 'LIST_CAPSULES_REQUEST', limit: 1 })
          .then((r: { manifests?: CapsuleManifest[] }) => {
            const first = r.manifests?.[0]
            if (first) {
              void chrome.tabs.create({
                url: `${chrome.runtime.getURL('src/graph/index.html')}?id=${first.id}`,
              })
            }
          })
          .catch(() => {/* ignore */})
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showSettings])

  const health = useAdapterHealth(tabId)
  const { capsules, loading, refresh } = useCapsules(20)

  const handleSearch = useCallback((query: string) => {
    // 1. Get ranked IDs from hybrid search
    // 2. Fetch ALL manifests (up to 500) so search works beyond the 20-capsule popup cache
    Promise.all([
      chrome.runtime.sendMessage({ type: 'SEARCH_REQUEST', query, limit: 10 }) as Promise<{ capsuleIds?: string[] }>,
      chrome.runtime.sendMessage({ type: 'LIST_CAPSULES_REQUEST', limit: 500 }) as Promise<{ manifests?: CapsuleManifest[] }>,
    ])
      .then(([searchRes, listRes]) => {
        const ids = searchRes.capsuleIds ?? []
        const allMap = new Map((listRes.manifests ?? []).map((m) => [m.id, m]))
        setSearchResults(ids.map((id) => allMap.get(id)).filter(Boolean) as CapsuleManifest[])
      })
      .catch(() => setSearchResults([]))
  }, [])

  const handleSearchClear = useCallback(() => setSearchResults(null), [])

  if (showSettings) {
    return <SettingsView onClose={() => setShowSettings(false)} />
  }

  const displayList = searchResults ?? capsules
  const displayLoading = loading && searchResults === null

  return (
    <div style={{ width: '380px', fontFamily: 'system-ui, sans-serif' }} role="main">
      {/* Header */}
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: '15px', color: '#111827', flex: 1 }}>
          ContextForge
        </span>
        <span
          aria-label={`Adapter status: ${health?.status ?? 'checking'}`}
          style={{
            fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
            background: health?.status === 'healthy' ? '#dcfce7' : '#f3f4f6',
            color: health?.status === 'healthy' ? '#166534' : '#6b7280',
          }}
        >
          {health === null ? '…' : health.status}
        </span>
        <button
          onClick={() => setShowSettings(true)}
          aria-label="Open settings"
          title="Settings"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '15px', color: '#6b7280', padding: '0 2px', lineHeight: 1,
          }}
        >
          ⚙
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #e5e7eb' }}>
        <SearchBar
          onSearch={handleSearch}
          onClear={handleSearchClear}
          inputRef={searchRef}
        />
      </div>

      {/* Capture */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #e5e7eb' }}>
        <CaptureButton health={health} tabId={tabId} onCaptured={refresh} />
      </div>

      {/* Capsule list */}
      <div style={{ maxHeight: '300px', overflowY: 'auto' }} role="list" aria-label="Captured capsules">
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
