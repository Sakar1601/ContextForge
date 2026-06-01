import { describe, expect, it, beforeEach, vi } from 'vitest'
import { ClaudeAdapter } from '../adapter'
import { SELECTORS } from '../selectors'
import { setupDropZone, DROP_MIME } from '../drop-zone'

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

    it('injects text into the composer (not a separate block)', () => {
      adapter.injectContext(capsule, 'full')
      // Text goes INTO the contenteditable via execCommand
      const composer = document.querySelector('[contenteditable="true"]')
      expect(composer?.textContent).toContain('Test capsule')
      // A hidden sentinel marks the injection
      expect(document.querySelector('[data-contextforge]')).not.toBeNull()
    })

    it('full resolution includes goals and constraints in composer text', () => {
      adapter.injectContext(capsule, 'full')
      const text = document.querySelector('[contenteditable="true"]')?.textContent ?? ''
      expect(text).toContain('do the thing')
      expect(text).toContain('no side effects')
      expect(text).toContain('use Dexie')
    })

    it('minimal resolution includes title and summary only', () => {
      adapter.injectContext(capsule, 'minimal')
      const text = document.querySelector('[contenteditable="true"]')?.textContent ?? ''
      expect(text).toContain('Test capsule')
      expect(text).toContain('A summary')
      expect(text).not.toContain('do the thing')
    })

    it.each(['full', 'compact', 'minimal'] as const)(
      'always marks injection with sentinel for resolution "%s"',
      (resolution) => {
        adapter.injectContext(capsule, resolution)
        expect(document.querySelector('[data-contextforge]')).not.toBeNull()
        expect(document.querySelector('[data-contextforge-footer]')).not.toBeNull()
      },
    )

    it('raw capsule (no structured fields): shows summary text for all resolutions', () => {
      const rawCapsule = {
        ...capsule,
        compressed: false,
        goals: [],
        constraints: [],
        decisions: [],
        openQuestions: [],
        summary: 'This is the raw conversation text from the SW',
      }
      for (const res of ['full', 'compact', 'minimal'] as const) {
        document.body.innerHTML = `<div id="parent"><div contenteditable="true" enterkeyhint="enter"></div></div>`
        adapter.injectContext(rawCapsule, res)
        const text = document.querySelector('[contenteditable="true"]')?.textContent ?? ''
        expect(text).toContain('This is the raw conversation text from the SW')
        // Should NOT appear twice
        const count = (text.match(/This is the raw conversation text/g) ?? []).length
        expect(count).toBe(1)
      }
    })

    it('falls back to textNode insertion when execCommand is unavailable', () => {
      const origExec = document.execCommand
      // Force execCommand to fail (simulates unsupported environments)
      Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true })
      adapter.injectContext(capsule, 'full')
      const text = document.querySelector('[contenteditable="true"]')?.textContent ?? ''
      expect(text).toContain('Test capsule')
      Object.defineProperty(document, 'execCommand', { value: origExec, configurable: true })
    })

    it('always dispatches an InputEvent after injection', () => {
      const events: Event[] = []
      const composer = document.querySelector('[contenteditable="true"]')!
      composer.addEventListener('input', (e) => events.push(e))
      adapter.injectContext(capsule, 'full')
      expect(events.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('setupDropZone()', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div contenteditable="true" enterkeyhint="enter"></div>
      `
    })

    function makeDrop(capsuleId: string | null) {
      // jsdom does not expose DragEvent; use Event + manual dataTransfer
      const ev = new Event('drop', { bubbles: true, cancelable: true })
      const types = capsuleId ? [DROP_MIME] : ['text/plain']
      Object.defineProperty(ev, 'dataTransfer', {
        value: {
          types,
          dropEffect: 'none',
          getData: (mime: string) => (mime === DROP_MIME && capsuleId ? capsuleId : ''),
        },
      })
      return ev
    }

    it('calls the callback with capsuleId and windowWidth on drop', () => {
      const onDrop = vi.fn()
      const teardown = setupDropZone(onDrop)
      document.dispatchEvent(makeDrop('capsule-abc-123'))
      expect(onDrop).toHaveBeenCalledWith('capsule-abc-123', expect.any(Number))
      teardown()
    })

    it('does not call callback when MIME type is absent', () => {
      const onDrop = vi.fn()
      const teardown = setupDropZone(onDrop)
      document.dispatchEvent(makeDrop(null))
      expect(onDrop).not.toHaveBeenCalled()
      teardown()
    })

    it('removes listeners after teardown', () => {
      const onDrop = vi.fn()
      const teardown = setupDropZone(onDrop)
      teardown()
      document.dispatchEvent(makeDrop('capsule-xyz'))
      expect(onDrop).not.toHaveBeenCalled()
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
