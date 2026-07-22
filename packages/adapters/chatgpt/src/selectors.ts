export const SELECTORS = {
  humanTurn:     '[data-message-author-role="user"]',
  assistantTurn: '[data-message-author-role="assistant"]',
  turnContent:   '.whitespace-pre-wrap',
  composer:      '#prompt-textarea',
  turnContainer: 'main',
} as const
