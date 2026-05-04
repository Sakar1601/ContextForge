# ADR-0001: Stack Choices

**Status:** Draft — awaiting approval  
**Date:** 2026-05-04  
**Deciders:** Sakar Joshi

---

## Context

ContextForge needs a browser extension build chain, a UI framework, a local 
database, an ML inference layer, a graph visualization library, and a test 
framework. Each choice must satisfy:

1. Manifest V3 compatibility (no persistent background page, no `eval`)
2. TypeScript strict — the entire graph of transitive deps must be typeable 
   without `any` at the boundary
3. Local-first — no required cloud dependency at runtime
4. pnpm workspaces — packages must be independently importable

---

## Decisions

### Build chain: Vite 5 + `@crxjs/vite-plugin@2.0.0-beta`

**Chosen over:** Webpack 5 + `copy-webpack-plugin` (manual), WXT framework.

**Rationale:** CRXJS auto-generates the MV3 manifest from `manifest.json`, 
handles HMR inside the extension popup, and keeps the Vite DX (fast cold 
start, ESM-native). The v2 beta is the only path to Vite 5; the stable v1 
targets Vite 4 which is EOL.

**Risk:** `@crxjs/vite-plugin@2.0.0-beta` may ship breaking changes between 
minor releases. Mitigated by pinning the exact version in `pnpm-lock.yaml` 
and auditing on every `pnpm update`.

**Alternative — WXT:** WXT is more actively maintained and has stable Vite 5 
support. We prefer CRXJS for its simpler mental model and direct Vite config 
access. Revisit if CRXJS beta causes sustained pain.

---

### UI framework: React 18 + Tailwind CSS + shadcn/ui

**Chosen over:** Preact (smaller bundle), Svelte (unfamiliar to team).

**Rationale:** React 18 concurrent features (Suspense, transitions) fit 
naturally with async IndexedDB reads. shadcn/ui provides accessible, 
unstyled-first components that can be scoped to the popup dimensions without 
fighting a component library's opinion. Tailwind gives deterministic class 
names that don't leak into host page styles.

**Concern:** shadcn/ui components are designed for full-page apps; the popup 
is ~400 px wide. Addressed by using `sm:` breakpoints as the default and 
auditing each component at popup dimensions.

---

### Local database: Dexie.js (IndexedDB)

**Chosen over:** `idb` (lower-level), SQLite via WASM (overkill), 
chrome.storage (5 MB limit, synchronous API).

**Rationale:** Dexie provides a clean async API, typed indexes, versioned 
migrations, and live queries compatible with React state. Its bundle size 
(~40 KB gzipped) is acceptable. The `useLiveQuery` hook makes reactive UI 
trivial.

---

### ML inference: transformers.js (Xenova)

**Chosen over:** ONNX Runtime Web (lower-level), server-side embeddings 
(violates privacy invariant).

**Rationale:** transformers.js ships pre-quantized BERT/MiniLM models that 
run in the browser via ONNX RT under the hood. The HuggingFace CDN is the 
only permitted non-Anthropic network dependency (one-time model download).

**Placement:** The embedding worker runs in an **offscreen document** 
(`chrome.offscreen`), not directly in the service worker. See ADR-0002 for 
rationale. The offscreen document is created lazily on first embedding 
request and kept alive for the session.

---

### Graph visualization: React Flow v11

**Chosen over:** D3 (too low-level for interactive graphs), Cytoscape.js 
(heavier), Vis.js (poor React integration).

**Rationale:** React Flow v11 renders performantly for the DAG sizes expected 
in v1 (tens of nodes), has a clean React API, and is MIT licensed.

**Licensing note:** React Flow v12 changed to a dual license (MIT for 
non-commercial, commercial license required for revenue-generating products). 
We pin to **v11** (MIT) for v1. If the project is monetized, evaluate v12's 
commercial license or migrate to an alternative before v2.

---

### Test framework: Vitest + Playwright

**Rationale:** Vitest runs in the same Vite pipeline — no separate babel 
config, fast watch mode, native ESM. Playwright covers cross-browser E2E 
and can test the extension via `--load-extension` flags.

**Coverage threshold:** 90%+ for `/packages/shared` and 
`/packages/compression` before each phase exit. Other packages: measured but 
not gated (yet).

---

### Package manager: pnpm workspaces

**Rationale:** Strict dependency hoisting (`shamefully-hoist=false` by 
default) prevents phantom dependencies. The workspace protocol (`workspace:*`) 
keeps inter-package links fast and explicit.

---

## Consequences

- CRXJS beta version pinned; upgrade path requires explicit review.
- React Flow v11 pinned; upgrade to v12 requires commercial license audit.
- transformers.js model weights downloaded once from HuggingFace CDN — this 
  is the only second-party network dependency and is permitted by the privacy 
  invariant.
- No server, no auth, no cloud sync in v1. All data in IndexedDB.
