import { describe, expect, it, beforeEach } from 'vitest'
import { ChatGPTAdapter } from '../adapter'

function buildFixture(hasComposer = true, turns: Array<{ role: 'user' | 'assistant'; text: string }> = []) {
  document.body.innerHTML = `
    ${turns.map(({ role, text }) => `
      <article data-testid="conversation-turn-1">
        <div data-message-author-role="${role}">
          <div class="whitespace-pre-wrap">${text}</div>
        </div>
      </article>`).join('')}
    <div id="parent">${hasComposer ? '<div id="prompt-textarea" contenteditable="true"></div>' : ''}</div>
  `
}

describe('ChatGPTAdapter', () => {
  let adapter: ChatGPTAdapter
  beforeEach(() => { adapter = new ChatGPTAdapter(); document.body.innerHTML = '' })

  it('health() is healthy when composer present', () => {
    buildFixture(true)
    expect(adapter.health().status).toBe('healthy')
  })

  it('health() is unhealthy when composer absent', () => {
    buildFixture(false)
    expect(adapter.health().status).toBe('unhealthy')
  })

  it('extractConversation() returns indexed turns', () => {
    buildFixture(true, [
      { role: 'user', text: 'Hello' },
      { role: 'assistant', text: 'Hi there' },
    ])
    const turns = adapter.extractConversation()
    expect(turns).toHaveLength(2)
    expect(turns[0]).toMatchObject({ role: 'user', index: 0 })
    expect(turns[1]).toMatchObject({ role: 'assistant', index: 1 })
  })

  it('injectContext() inserts block with provenance footer', () => {
    buildFixture(true)
    const capsule = {
      id: '0'.repeat(64), title: 'Test', summary: 'S', goals: ['g'],
      constraints: [], decisions: [], openQuestions: [], platform: 'chatgpt' as const,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      turnCount: 1, tokenEstimate: 10, tags: [], parentIds: [], compressed: true,
    }
    adapter.injectContext(capsule, 'full')
    expect(document.querySelector('[data-contextforge]')).not.toBeNull()
    expect(document.querySelector('[data-contextforge-footer]')?.textContent).toContain('via ContextForge')
  })
})
