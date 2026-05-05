import type {
  AdapterHealth, CapsuleManifest, ConversationTurn, InjectionResolution, SiteAdapter,
} from '@contextforge/shared'
import { SELECTORS } from './selectors'

export class PerplexityAdapter implements SiteAdapter {
  readonly platform = 'perplexity' as const

  health(): AdapterHealth {
    if (!document.querySelector(SELECTORS.composer)) {
      return { status: 'unhealthy', reason: 'Composer element not found — perplexity.ai DOM may have changed' }
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
      const content = el.textContent?.trim() ?? ''
      if (content) turns.push({ role, content, index: index++ })
    }
    return turns
  }

  getInjectionTarget(): Element | null { return document.querySelector(SELECTORS.composer) }

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
  const block = document.createElement('div')
  block.setAttribute('data-contextforge', capsule.id)
  block.style.cssText = 'border:1px solid #bfdbfe;border-radius:6px;padding:8px 12px;margin-bottom:8px;font-size:13px;color:#1e3a5f;background:#eff6ff;white-space:pre-wrap;line-height:1.5'
  const add = (t: string) => { const p = document.createElement('p'); p.style.cssText = 'margin:0 0 2px'; p.textContent = t; block.appendChild(p) }
  add(`📎 ${capsule.title}`)
  if (resolution === 'full' || resolution === 'compact') {
    if (capsule.goals.length) add(`Goals: ${capsule.goals.join('; ')}`)
    if (capsule.constraints.length) add(`Constraints: ${capsule.constraints.join('; ')}`)
  }
  if (resolution === 'full') {
    if (capsule.decisions.length) add(`Decisions: ${capsule.decisions.join('; ')}`)
    if (capsule.openQuestions.length) add(`Open: ${capsule.openQuestions.join('; ')}`)
  }
  if (resolution === 'minimal') add(capsule.summary)
  const footer = document.createElement('small')
  footer.setAttribute('data-contextforge-footer', '')
  footer.style.cssText = 'display:block;margin-top:6px;color:#6b7280;font-size:11px;border-top:1px solid #dbeafe;padding-top:4px'
  footer.textContent = `Context from: ${capsule.title} via ContextForge`
  block.appendChild(footer)
  target.parentElement?.insertBefore(block, target)
  return block
}
