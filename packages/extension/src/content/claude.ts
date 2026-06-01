import { ClaudeAdapter, setupDropZone, SELECTORS } from '@contextforge/adapter-claude'
import type { CapsuleManifest, InjectionResolution } from '@contextforge/shared'
import { setupSuggest } from './suggest'

const adapter = new ClaudeAdapter()

setupDropZone((capsuleId, windowWidth) => {
  void chrome.runtime.sendMessage({ type: 'INJECT_REQUEST', capsuleId, windowWidth })
})
setupSuggest(SELECTORS.composer)

// Note: web pages cannot forge chrome.runtime.onMessage — the browser blocks
// cross-origin message sends. _sender is intentionally unused here.
chrome.runtime.onMessage.addListener(
  (msg: { type: string; manifest?: CapsuleManifest; resolution?: InjectionResolution }, _sender, sendResponse) => {
    if (msg.type === 'INJECT_COMMAND') {
      try {
        if (!msg.manifest || !msg.resolution) throw new Error('Missing manifest or resolution')
        adapter.injectContext(msg.manifest, msg.resolution)
        sendResponse({ success: true })
      } catch (e) {
        sendResponse({ success: false, error: String(e) })
      }
      return true
    }

    if (msg.type === 'EXTRACT_TURNS_REQUEST') {
      sendResponse({
        type: 'EXTRACT_TURNS_RESPONSE',
        turns: adapter.extractConversation(),
        health: adapter.health(),
      })
      return true
    }

    if (msg.type === 'ADAPTER_HEALTH_REQUEST') {
      const h = adapter.health()
      sendResponse({
        type: 'ADAPTER_HEALTH_RESPONSE',
        status: h.status,
        ...(h.status === 'unhealthy' ? { reason: h.reason } : {}),
      })
      return true
    }
  },
)
