import type {
  AdapterHealth,
  CapsuleManifest,
  ConversationTurn,
  InjectionResolution,
  SiteAdapter,
} from '@contextforge/shared'
import { SELECTORS } from './selectors'

export class ChatGPTAdapter implements SiteAdapter {
  readonly platform = 'chatgpt' as const

  health(): AdapterHealth {
    if (!document.querySelector(SELECTORS.composer)) {
      return { status: 'unhealthy', reason: 'Composer element not found — chatgpt.com DOM may have changed' }
    }
    return { status: 'healthy' }
  }

  extractConversation(): ConversationTurn[] {
    const turns: ConversationTurn[] = []
    let index = 0
    const allTurns = [
      ...Array.from(document.querySelectorAll(SELECTORS.humanTurn)).map((el) => ({ el, role: 'user' as const })),
      ...Array.from(document.querySelectorAll(SELECTORS.assistantTurn)).map((el) => ({ el, role: 'assistant' as const })),
    ].sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))

    for (const { el, role } of allTurns) {
      const contentEl = el.querySelector(SELECTORS.turnContent)
      const content = (contentEl ?? el).textContent?.trim() ?? ''
      if (content) turns.push({ role, content, index: index++ })
    }
    return turns
  }

  getInjectionTarget(): Element | null {
    return document.querySelector(SELECTORS.composer)
  }

  injectContext(capsule: CapsuleManifest, resolution: InjectionResolution): Element {
    const target = this.getInjectionTarget()
    if (!target) throw new Error('No injection target found')
    return insertContextBlock(target, capsule, resolution)
  }

  observeChanges(callback: (turns: ConversationTurn[]) => void): () => void {
    const container = document.querySelector(SELECTORS.turnContainer) ?? document.body
    const observer = new MutationObserver(() => callback(this.extractConversation()))
    observer.observe(container, { childList: true, subtree: true })
    return () => observer.disconnect()
  }
}

function insertContextBlock(target: Element, capsule: CapsuleManifest, resolution: InjectionResolution): Element {
  const lines: string[] = [`📎 Context: ${capsule.title}`]
  if (resolution === 'full' || resolution === 'compact') {
    if (capsule.goals.length) lines.push(`Goals: ${capsule.goals.join('; ')}`)
    if (capsule.constraints.length) lines.push(`Constraints: ${capsule.constraints.join('; ')}`)
  }
  if (resolution === 'full') {
    if (capsule.decisions.length) lines.push(`Decisions: ${capsule.decisions.join('; ')}`)
    if (capsule.openQuestions.length) lines.push(`Open: ${capsule.openQuestions.join('; ')}`)
  }
  if (resolution === 'minimal') lines.push(capsule.summary)
  lines.push(`[via ContextForge]\n`)
  const text = lines.join('\n')
  if (target instanceof HTMLElement) target.focus()
  const sel = window.getSelection()
  if (sel) {
    const range = document.createRange()
    range.selectNodeContents(target)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
  }
  const inserted = typeof document.execCommand === 'function' && document.execCommand('insertText', false, text); if (!inserted) { const node = document.createTextNode(text); if (sel?.rangeCount) { const r = sel.getRangeAt(0); r.insertNode(node); r.collapse(false) } else { target.insertBefore(node, target.firstChild) } }
  const sentinel = document.createElement('span')
  sentinel.setAttribute('data-contextforge', capsule.id)
  sentinel.setAttribute('data-contextforge-footer', '')
  sentinel.style.display = 'none'
  target.appendChild(sentinel)
  return sentinel
}
