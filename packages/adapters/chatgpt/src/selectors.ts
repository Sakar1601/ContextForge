export const SELECTORS = {
  turn:          'article[data-testid^="conversation-turn"]',
  humanTurn:     '[data-message-author-role="user"]',
  assistantTurn: '[data-message-author-role="assistant"]',
  turnContent:   '.whitespace-pre-wrap',
  composer:      '#prompt-textarea',
  turnContainer: 'main',
} as const
