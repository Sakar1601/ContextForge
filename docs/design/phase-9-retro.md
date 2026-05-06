# Phase 9 Retro (covers Phases 8 + 9)

## Delivered

### Phase 8 — A/B Evaluation
- `CapsuleManifest.liftScore?: number` (−1…+1); TDD with exactOptionalPropertyTypes catch
- `UPDATE_LIFT_SCORE_REQUEST/RESPONSE` message types
- `LiftBadge` inline 👍/👎 on every capsule card

### Phase 9 — Polish
- `ErrorBoundary` wraps the popup root
- `SettingsView` with API key entry; auto-opens on first run
- Keyboard shortcuts: `/` → focus search, `Esc` → clear/close, `G` → graph
- Accessibility: `role`, `aria-label`, `aria-live` throughout popup

## What worked well
- The working agreement kept scope tight — every "nice-to-have" that wasn't
  in the SPEC was deferred or skipped
- TDD for `/packages/shared` and `/packages/compression` caught real bugs
  early (the `exactOptionalPropertyTypes` error above, array-merge edge cases)
- The offscreen document pattern for transformers.js worked cleanly — no
  service worker lifetime issues observed

## Known gaps before v1 ship
- Formal axe-core automated audit not run (manual a11y applied; browser-only)
- CRXJS `@2.0.0-beta.33` still marked deprecated on npm; WXT remains the
  fallback option per ADR-0001
- DOM selectors for ChatGPT / Gemini / Perplexity / DeepSeek are
  best-effort — verified against fixture HTML, not live sites

## Metrics at v1 tag
- **204 unit tests** across 18 test suites; 0 errors
- **3 E2E tests** (phase-3 + phase-4); all green
- **`pnpm check`** exits 0 on every commit since Phase 0
