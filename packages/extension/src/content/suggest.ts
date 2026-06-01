// Floating "Suggest capsules" widget — injected by each platform content script.
// Shows top 3 matching capsules when the composer is focused.

import type { CapsuleManifest } from '@contextforge/shared'

const DEBOUNCE_MS = 400

export function setupSuggest(composerSelector: string): () => void {
  let panel: HTMLElement | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  function removePanel() {
    panel?.remove()
    panel = null
  }

  function showPanel(manifests: CapsuleManifest[]) {
    removePanel()
    if (manifests.length === 0) return

    panel = document.createElement('div')
    panel.id = 'contextforge-suggest'
    panel.style.cssText = [
      'position:fixed', 'bottom:80px', 'right:20px', 'z-index:2147483646',
      'background:#fff', 'border:1px solid #e5e7eb', 'border-radius:10px',
      'box-shadow:0 4px 16px rgba(0,0,0,0.12)', 'padding:8px 0',
      'min-width:260px', 'max-width:320px', 'font-family:system-ui,sans-serif',
    ].join(';')

    const header = document.createElement('div')
    header.style.cssText = 'padding:4px 12px 6px;font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:.05em'
    header.textContent = 'Suggested capsules'
    panel.appendChild(header)

    for (const m of manifests.slice(0, 3)) {
      const row = document.createElement('div')
      row.style.cssText = 'display:flex;align-items:center;padding:6px 12px;gap:8px;cursor:default;border-top:1px solid #f9fafb'
      row.onmouseenter = () => (row.style.background = '#f9fafb')
      row.onmouseleave = () => (row.style.background = '')

      const title = document.createElement('span')
      title.style.cssText = 'flex:1;font-size:13px;color:#111827;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
      title.textContent = m.title

      const btn = document.createElement('button')
      btn.textContent = 'Inject'
      btn.style.cssText = 'padding:3px 10px;background:#2563eb;color:#fff;border:none;border-radius:5px;font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0'
      btn.onclick = () => {
        void chrome.runtime.sendMessage({
          type: 'INJECT_REQUEST', capsuleId: m.id, windowWidth: window.innerWidth,
        })
        removePanel()
      }

      row.appendChild(title)
      row.appendChild(btn)
      panel.appendChild(row)
    }

    const closeBtn = document.createElement('button')
    closeBtn.textContent = '✕'
    closeBtn.style.cssText = 'position:absolute;top:6px;right:8px;background:none;border:none;cursor:pointer;font-size:13px;color:#9ca3af;padding:0'
    closeBtn.onclick = removePanel
    panel.appendChild(closeBtn)
    panel.style.position = 'fixed'

    document.body.appendChild(panel)
  }

  function handleFocus(e: FocusEvent) {
    const composer = document.querySelector(composerSelector)
    // Only trigger when the composer itself (or a child of it) receives focus.
    if (!composer || !composer.contains(e.target as Node)) return
    const text = composer.textContent?.trim() ?? ''
    if (!text) return

    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      void chrome.runtime
        .sendMessage({ type: 'SEARCH_REQUEST', query: text, limit: 3 })
        .then((r: { capsuleIds?: string[] }) => {
          const ids = r.capsuleIds ?? []
          if (ids.length === 0) return
          // Fetch manifests via LIST_CAPSULES and filter
          void chrome.runtime
            .sendMessage({ type: 'LIST_CAPSULES_REQUEST', limit: 100 })
            .then((lr: { manifests?: CapsuleManifest[] }) => {
              const all = lr.manifests ?? []
              const matched = ids.map((id) => all.find((m) => m.id === id)).filter(Boolean) as CapsuleManifest[]
              showPanel(matched)
            })
        })
    }, DEBOUNCE_MS)
  }

  function handleBlur() {
    if (timer) clearTimeout(timer)
    // Delay removal so Inject button clicks register first
    setTimeout(removePanel, 200)
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') removePanel()
  }

  document.addEventListener('focusin', handleFocus as EventListener)
  document.addEventListener('focusout', handleBlur)
  document.addEventListener('keydown', handleKeydown)

  return () => {
    document.removeEventListener('focusin', handleFocus as EventListener)
    document.removeEventListener('focusout', handleBlur)
    document.removeEventListener('keydown', handleKeydown)
    removePanel()
  }
}
