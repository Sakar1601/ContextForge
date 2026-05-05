import type {
  AdapterHealth, CapsuleManifest, ConversationTurn, InjectionResolution, SiteAdapter,
} from '@contextforge/shared'
import { SELECTORS } from './selectors'

// Gmail is inject-only. extractConversation() always returns [] since Gmail
// is not an AI assistant — it is only a context injection target.
export class GmailAdapter implements SiteAdapter {
  readonly platform = 'gmail' as const

  health(): AdapterHealth {
    if (!document.querySelector(SELECTORS.composer)) {
      return { status: 'unhealthy', reason: 'Compose area not found — Gmail DOM may have changed' }
    }
    return { status: 'healthy' }
  }

  extractConversation(): ConversationTurn[] { return [] }

  getInjectionTarget(): Element | null { return document.querySelector(SELECTORS.composer) }

  injectContext(capsule: CapsuleManifest, resolution: InjectionResolution): Element {
    const target = this.getInjectionTarget()
    if (!target) throw new Error('No Gmail compose area found')

    const lines: string[] = [`📎 ${capsule.title}`]
    if (resolution === 'full' || resolution === 'compact') {
      if (capsule.goals.length) lines.push(`Goals: ${capsule.goals.join('; ')}`)
      if (capsule.constraints.length) lines.push(`Constraints: ${capsule.constraints.join('; ')}`)
    }
    if (resolution === 'full') {
      if (capsule.decisions.length) lines.push(`Decisions: ${capsule.decisions.join('; ')}`)
      if (capsule.openQuestions.length) lines.push(`Open: ${capsule.openQuestions.join('; ')}`)
    }
    if (resolution === 'minimal') lines.push(capsule.summary)
    lines.push(`\nContext from: ${capsule.title} via ContextForge`)

    const text = lines.join('\n')
    if (target instanceof HTMLElement) target.focus()
    document.execCommand('insertText', false, text)

    // Return a sentinel element for interface compliance
    const sentinel = document.createElement('span')
    sentinel.setAttribute('data-contextforge', capsule.id)
    sentinel.style.display = 'none'
    document.body.appendChild(sentinel)
    return sentinel
  }

  observeChanges(_callback: (turns: ConversationTurn[]) => void): () => void {
    return () => { /* Gmail doesn't have AI turns to observe */ }
  }
}
