// DOM selector constants for claude.ai.
// Update here when claude.ai changes its markup — health() validates these at runtime.
export const SELECTORS = {
  turn: '[data-testid="conversation-turn"]',
  humanTurn: '[data-testid="human-turn"]',
  assistantTurn: '[data-testid="assistant-turn"]',
  turnContent: '.whitespace-pre-wrap',
  composer: 'div[contenteditable="true"][enterkeyhint="enter"]',
  turnContainer: '[data-testid="virtuoso-item-list"]',
} as const
