# Build Roadmap

Each phase ends with: green `pnpm check`, a short retro in 
/docs/design/phase-N-retro.md, and a git tag `phase-N-complete`.

## Phase 0: Foundation (no product code)
- pnpm workspace, TypeScript strict, ESLint, Prettier, Vitest, Playwright 
  scaffolded but empty
- CRXJS + Vite producing a "hello world" extension that loads in Chrome
- CI: GitHub Actions running `pnpm check` on PRs
- ADR-0001: stack choices
- ADR-0002: Manifest V3 messaging architecture

## Phase 1: Capsule core (/packages/shared)
- Capsule, CapsuleManifest, CapsuleBody, ProvenanceMap types + Zod schemas
- Content-hash function (capsule.id derivation) — deterministic, tested
- DAG operations: commit, branch, merge (three-way), diff, cherryPick
- 90%+ test coverage required before phase exit
- Design doc first: /docs/design/phase-1-capsule-core.md

## Phase 2: Persistence
- Dexie schema, repository pattern, migrations framework
- Property-based tests: roundtrip any valid Capsule through storage
- LRU eviction policy for body.full when over quota

## Phase 3: First adapter end-to-end (claude.ai)
- SiteAdapter interface finalized in /packages/shared
- claude.ai adapter: extractConversation, getInjectionTarget, injectContext, 
  observeChanges
- Compression pipeline: real Anthropic API call, structured extraction 
  prompt (see /docs/design/extraction-prompt.md — write this first)
- Minimal popup UI: list capsules, capture button
- E2E test: open claude.ai conversation → capture → see capsule in popup

## Phase 4: Injection + drag-drop
- Adaptive injection engine (resolution selection by target window size)
- Drag handle in popup, drop zone detection in content script
- Provenance footer rendering
- E2E: capture on claude.ai → drag into chatgpt.com → message sent with 
  context

## Phase 5: Version graph UI
- React Flow graph rendering
- Branch / merge / diff / rollback / cherry-pick UI
- Merge conflict resolution UI for contradictory goals/constraints

## Phase 6: Remaining adapters (parallelize via subagents)
- chatgpt.com, gemini.google.com, perplexity.ai, deepseek.com, mail.google.com
- Each adapter: own subagent, conforms to interface, own E2E test

## Phase 7: Retrieval
- transformers.js embedding worker
- Hybrid cosine + BM25 search
- "Suggest capsules" floating widget

## Phase 8: A/B evaluation
- Fork prompt with/without capsule
- Side-by-side diff UI
- Per-capsule lift score persisted

## Phase 9: Polish
- Onboarding flow, keyboard shortcuts, settings page, error boundaries, 
  accessibility audit
