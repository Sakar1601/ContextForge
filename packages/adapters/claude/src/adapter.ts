import type {
  AdapterHealth,
  CapsuleManifest,
  ConversationTurn,
  InjectionResolution,
  SiteAdapter,
} from '@contextforge/shared'
import { SELECTORS } from './selectors'

export class ClaudeAdapter implements SiteAdapter {
  readonly platform = 'claude' as const

  health(): AdapterHealth {
    const composer = document.querySelector(SELECTORS.composer)
    if (!composer) {
      return { status: 'unhealthy', reason: 'Composer element not found — claude.ai DOM may have changed' }
    }
    return { status: 'healthy' }
  }

  extractConversation(): ConversationTurn[] {
    const turns: ConversationTurn[] = []
    let index = 0

    const humanEls = document.querySelectorAll(SELECTORS.humanTurn)
    const assistantEls = document.querySelectorAll(SELECTORS.assistantTurn)

    // Interleave by DOM order
    const allTurns = [
      ...Array.from(humanEls).map((el) => ({ el, role: 'user' as const })),
      ...Array.from(assistantEls).map((el) => ({ el, role: 'assistant' as const })),
    ].sort((a, b) => {
      const pos = a.el.compareDocumentPosition(b.el)
      return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    })

    for (const { el, role } of allTurns) {
      const contentEl = el.querySelector(SELECTORS.turnContent)
      const content = (contentEl ?? el).textContent?.trim() ?? ''
      if (content) {
        turns.push({ role, content, index: index++ })
      }
    }

    return turns
  }

  getInjectionTarget(): Element | null {
    return document.querySelector(SELECTORS.composer)
  }

  injectContext(capsule: CapsuleManifest, resolution: InjectionResolution): Element {
    const target = this.getInjectionTarget()
    if (!target) throw new Error('No injection target found')
    return injectAsText(target, capsule, resolution)
  }

  observeChanges(callback: (turns: ConversationTurn[]) => void): () => void {
    const container =
      document.querySelector(SELECTORS.turnContainer) ?? document.body

    const observer = new MutationObserver(() => {
      callback(this.extractConversation())
    })

    observer.observe(container, { childList: true, subtree: true })
    return () => observer.disconnect()
  }
}

// Inserts context text directly into the contenteditable composer so it
// is included when the user sends the message.
function injectAsText(
  target: Element,
  capsule: CapsuleManifest,
  resolution: InjectionResolution,
): Element {
  const hasStructuredContent = capsule.goals.length > 0 || capsule.constraints.length > 0
    || capsule.decisions.length > 0 || capsule.openQuestions.length > 0

  const lines: string[] = [`📎 Context: ${capsule.title}`]
  if (hasStructuredContent && (resolution === 'full' || resolution === 'compact')) {
    if (capsule.goals.length) lines.push(`Goals: ${capsule.goals.join('; ')}`)
    if (capsule.constraints.length) lines.push(`Constraints: ${capsule.constraints.join('; ')}`)
  }
  if (hasStructuredContent && resolution === 'full') {
    if (capsule.decisions.length) lines.push(`Decisions: ${capsule.decisions.join('; ')}`)
    if (capsule.openQuestions.length) lines.push(`Open: ${capsule.openQuestions.join('; ')}`)
  }
  // Raw capsules: summary holds the full conversation text (set by SW for uncompressed capsules).
  // Structured capsules with minimal resolution: show the short summary.
  // Use else-if to prevent double-appending when both conditions are true.
  if (!hasStructuredContent && capsule.summary) {
    lines.push(capsule.summary)
  } else if (resolution === 'minimal' && capsule.summary) {
    lines.push(capsule.summary)
  }
  lines.push(`[via ContextForge]\n`)

  const text = lines.join('\n')

  if (target instanceof HTMLElement) target.focus()

  // Move caret to the very start so context prepends the user's message
  const sel = window.getSelection()
  if (sel) {
    const range = document.createRange()
    range.selectNodeContents(target)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
  }

  // execCommand inserts text and fires a native input event.
  // Fall back to direct textNode insertion in environments (e.g. jsdom) that lack it.
  const inserted = typeof document.execCommand === 'function'
    && document.execCommand('insertText', false, text)
  if (!inserted) {
    const node = document.createTextNode(text)
    if (sel?.rangeCount) {
      const r = sel.getRangeAt(0)
      r.insertNode(node)
      r.collapse(false)
    } else {
      target.insertBefore(node, target.firstChild)
    }
  }
  // Always dispatch InputEvent — execCommand fires it natively in Chrome but
  // some React versions need an explicit dispatch to sync their internal state.
  target.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }))

  // Return a sentinel element for interface compliance
  const sentinel = document.createElement('span')
  sentinel.setAttribute('data-contextforge', capsule.id)
  sentinel.setAttribute('data-contextforge-footer', '')
  sentinel.style.display = 'none'
  target.appendChild(sentinel)
  return sentinel
}
