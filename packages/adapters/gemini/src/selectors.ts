export const SELECTORS = {
  turn:          'user-query, model-response',
  humanTurn:     'user-query',
  assistantTurn: 'model-response',
  turnContent:   '.query-text, .response-container, p',
  composer:      'rich-textarea div[contenteditable="true"]',
  turnContainer: 'chat-window, main',
} as const
