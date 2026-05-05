export const DROP_MIME = 'application/x-contextforge-capsule'

export function setupDropZone(
  onCapsuleDrop: (capsuleId: string, windowWidth: number) => void,
): () => void {
  let overlay: HTMLElement | null = null

  function showOverlay(near: Element): void {
    if (overlay) return
    overlay = document.createElement('div')
    overlay.id = 'contextforge-drop-overlay'
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'border:3px solid #2563eb',
      'border-radius:8px',
      'pointer-events:none',
      'z-index:2147483647',
      'background:rgba(37,99,235,0.05)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'font-size:14px',
      'color:#2563eb',
      'font-weight:600',
      'font-family:system-ui,sans-serif',
    ].join(';')
    overlay.textContent = 'Drop to inject context'

    const rect = near.getBoundingClientRect()
    if (rect.width > 0) {
      overlay.style.top = `${rect.top}px`
      overlay.style.left = `${rect.left}px`
      overlay.style.width = `${rect.width}px`
      overlay.style.height = `${rect.height}px`
      overlay.style.inset = 'unset'
    }

    document.body.appendChild(overlay)
  }

  function hideOverlay(): void {
    overlay?.remove()
    overlay = null
  }

  function handleDragEnter(e: DragEvent) {
    if (!e.dataTransfer?.types.includes(DROP_MIME)) return
    e.preventDefault()
    showOverlay(e.target as Element)
  }

  function handleDragOver(e: DragEvent) {
    if (!e.dataTransfer?.types.includes(DROP_MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  function handleDragLeave(e: DragEvent) {
    if (e.relatedTarget === null) hideOverlay()
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    hideOverlay()
    const id = e.dataTransfer?.getData(DROP_MIME)
    if (id) onCapsuleDrop(id, window.innerWidth)
  }

  document.addEventListener('dragenter', handleDragEnter)
  document.addEventListener('dragover', handleDragOver)
  document.addEventListener('dragleave', handleDragLeave)
  document.addEventListener('drop', handleDrop)

  return () => {
    document.removeEventListener('dragenter', handleDragEnter)
    document.removeEventListener('dragover', handleDragOver)
    document.removeEventListener('dragleave', handleDragLeave)
    document.removeEventListener('drop', handleDrop)
    hideOverlay()
  }
}
