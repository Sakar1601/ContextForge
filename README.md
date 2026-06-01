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

## Privacy

All data stays on your device. See [docs/PRIVACY.md](docs/PRIVACY.md).

---

## Stack

React 18 · TypeScript strict · Vite + CRXJS · Dexie.js · @xenova/transformers · Anthropic SDK · React Flow · Vitest · Playwright · pnpm workspaces
