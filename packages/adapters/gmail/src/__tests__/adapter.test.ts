import { describe, expect, it, beforeEach } from 'vitest'
import { GmailAdapter } from '../adapter'

function buildFixture(hasComposer = true) {
  document.body.innerHTML = hasComposer
    ? `<div contenteditable="true" g_editable="true" role="textbox" aria-label="Message Body"></div>`
    : '<div></div>'
}

describe('GmailAdapter', () => {
  let adapter: GmailAdapter
  beforeEach(() => { adapter = new GmailAdapter(); document.body.innerHTML = '' })

  it('health() healthy when compose area present', () => {
    buildFixture(true)
    expect(adapter.health().status).toBe('healthy')
  })

  it('health() unhealthy when compose area absent', () => {
    buildFixture(false)
    expect(adapter.health().status).toBe('unhealthy')
  })

  it('extractConversation() always returns []', () => {
    buildFixture(true)
    expect(adapter.extractConversation()).toEqual([])
  })

  it('observeChanges() returns a no-op teardown', () => {
    buildFixture(true)
    const teardown = adapter.observeChanges(() => { /* no-op */ })
    expect(() => teardown()).not.toThrow()
  })
})
