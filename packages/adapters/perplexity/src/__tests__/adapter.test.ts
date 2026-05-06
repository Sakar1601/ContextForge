import { describe, expect, it, beforeEach } from 'vitest'
import { PerplexityAdapter } from '../adapter'

function buildFixture(hasComposer = true) {
  document.body.innerHTML = `
    <div data-testid="query" class="whitespace-pre-line">How does RAG work?</div>
    <div data-testid="answer" class="prose">RAG combines retrieval with generation.</div>
    <div id="parent">
      ${hasComposer ? '<textarea placeholder="Ask anything"></textarea>' : ''}
    </div>
  `
}

describe('PerplexityAdapter', () => {
  let adapter: PerplexityAdapter
  beforeEach(() => { adapter = new PerplexityAdapter(); document.body.innerHTML = '' })

  it('health() healthy with composer', () => {
    buildFixture(true)
    expect(adapter.health().status).toBe('healthy')
  })

  it('health() unhealthy without composer', () => {
    buildFixture(false)
    expect(adapter.health().status).toBe('unhealthy')
  })

  it('extracts user and assistant turns', () => {
    buildFixture(true)
    const turns = adapter.extractConversation()
    expect(turns.some((t) => t.role === 'user')).toBe(true)
    expect(turns.some((t) => t.role === 'assistant')).toBe(true)
  })

  it('injectContext() adds provenance footer', () => {
    buildFixture(true)
    const capsule = {
      id: '0'.repeat(64), title: 'Perplexity test', summary: 'S', goals: [],
      constraints: [], decisions: [], openQuestions: [], platform: 'perplexity' as const,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      turnCount: 1, tokenEstimate: 10, tags: [], parentIds: [], compressed: true,
    }
    adapter.injectContext(capsule, 'compact')
    expect(document.querySelector('[data-contextforge]')).not.toBeNull()
    expect(document.querySelector('[data-contextforge-footer]')).not.toBeNull()
  })
})
