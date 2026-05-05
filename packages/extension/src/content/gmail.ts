import { GmailAdapter, SELECTORS } from '@contextforge/adapter-gmail'
import { setupDropZone } from '@contextforge/adapter-claude'
import type { CapsuleManifest, InjectionResolution } from '@contextforge/shared'
import { setupSuggest } from './suggest'

const adapter = new GmailAdapter()
setupSuggest(SELECTORS.composer)

// Gmail is inject-only — drop zone is the primary interaction.
setupDropZone((capsuleId, windowWidth) => {
  void chrome.runtime.sendMessage({ type: 'INJECT_REQUEST', capsuleId, windowWidth })
})

chrome.runtime.onMessage.addListener(
  (msg: { type: string; manifest?: CapsuleManifest; resolution?: InjectionResolution }, _sender, sendResponse) => {
    if (msg.type === 'INJECT_COMMAND') {
      try {
        if (!msg.manifest || !msg.resolution) throw new Error('Missing manifest or resolution')
        adapter.injectContext(msg.manifest, msg.resolution)
        sendResponse({ success: true })
      } catch (e) { sendResponse({ success: false, error: String(e) }) }
      return true
    }
    if (msg.type === 'ADAPTER_HEALTH_REQUEST') {
      const h = adapter.health()
      sendResponse({ type: 'ADAPTER_HEALTH_RESPONSE', status: h.status, ...(h.status === 'unhealthy' ? { reason: h.reason } : {}) })
      return true
    }
  },
)
