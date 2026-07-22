# ContextForge

> Capture AI conversations into reusable capsules. Inject context across ChatGPT, Claude, Gemini, Perplexity, DeepSeek, and Gmail — without copy-paste.

[![CI](https://github.com/Sakar1601/ContextForge/actions/workflows/ci.yml/badge.svg)](https://github.com/Sakar1601/ContextForge/actions/workflows/ci.yml)

---

## What it does

AI conversations are ephemeral and siloed. ContextForge turns them into portable, versioned **Capsules** — compressed snapshots of goals, constraints, decisions, and open questions — that you can inject into any supported AI interface with one drag.

**Capture** a conversation → it becomes a Capsule stored locally on your device.  
**Drag** the Capsule from the popup onto any AI composer → context injected instantly.  
**Search** past capsules with hybrid semantic + keyword search.  
**Version** capsules with a full DAG graph (branch, merge, diff, rollback).

Everything is **local-first** — no server, no analytics, no sync. The only network calls are to the Anthropic API (your own key, optional) and HuggingFace CDN (embedding model, first run only).

---

## Supported platforms

| Platform | Capture | Inject |
|---|---|---|
| Claude (claude.ai) | ✅ | ✅ |
| ChatGPT (chatgpt.com) | ✅ | ✅ |
| Gemini (gemini.google.com) | ✅ | ✅ |
| Perplexity (perplexity.ai) | ✅ | ✅ |
| DeepSeek (chat.deepseek.com) | ✅ | ✅ |
| Gmail (mail.google.com) | — | ✅ |

---

## Install (developer mode)

```bash
git clone https://github.com/Sakar1601/ContextForge.git
cd ContextForge
pnpm install
pnpm build
```

In Chrome: `chrome://extensions` → **Developer mode ON** → **Load unpacked** → select `packages/extension/dist`

---

## Usage

1. Open a conversation on any supported platform
2. Click the **ContextForge** icon in the toolbar
3. Click **Capture conversation**
4. Open a new conversation on any platform, drag the capsule onto the composer
5. Context is injected as text — send your message normally

**First run:** Settings open automatically. Paste your Anthropic API key (`sk-ant-…`) for AI-powered compression. Without a key, capsules capture the full raw conversation text.

---

## Features

| Feature | Description |
|---|---|
| **Capture** | Extracts goals, constraints, decisions, open questions via Claude Haiku |
| **Inject** | Drag-to-inject with adaptive resolution (full / compact / minimal) |
| **Search** | Hybrid BM25 + cosine similarity, runs locally via ONNX |
| **Version graph** | Full DAG — branch, merge, diff, rollback, cherry-pick |
| **Merge conflicts** | Visual conflict resolution UI |
| **A/B lift score** | Rate injections 👍/👎 per capsule |
| **Suggest widget** | Floating suggestions when you focus the AI composer |

---

## Development

```bash
pnpm check          # typecheck + lint + 213 unit tests
pnpm test:e2e       # Playwright E2E
pnpm dev            # Vite dev server with HMR
pnpm build          # Production build → packages/extension/dist/
pnpm generate-icons # Regenerate extension icons
```

---

## Project structure

```
packages/
  shared/          Types, Zod schemas, DAG operations, search
  compression/     Anthropic SDK extraction pipeline
  retrieval/       BM25 + cosine hybrid search
  adapters/        Per-platform adapters (claude, chatgpt, gemini, perplexity, deepseek, gmail)
  extension/
    src/popup/         React popup UI
    src/graph/         React Flow version graph
    src/content/       Content scripts + suggest widget
    src/service-worker/ Message router
    src/storage/       Dexie.js repositories
    src/offscreen/     ONNX embedding worker
docs/
  SPEC.md               Product specification
  ROADMAP.md            Build roadmap
  PRIVACY.md            Privacy policy
  WORKING_AGREEMENT.md  Development conventions
  adr/                  Architecture decision records
  design/               Per-phase design documents
scripts/
  generate-icons.mjs    SVG to PNG icon generator
```

---

## Architecture

### Runtime topology (MV3)

The extension has five isolated JS contexts that only talk to each other through typed `chrome.runtime` messages (`packages/shared/src/types/messaging.ts`, a Zod discriminated union). No context shares mutable state with another — the service worker itself holds no mutable state either, since MV3 can kill and restart it at any time; everything durable lives in IndexedDB (Dexie) or `chrome.storage.local`.

```
┌─────────────────┐        ┌──────────────────────────┐        ┌────────────────────┐
│  Content script  │◄──────►│      Service worker       │◄──────►│  Offscreen document │
│  (one per site)  │  msgs  │  (message router, no      │  msgs  │  (ONNX embeddings,  │
│  - extract turns │        │   mutable module state)   │        │   lives only while  │
│  - inject text   │        │  - CapsuleRepository       │        │   needed)           │
│  - drop zone     │        │  - BodyRepository          │        └────────────────────┘
│  - suggest widget│        │  - ProvenanceRepository    │
└─────────────────┘        │  - calls compress()        │        ┌────────────────────┐
                            │  - calls hybridSearch()    │◄──────►│    Popup (React)   │
                            │  - calls maybeEvict()      │  msgs  │  - capsule list     │
                            └──────────────────────────┘        │  - search / capture │
                                        ▲                        │  - settings         │
                                        │ msgs                   └────────────────────┘
                            ┌──────────────────────────┐
                            │  Graph page (React Flow)  │
                            │  opened as its own tab    │
                            └──────────────────────────┘
```

### End-to-end flow

**Capture** (`content/*.ts` → service worker → `packages/compression`):
1. Popup sends `CAPTURE_REQUEST { tabId }`.
2. Service worker asks the tab's content script for `EXTRACT_TURNS_REQUEST`; each platform adapter (`packages/adapters/*`) scrapes turns from the DOM via CSS selectors and reports `AdapterHealth`.
3. Service worker calls `compress(turns, apiKey, platform)`. With a key, it calls the Anthropic API directly from the service worker (`dangerouslyAllowBrowser: true` + `anthropic-dangerous-direct-browser-access` header, since MV3 service workers have no `window` but still need Anthropic's CORS gate satisfied) and parses XML-tagged goals/constraints/decisions/openQuestions. Without a key, or on API failure, it falls back to storing the raw turn text.
4. `commit()` (`packages/shared/dag`) content-hashes the manifest into a SHA-256 `id`, giving every capture a stable, deterministic identity.
5. `CapsuleRepository.save()` persists the manifest + DAG edges; `BodyRepository.save()` persists the raw body separately (bodies are evictable, manifests never are).
6. In the background, non-blocking: `embedCapsuleInBackground()` computes a sentence embedding via the offscreen document for search, and `maybeEvict()` checks `navigator.storage.estimate()` and drops the oldest capsules' `body.full` text (never their manifests) once usage crosses 80% of quota.

**Search**: popup sends `SEARCH_REQUEST`; service worker embeds the query (offscreen), loads recent manifests + their cached embeddings, and ranks with `hybridSearch()` (`packages/retrieval`) — 0.6 × cosine + 0.4 × BM25, falling back to BM25-only if embeddings aren't ready yet.

**Inject**: dragging a capsule (or clicking "Inject" in the suggest widget) sends `INJECT_REQUEST { capsuleId, windowWidth }`. The service worker picks an `InjectionResolution` (full/compact/minimal) by composer width (`selectResolution`), forwards `INJECT_COMMAND` to the target tab's content script, which builds the context block and inserts it via `execCommand('insertText')` (falling back to `Range.insertNode` where unavailable, e.g. under test). A `ProvenanceMap` row is written recording which capsule informed which turn.

**Version graph**: opened as a real tab (`src/graph/index.html?id=<rootId>`), not a popup panel, so React Flow has room to render. It BFS-walks `GET_CAPSULE_GRAPH_REQUEST` up parents and down children to load the whole connected component, then lays it out with `dagre`. Rollback, branch, merge, and cherry-pick all end by sending `SAVE_CAPSULE_REQUEST { manifest }`, which the service worker persists via the same `CapsuleRepository.save()` capture uses — so every graph mutation becomes a new, real, diffable commit rather than an ephemeral UI-only state.

### Storage model (Dexie / IndexedDB)

| Table | Written by | Evictable |
|---|---|---|
| `capsules` (manifest) | capture, rollback (pointer only), branch, merge, cherry-pick | No — manifests are permanent |
| `bodies` (raw text + embedding chunks) | capture, background embedding | Yes — `maybeEvict` drops `full` text under quota pressure |
| `dagEdges` (parent→child) | derived automatically from `manifest.parentIds` on every save | No |
| `provenanceMaps` | every injection | No (currently write-only — nothing reads it back yet, see Known gaps) |

### Privacy boundary

Only two outbound hosts are ever contacted, both declared in `manifest.json` `host_permissions`: `api.anthropic.com` (your own key, only during capture) and the HuggingFace CDN (embedding model weights, first run only, cached after). No telemetry, no first-party server.

---

## Known gaps / not yet wired

Found and left as-is (documented, not silently shipped) during this pass:

- **Provenance is write-only.** Every injection records a `ProvenanceMap`, but no UI ever reads `getByTurn()` back — the "provenance footer" described in the spec doesn't exist yet.
- **No automated tests for the service worker or the version-graph package.** All 213 unit tests cover `shared`, `compression`, `retrieval`, `adapters`, and the popup's storage layer — the message router (`service-worker/index.ts`) and all of `graph/` (GraphApp, layout, DiffPanel, MergeConflictModal) have zero test coverage and have only been exercised by hand.
- **DOM selectors verified live on Claude only.** ChatGPT, Gemini, Perplexity, DeepSeek, and Gmail selectors have not been checked against their real, current DOM — only against static fixtures / at build time.
- **No accessibility audit** (axe-core) has been run.
- **CRXJS is community-maintained and marked deprecated upstream**; ADR-0001 names WXT as the fallback if it breaks on a future Chrome release.

Fixed during this pass (previously silent bugs):
- Anthropic API calls were blocked by CORS — service worker now sends the browser-access header and `api.anthropic.com` is now in `host_permissions`.
- Merge and cherry-pick in the version graph computed a result and showed a "success" toast but never persisted it — added `SAVE_CAPSULE_REQUEST` so both now produce a real, saved commit.
- The LRU storage-eviction policy (`maybeEvict`) was fully implemented and tested but never called from anywhere — now runs after every capture.
- Six content scripts' fire-and-forget `chrome.runtime.sendMessage` calls had no `.catch()`, so every extension reload/update while a tab was open logged an uncaught "Extension context invalidated" error — now caught silently.
- Removed 5 orphaned e2e fixture HTML files with zero test references, one dead selector constant, and two unused retrieval exports.

---

## Privacy

All data stays on your device. See [docs/PRIVACY.md](docs/PRIVACY.md).

---

## Stack

React 18 · TypeScript strict · Vite + CRXJS · Dexie.js · @xenova/transformers · Anthropic SDK · React Flow · Vitest · Playwright · pnpm workspaces
