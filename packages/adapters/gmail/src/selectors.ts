// Gmail is inject-only: no turn extraction selectors needed.
export const SELECTORS = {
  composer: 'div[contenteditable="true"][g_editable="true"], div[aria-label][contenteditable="true"][role="textbox"]',
} as const
