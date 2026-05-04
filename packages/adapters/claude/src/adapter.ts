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

    const block = document.createElement('div')
    block.setAttribute('data-contextforge', capsule.id)
    block.style.cssText =
      'border:1px solid #bfdbfe;border-radius:6px;padding:8px 12px;margin-bottom:8px;font-size:13px;color:#1e3a5f;background:#eff6ff;white-space:pre-wrap;line-height:1.5'

    const addLine = (text: string) => {
      const p = document.createElement('p')
      p.style.cssText = 'margin:0 0 2px'
      p.textContent = text
      block.appendChild(p)
    }

    addLine(`📎 ${capsule.title}`)

    if (resolution === 'full' || resolution === 'compact') {
      if (capsule.goals.length) addLine(`Goals: ${capsule.goals.join('; ')}`)
      if (capsule.constraints.length) addLine(`Constraints: ${capsule.constraints.join('; ')}`)
    }
    if (resolution === 'full') {
      if (capsule.decisions.length) addLine(`Decisions: ${capsule.decisions.join('; ')}`)
      if (capsule.openQuestions.length) addLine(`Open: ${capsule.openQuestions.join('; ')}`)
    }
    if (resolution === 'minimal') {
      addLine(capsule.summary)
    }

    // Provenance footer — always present
    const footer = document.createElement('small')
    footer.setAttribute('data-contextforge-footer', '')
    footer.style.cssText = 'display:block;margin-top:6px;color:#6b7280;font-size:11px;border-top:1px solid #dbeafe;padding-top:4px'
    footer.textContent = `Context from: ${capsule.title} via ContextForge`
    block.appendChild(footer)

    target.parentElement?.insertBefore(block, target)
    return block
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
