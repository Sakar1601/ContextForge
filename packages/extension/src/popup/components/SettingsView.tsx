import React, { useEffect, useState } from 'react'

interface Props { onClose: () => void }

export function SettingsView({ onClose }: Props) {
  const [apiKey, setApiKey] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    chrome.storage.local.get('anthropicApiKey').then((s) => {
      setApiKey((s['anthropicApiKey'] as string | undefined) ?? '')
    })
  }, [])

  async function handleSave() {
    await chrome.storage.local.set({ anthropicApiKey: apiKey.trim() })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ padding: '16px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>Settings</span>
        <button
          onClick={onClose}
          aria-label="Close settings"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#6b7280', padding: 0 }}
        >
          ✕
        </button>
      </div>

      <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500, color: '#374151' }}>
        Anthropic API key
      </label>
      <input
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="sk-ant-..."
        aria-label="Anthropic API key"
        style={{
          width: '100%', padding: '7px 10px', border: '1px solid #d1d5db',
          borderRadius: 6, fontSize: 13, marginBottom: 8,
          fontFamily: 'monospace', boxSizing: 'border-box',
        }}
      />
      <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 12px' }}>
        Required for AI-powered compression. Stored locally — never sent anywhere except Anthropic.
        Without a key, capsules are captured in raw mode.
      </p>

      <button
        onClick={() => void handleSave()}
        style={{
          width: '100%', padding: '8px', background: '#2563eb', color: '#fff',
          border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}
      >
        {saved ? '✓ Saved' : 'Save'}
      </button>

      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6, fontWeight: 500 }}>Keyboard shortcuts</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px', fontSize: 12, color: '#6b7280' }}>
          <span>Search capsules</span><kbd style={kbdStyle}>/</kbd>
          <span>Close panel / clear</span><kbd style={kbdStyle}>Esc</kbd>
          <span>Open version graph</span><kbd style={kbdStyle}>G</kbd>
        </div>
      </div>
    </div>
  )
}

const kbdStyle: React.CSSProperties = {
  background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4,
  padding: '1px 5px', fontSize: 11, fontFamily: 'monospace', color: '#374151',
}
