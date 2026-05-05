import { describe, expect, it, beforeEach } from 'vitest'
import { DeepSeekAdapter } from '../adapter'

function buildFixture(hasComposer = true) {
  document.body.innerHTML = `
    <div class="user-message">Tell me about transformers.</div>
    <div class="assistant-message">Transformers use self-attention mechanisms.</div>
    <div id="parent">
      ${hasComposer ? '<textarea></textarea>' : ''}
    </div>
  `
}

describe('DeepSeekAdapter', () => {
  let adapter: DeepSeekAdapter
  beforeEach(() => { adapter = new DeepSeekAdapter(); document.body.innerHTML = '' })

  it('health() healthy with composer', () => {
    buildFixture(true)
    expect(adapter.health().status).toBe('healthy')
  })

  it('health() unhealthy without composer', () => {
    buildFixture(false)
    expect(adapter.health().status).toBe('unhealthy')
  })

  it('extracts turns', () => {
    buildFixture(true)
    const turns = adapter.extractConversation()
    expect(turns.length).toBeGreaterThan(0)
  })

  it('injectContext() adds provenance footer', () => {
    buildFixture(true)
    const capsule = {
      id: '0'.repeat(64), title: 'DeepSeek test', summary: 'S', goals: [],
      constraints: [], decisions: [], openQuestions: [], platform: 'deepseek' as const,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      turnCount: 1, tokenEstimate: 10, tags: [], parentIds: [], compressed: true,
    }
    adapter.injectContext(capsule, 'full')
    expect(document.querySelector('[data-contextforge-footer]')).not.toBeNull()
  })
})
