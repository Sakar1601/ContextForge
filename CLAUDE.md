# ContextForge — Working Agreement

## Project
Manifest V3 browser extension. Captures AI conversations into versioned, 
semantically-compressed "Capsules" reusable across ChatGPT, Claude, Gemini, 
Perplexity, DeepSeek, Gmail. Local-first, privacy-preserving, DAG-versioned.

Full spec: `/docs/SPEC.md`. Architecture decisions: `/docs/adr/`.

## Stack
React 18 + TypeScript strict, Vite + CRXJS, Dexie.js, Tailwind + shadcn/ui, 
transformers.js, Anthropic SDK, React Flow, Vitest + Playwright, pnpm 
workspaces. No deviation without an ADR.

## Non-negotiable rules
1. **Plan first.** For any task >30 lines of code, output a plan and wait 
   for approval. Use plan mode when available.
2. **Test first for /packages/shared and /packages/compression.** Write the 
   failing test, then implement. Other packages: tests after, but before 
   commit.
3. **No `any`. No `@ts-ignore`. No `eslint-disable` without a comment 
   explaining why.** Zod schemas for every persisted shape.
4. **Run `pnpm check` (typecheck + lint + test) before declaring any task 
   done.** If it fails, fix it; don't hand back broken work.
5. **Small commits, conventional format.** One logical change per commit. 
   Never commit without running `pnpm check`.
6. **Privacy invariant:** no network calls except (a) Anthropic API with 
   user's key, (b) HuggingFace model CDN for embeddings on first run. Any 
   new fetch() requires an ADR.
7. **Manifest V3 discipline:** no module-level mutable state in the service 
   worker. State lives in IndexedDB or chrome.storage. All cross-context 
   communication via typed message passing (see /packages/shared/messaging).
8. **When stuck or ambiguous, stop and ask.** Don't guess on architecture.

## Where things live
- Types and pure logic: `/packages/shared`
- Per-site adapters: `/packages/adapters/<platform>`
- LLM extraction: `/packages/compression`
- Search: `/packages/retrieval`
- The extension itself (UI, manifest, content scripts): `/packages/extension`
- Architecture decisions: `/docs/adr/NNNN-title.md`
- Design docs per phase: `/docs/design/phase-N-title.md`

## How to use subagents
- Adapters are independent — when building 2+ adapters, spawn subagents 
  via the Task tool, one per platform. Each must conform to the 
  SiteAdapter interface in /packages/shared.
- Use a dedicated reviewer subagent before merging to main for any change 
  touching /packages/shared or /packages/compression.

## Test commands
- `pnpm check` — typecheck + lint + unit tests (run before every commit)
- `pnpm test:e2e` — Playwright (run before phase completion)
- `pnpm dev` — load unpacked extension in Chrome via web-ext

## Failure modes to handle explicitly
- Adapter DOM selector breaks → adapter reports `unhealthy`, capture button 
  disables with explanation, telemetry logged locally only.
- Anthropic API key missing/invalid → degrade to "raw capture" mode, queue 
  capsules for later compression.
- IndexedDB quota exceeded → LRU eviction of `body.full` (keep manifest + 
  summary), warn user.
- Embedding model fails to load → fall back to BM25-only search.

## Scope discipline
v1 scope is in /docs/SPEC.md "Definition of done." Anything else is v2. 
If a feature feels useful but isn't listed, write an ADR proposing it; 
don't just build it.
