import { ClaudeAdapter } from '@contextforge/adapter-claude'

const adapter = new ClaudeAdapter()

chrome.runtime.onMessage.addListener((msg: { type: string }, _sender, sendResponse) => {
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
})
