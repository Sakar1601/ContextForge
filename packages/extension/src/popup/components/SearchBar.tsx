import React, { useState } from 'react'

interface Props {
  onSearch: (query: string) => void
  onClear: () => void
  inputRef?: React.RefObject<HTMLInputElement>
}

export function SearchBar({ onSearch, onClear, inputRef }: Props) {
  const [value, setValue] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    setValue(q)
    if (!q.trim()) onClear()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && value.trim()) onSearch(value.trim())
    if (e.key === 'Escape') { setValue(''); onClear() }
  }

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <input
        ref={inputRef}
        type="search"
        placeholder="Search capsules… (press / to focus)"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        aria-label="Search captured capsules"
        style={{
          width: '100%',
          padding: '6px 28px 6px 8px',
          borderRadius: 6,
          border: '1px solid #d1d5db',
          fontSize: 13,
          outline: 'none',
        }}
      />
      {value && (
        <button
          onClick={() => { setValue(''); onClear() }}
          style={{
            position: 'absolute', right: 6, background: 'none', border: 'none',
            cursor: 'pointer', fontSize: 13, color: '#9ca3af', padding: 0,
          }}
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  )
}
