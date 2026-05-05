export const SELECTORS = {
  turn:          '[class*="message-item"], [class*="chat-message"]',
  humanTurn:     '[class*="human"][class*="message"], [class*="user"][class*="message"]',
  assistantTurn: '[class*="assistant"][class*="message"], [class*="ai"][class*="message"]',
  turnContent:   '[class*="content"], .markdown-body, p',
  composer:      'textarea, div[contenteditable="true"]',
  turnContainer: '[class*="chat-list"], [class*="conversation"], main',
} as const
