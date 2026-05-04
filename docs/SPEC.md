# ContextForge — Product Specification

> Reference material. Loaded on demand, not every session.  
> Working agreement + rules live in `/CLAUDE.md`.  
> Phase-by-phase plan lives in `/docs/ROADMAP.md`.

---

## 1. Vision

AI conversations are ephemeral and siloed. Every new session starts cold, and every platform forgets what you learned on a different platform. ContextForge solves this by turning conversations into portable, versioned, privacy-preserving **Capsules** — compressed snapshots of goals, constraints, decisions, and open questions that can be injected into any supported AI interface.

---

## 2. Core Concepts

### 2.1 Capsule

A Capsule is the fundamental unit. It represents a conversation or a meaningful slice of one. It has two parts:

**CapsuleManifest** — always kept, never evicted:
```
id:          string   // SHA-256 of (origin + turnHash + createdAt ISO)
title:       string   // LLM-generated short title
summary:     string   // LLM-generated ≤150-word abstract
goals:       string[] // extracted user intent bullets
constraints: string[] // rules/preferences the user stated
decisions:   string[] // conclusions reached in the conversation
openQuestions: string[] // unresolved threads
platform:    Platform // source platform enum
createdAt:   ISO8601
updatedAt:   ISO8601
turnCount:   number
tokenEstimate: number
tags:        string[]
parentIds:   string[] // DAG edges (empty for root capsules)
```

**CapsuleBody** — may be evicted under quota pressure:
```
full:    string  // verbatim conversation text
chunks:  Chunk[] // sentence-level segments with embeddings
```

### 2.2 ProvenanceMap

Tracks which Capsule(s) contributed context to a given AI turn:
```
turnId:     string
capsuleIds: string[]
platform:   Platform
injectedAt: ISO8601
```
Stored per conversation, used for A/B evaluation and the provenance footer.

### 2.3 DAG Versioning

Every Capsule save is a **commit**. Commits form a DAG (directed acyclic graph) where:
- A **branch** creates a new named head from any commit
- A **merge** produces a new commit with two `parentIds`; the merge algorithm is three-way (common ancestor → left → right)
- **Cherry-pick** copies a subset of fields from one branch to another
- **Diff** compares two commits field-by-field

Merge conflicts arise when left and right diverge on the same field (e.g., contradictory constraints). The UI presents them for manual resolution.

### 2.4 Platform Enum

```
claude | chatgpt | gemini | perplexity | deepseek | gmail
```

---

## 3. Supported Platforms (v1)

| Platform        | Host                   | Capture | Inject |
|-----------------|------------------------|---------|--------|
| Claude          | claude.ai              | ✓       | ✓      |
| ChatGPT         | chatgpt.com            | ✓       | ✓      |
| Gemini          | gemini.google.com      | ✓       | ✓      |
| Perplexity      | perplexity.ai          | ✓       | ✓      |
| DeepSeek        | deepseek.com           | ✓       | ✓      |
| Gmail           | mail.google.com        | ✗       | ✓      |

Gmail is inject-only: context is inserted into compose drafts, not captured.

---

## 4. User Flows

### 4.1 Capture
1. User is on a supported AI platform mid-conversation.
2. Extension popup shows a **Capture** button (disabled + explanation if adapter is unhealthy).
3. User clicks Capture. Content script calls `adapter.extractConversation()`.
4. Raw turns sent to the compression pipeline (Anthropic API call).
5. Structured `CapsuleManifest` returned; `CapsuleBody.full` stored verbatim.
6. Capsule committed to the DAG; popup updates to show it.

### 4.2 Inject (drag-and-drop)
1. User opens popup, sees list of Capsules.
2. Drags a Capsule tile onto the AI platform's input area.
3. Drop zone (detected by content script) renders a blue overlay.
4. On drop: `adapter.injectContext(capsule, resolution)` inserts a formatted context block.
5. Resolution is chosen adaptively by target window width:
   - ≥1200px → full (goals + constraints + decisions + open questions)
   - 800–1199px → compact (goals + constraints only)
   - <800px → minimal (one-sentence summary)
6. Provenance footer is appended: `📎 Context from: [title] via ContextForge`.

### 4.3 Browse & Version
1. Popup lists capsules sorted by `updatedAt` desc.
2. User can open the version graph (React Flow) for any capsule.
3. Graph shows commits as nodes, parent edges as lines; branches named.
4. User can diff any two commits, rollback, branch from any node, or cherry-pick fields.

### 4.4 Search
1. Search bar in popup triggers hybrid retrieval (cosine similarity + BM25).
2. Embeddings computed locally via transformers.js (worker thread).
3. If model fails to load, BM25-only fallback activates silently.
4. Floating "Suggest capsules" widget (optional, togglable) appears on supported platforms.

### 4.5 A/B Evaluation
1. User can "fork" any prompt: send it once with Capsule context, once without.
2. Both responses shown side-by-side.
3. User rates which was better; a **lift score** (−1 to +1) is stored on the Capsule.

---

## 5. Compression Pipeline

Input: raw conversation turns (`[{role, content}]`)  
Output: `CapsuleManifest` fields

Steps:
1. Truncate to fit Anthropic API context window (prefer recent turns; keep system prompt).
2. Send structured extraction prompt (see `/docs/design/extraction-prompt.md`).
3. Parse response with Zod schema; reject / retry once on schema mismatch.
4. If API key missing or call fails → store raw turns only, mark `compressed: false`, queue for retry.

The extraction prompt is defined separately so it can be iterated without code changes.

---

## 6. SiteAdapter Interface

Every platform adapter implements this interface (defined in `/packages/shared`):

```typescript
interface SiteAdapter {
  readonly platform: Platform;

  /** Returns 'healthy' | 'unhealthy' with an optional reason string */
  health(): AdapterHealth;

  /** Extracts the current conversation as raw turns */
  extractConversation(): ConversationTurn[];

  /** Returns the DOM element where context blocks should be injected */
  getInjectionTarget(): Element | null;

  /** Injects formatted context into the target; returns the injected element */
  injectContext(capsule: CapsuleManifest, resolution: InjectionResolution): Element;

  /** Observes DOM for conversation changes; calls callback on new turns */
  observeChanges(callback: (turns: ConversationTurn[]) => void): () => void;
}
```

---

## 7. Persistence Layer

- **Engine:** Dexie.js (IndexedDB wrapper)
- **Tables:** `capsules`, `bodies`, `provenanceMaps`, `dagEdges`
- **Migrations:** versioned Dexie upgrade hooks, never destructive
- **Quota policy:** when IndexedDB approaches the browser-reported quota:
  1. Evict `CapsuleBody.full` for oldest capsules (LRU by `updatedAt`)
  2. Retain `CapsuleManifest` and `CapsuleBody.chunks` (embeddings)
  3. Warn the user via popup notification
- **Backup/export:** v2 scope

---

## 8. Privacy & Security

- No telemetry. No analytics. No remote server.
- Network calls permitted: Anthropic API (user's own key), HuggingFace CDN (model weights, first run).
- API key stored in `chrome.storage.local` (never synced).
- Content scripts have no fetch(); all API calls go through the service worker.
- New network destinations require an ADR and user approval in settings.

---

## 9. Extension Architecture Overview

```
┌─────────────────────────────────────────┐
│  Browser Tab (claude.ai, chatgpt, …)   │
│  ┌────────────────────────────────┐     │
│  │  Content Script                │     │
│  │  - SiteAdapter instance        │     │
│  │  - Drag-drop drop zone         │     │
│  │  - Provenance footer           │     │
│  └────────────┬───────────────────┘     │
└───────────────│─────────────────────────┘
                │ chrome.runtime.sendMessage
                │ (typed message passing)
┌───────────────▼─────────────────────────┐
│  Service Worker (MV3)                   │
│  - Message router                       │
│  - Compression pipeline (Anthropic)     │
│  - Embedding worker management          │
│  - Dexie repository calls               │
└───────────────┬─────────────────────────┘
                │ chrome.runtime.sendMessage
┌───────────────▼─────────────────────────┐
│  Extension Popup (React)                │
│  - Capsule list + search                │
│  - Version graph (React Flow)           │
│  - Drag source                          │
│  - Settings / API key entry             │
└─────────────────────────────────────────┘
```

---

## 10. Definition of Done — v1

The following must all be true before v1 is tagged:

- [ ] `pnpm check` passes (0 type errors, 0 lint errors, all unit tests green)
- [ ] `pnpm test:e2e` passes for claude.ai, chatgpt.com, gemini.google.com, perplexity.ai, deepseek.com, mail.google.com (inject-only)
- [ ] Capture flow works end-to-end on claude.ai
- [ ] Drag-to-inject works on all 5 capture platforms and Gmail
- [ ] DAG operations (commit, branch, merge, diff, rollback, cherry-pick) covered at 90%+ unit test coverage
- [ ] Version graph renders, merge conflicts surfaced in UI
- [ ] Search returns results (cosine + BM25); BM25-only fallback tested
- [ ] A/B fork, side-by-side diff, and lift score persist correctly
- [ ] LRU eviction triggers correctly when quota is exceeded (tested with mocked quota)
- [ ] Adapter unhealthy state disables capture button with explanation
- [ ] Raw capture mode works when API key is absent
- [ ] Privacy invariant: no network requests other than Anthropic API and HuggingFace CDN (verified by Playwright network intercept)
- [ ] Onboarding flow complete
- [ ] Accessibility audit passed (axe-core, 0 critical violations)
- [ ] All ADRs written for any non-obvious architectural decision
