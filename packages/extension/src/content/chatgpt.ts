import { ChatGPTAdapter } from '@contextforge/adapter-chatgpt'
import { setupDropZone } from '@contextforge/adapter-claude'
import type { CapsuleManifest, InjectionResolution } from '@contextforge/shared'

const adapter = new ChatGPTAdapter()

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
    if (msg.type === 'EXTRACT_TURNS_REQUEST') {
      sendResponse({ type: 'EXTRACT_TURNS_RESPONSE', turns: adapter.extractConversation(), health: adapter.health() })
      return true
    }
    if (msg.type === 'ADAPTER_HEALTH_REQUEST') {
      const h = adapter.health()
      sendResponse({ type: 'ADAPTER_HEALTH_RESPONSE', status: h.status, ...(h.status === 'unhealthy' ? { reason: h.reason } : {}) })
      return true
    }
  },
)
