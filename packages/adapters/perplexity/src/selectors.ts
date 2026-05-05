export const SELECTORS = {
  turn:          '[data-testid="query"], [data-testid="answer"]',
  humanTurn:     '[data-testid="query"]',
  assistantTurn: '[data-testid="answer"]',
  turnContent:   'p, .whitespace-pre-wrap',
  composer:      'textarea[placeholder], div[contenteditable="true"][data-testid="search-input"]',
  turnContainer: 'main',
} as const
