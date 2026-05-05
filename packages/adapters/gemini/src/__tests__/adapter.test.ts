import { describe, expect, it, beforeEach } from 'vitest'
import { GeminiAdapter } from '../adapter'

function buildFixture(hasComposer = true) {
  document.body.innerHTML = `
    <user-query>What is Gemini?</user-query>
    <model-response>Gemini is a large language model.</model-response>
    <rich-textarea>${hasComposer ? '<div contenteditable="true"></div>' : ''}</rich-textarea>
  `
}

describe('GeminiAdapter', () => {
  let adapter: GeminiAdapter
  beforeEach(() => { adapter = new GeminiAdapter(); document.body.innerHTML = '' })

  it('health() is healthy when composer present', () => {
    buildFixture(true)
    expect(adapter.health().status).toBe('healthy')
  })

  it('health() is unhealthy when composer absent', () => {
    buildFixture(false)
    expect(adapter.health().status).toBe('unhealthy')
  })

  it('extractConversation() captures user and assistant turns', () => {
    buildFixture(true)
    const turns = adapter.extractConversation()
    expect(turns.length).toBeGreaterThanOrEqual(2)
    expect(turns.some((t) => t.role === 'user')).toBe(true)
    expect(turns.some((t) => t.role === 'assistant')).toBe(true)
  })

  it('injectContext() inserts provenance footer', () => {
    buildFixture(true)
    const capsule = {
      id: '0'.repeat(64), title: 'Gemini test', summary: 'S', goals: [],
      constraints: [], decisions: [], openQuestions: [], platform: 'gemini' as const,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      turnCount: 1, tokenEstimate: 10, tags: [], parentIds: [], compressed: true,
    }
    adapter.injectContext(capsule, 'minimal')
    expect(document.querySelector('[data-contextforge-footer]')?.textContent).toContain('via ContextForge')
  })
})
