import { describe, expect, it, beforeEach, vi } from 'vitest'
import { ClaudeAdapter } from '../adapter'
import { SELECTORS } from '../selectors'

// jsdom environment is set in vitest.config.ts

function buildFixture(options: { hasComposer?: boolean; turns?: Array<{ role: 'user' | 'assistant'; text: string }> } = {}) {
  const { hasComposer = true, turns = [] } = options
  document.body.innerHTML = ''

  if (turns.length) {
    const container = document.createElement('div')
    container.setAttribute('data-testid', 'virtuoso-item-list')

    for (const turn of turns) {
      const outer = document.createElement('div')
      outer.setAttribute(
        'data-testid',
        turn.role === 'user' ? 'human-turn' : 'assistant-turn',
      )
      outer.setAttribute('data-testid', 'conversation-turn')

      const human = document.createElement('div')
      human.setAttribute(
        'data-testid',
        turn.role === 'user' ? 'human-turn' : 'assistant-turn',
      )
      const content = document.createElement('div')
      content.className = 'whitespace-pre-wrap'
      content.textContent = turn.text
      human.appendChild(content)
      outer.appendChild(human)
      container.appendChild(outer)
    }
    document.body.appendChild(container)
  }

  if (hasComposer) {
    const composer = document.createElement('div')
    composer.setAttribute('contenteditable', 'true')
    composer.setAttribute('enterkeyhint', 'enter')
    document.body.appendChild(composer)
  }
}

describe('ClaudeAdapter', () => {
  let adapter: ClaudeAdapter

  beforeEach(() => {
    adapter = new ClaudeAdapter()
    document.body.innerHTML = ''
  })

  describe('health()', () => {
    it('returns healthy when the composer element is present', () => {
      buildFixture({ hasComposer: true })
      expect(adapter.health()).toEqual({ status: 'healthy' })
    })

    it('returns unhealthy when the composer element is absent', () => {
      buildFixture({ hasComposer: false })
      const h = adapter.health()
      expect(h.status).toBe('unhealthy')
      if (h.status === 'unhealthy') {
        expect(h.reason).toMatch(/composer/i)
      }
    })
  })

  describe('extractConversation()', () => {
    it('returns an empty array when there are no turns', () => {
      buildFixture({ turns: [] })
      expect(adapter.extractConversation()).toEqual([])
    })

    it('extracts turns with correct roles and indices', () => {
      buildFixture({
        turns: [
          { role: 'user', content: 'Hello' } as never,
          { role: 'assistant', content: 'Hi there' } as never,
        ],
      })
      // Manually build a simpler fixture since buildFixture nests are complex
      document.body.innerHTML = `
        <div data-testid="virtuoso-item-list">
          <div data-testid="conversation-turn">
            <div data-testid="human-turn">
              <div class="whitespace-pre-wrap">Hello from user</div>
            </div>
          </div>
          <div data-testid="conversation-turn">
            <div data-testid="assistant-turn">
              <div class="whitespace-pre-wrap">Hello from assistant</div>
            </div>
          </div>
        </div>
        <div contenteditable="true" enterkeyhint="enter"></div>
      `
      const turns = adapter.extractConversation()
      expect(turns).toHaveLength(2)
      expect(turns[0]).toMatchObject({ role: 'user', content: 'Hello from user', index: 0 })
      expect(turns[1]).toMatchObject({ role: 'assistant', content: 'Hello from assistant', index: 1 })
    })
  })

  describe('getInjectionTarget()', () => {
    it('returns the composer element when present', () => {
      buildFixture({ hasComposer: true })
      const target = adapter.getInjectionTarget()
      expect(target).not.toBeNull()
      expect(target?.getAttribute('contenteditable')).toBe('true')
    })

    it('returns null when the composer is absent', () => {
      buildFixture({ hasComposer: false })
      expect(adapter.getInjectionTarget()).toBeNull()
    })
  })

  describe('injectContext()', () => {
    const capsule = {
      id: 'abc123',
      title: 'Test capsule',
      summary: 'A summary',
      goals: ['do the thing'],
      constraints: ['no side effects'],
      decisions: ['use Dexie'],
      openQuestions: ['what about quota?'],
      platform: 'claude' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      turnCount: 2,
      tokenEstimate: 100,
      tags: [],
      parentIds: [],
      compressed: true,
    }

    beforeEach(() => {
      document.body.innerHTML = `
        <div id="parent">
          <div contenteditable="true" enterkeyhint="enter"></div>
        </div>
      `
    })

    it('inserts a block before the composer', () => {
      adapter.injectContext(capsule, 'full')
      const block = document.querySelector('[data-contextforge]')
      expect(block).not.toBeNull()
      expect(block?.textContent).toContain('Test capsule')
    })

    it('full resolution includes goals and constraints', () => {
      adapter.injectContext(capsule, 'full')
      const text = document.querySelector('[data-contextforge]')?.textContent ?? ''
      expect(text).toContain('do the thing')
      expect(text).toContain('no side effects')
      expect(text).toContain('use Dexie')
    })

    it('minimal resolution shows only title and summary', () => {
      adapter.injectContext(capsule, 'minimal')
      const text = document.querySelector('[data-contextforge]')?.textContent ?? ''
      expect(text).toContain('Test capsule')
      expect(text).toContain('A summary')
      expect(text).not.toContain('do the thing')
    })
  })

  describe('observeChanges()', () => {
    it('fires the callback when a new turn is added to the DOM', async () => {
      document.body.innerHTML = `
        <div data-testid="virtuoso-item-list"></div>
        <div contenteditable="true" enterkeyhint="enter"></div>
      `
      const callback = vi.fn()
      const disconnect = adapter.observeChanges(callback)

      const container = document.querySelector(SELECTORS.turnContainer)!
      const newTurn = document.createElement('div')
      newTurn.setAttribute('data-testid', 'conversation-turn')
      newTurn.innerHTML = `<div data-testid="human-turn"><div class="whitespace-pre-wrap">New message</div></div>`
      container.appendChild(newTurn)

      // MutationObserver fires asynchronously
      await new Promise((r) => setTimeout(r, 10))
      expect(callback).toHaveBeenCalled()

      disconnect()
    })

    it('stops firing after disconnect is called', async () => {
      document.body.innerHTML = `
        <div data-testid="virtuoso-item-list"></div>
        <div contenteditable="true" enterkeyhint="enter"></div>
      `
      const callback = vi.fn()
      const disconnect = adapter.observeChanges(callback)
      disconnect()

      const container = document.querySelector(SELECTORS.turnContainer)!
      container.appendChild(document.createElement('div'))

      await new Promise((r) => setTimeout(r, 10))
      expect(callback).not.toHaveBeenCalled()
    })
  })
})
