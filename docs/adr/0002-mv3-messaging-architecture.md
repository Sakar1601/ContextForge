# ADR-0002: Manifest V3 Messaging Architecture

**Status:** Draft — awaiting approval  
**Date:** 2026-05-04  
**Deciders:** Sakar Joshi

---

## Context

Manifest V3 imposes three hard constraints relevant to ContextForge:

1. **No persistent background page.** The service worker terminates after 
   ~30 seconds of inactivity. Any in-memory state it held is gone.
2. **Isolated contexts.** The popup, each content script, and the service 
   worker run in separate JS contexts with no shared memory.
3. **No long-running compute in the service worker.** Tasks that take more 
   than a few seconds (e.g., loading a 20 MB embedding model) will race the 
   30-second termination deadline.

These constraints require explicit decisions about:
- Where state lives
- How contexts communicate
- Where ML inference runs

---

## Decisions

### Decision 1: All mutable state lives in IndexedDB or `chrome.storage`

No context holds the authoritative copy of any application state in memory. 
The service worker, popup, and content scripts all read from and write to 
IndexedDB (via Dexie, through the service worker). `chrome.storage.local` 
holds configuration (API key, user settings) because it's accessible 
synchronously from any context and survives service worker restarts.

**Implication:** The service worker is stateless between messages. Each 
message handler reads what it needs from storage, acts, writes back, and 
returns. No singletons. No module-level mutable variables.

---

### Decision 2: All cross-context communication via typed message passing

Every message is a discriminated union tagged with a `type` field. Request 
and response shapes are defined in `/packages/shared/messaging` and 
validated with Zod on receipt.

**Message flow:**

```
Popup ──sendMessage──► Service Worker ──Dexie──► IndexedDB
         (request)     (handler)
         ◄──response──
         
Content Script ──sendMessage──► Service Worker ──Dexie──► IndexedDB
               (request)        (handler)
               ◄──response──

Service Worker ──sendMessage──► Content Script (tab-targeted)
               (push, e.g. capsule ready notification)
```

**Message catalogue (initial, extended as phases progress):**

```typescript
// Defined in /packages/shared/messaging/types.ts

type ExtensionMessage =
  | { type: 'CAPTURE_REQUEST'; tabId: number }
  | { type: 'CAPTURE_RESPONSE'; capsuleId: string }
  | { type: 'INJECT_REQUEST'; capsuleId: string; tabId: number }
  | { type: 'INJECT_RESPONSE'; success: boolean; error?: string }
  | { type: 'ADAPTER_HEALTH_REQUEST'; tabId: number }
  | { type: 'ADAPTER_HEALTH_RESPONSE'; status: 'healthy' | 'unhealthy'; reason?: string }
  | { type: 'EMBED_REQUEST'; texts: string[] }
  | { type: 'EMBED_RESPONSE'; embeddings: number[][] }
  | { type: 'SEARCH_REQUEST'; query: string; limit: number }
  | { type: 'SEARCH_RESPONSE'; capsuleIds: string[] };
```

Each handler wraps `chrome.runtime.sendMessage` in a typed helper that 
rejects unknown `type` values at compile time.

---

### Decision 3: Embedding worker runs in an Offscreen Document

**Problem:** Loading a sentence-transformer model (20–30 MB) and running 
inference takes 5–10 seconds total. The MV3 service worker's 30-second 
lifetime means it can be terminated before inference completes if other 
messages aren't keeping it alive. Worse, there is no reliable way to extend 
service worker lifetime for pure compute tasks.

**Solution:** Use `chrome.offscreen.createDocument()` to create a hidden 
offscreen document (`offscreen.html`) that hosts the transformers.js 
`pipeline`. The offscreen document is not subject to the service worker 
lifetime constraints — it lives for the duration of the browser session 
(or until explicitly closed).

**Flow:**
```
Popup/Content Script
    │ EMBED_REQUEST (via service worker)
    ▼
Service Worker
    │ chrome.runtime.sendMessage to offscreen document
    ▼
Offscreen Document (offscreen.html + offscreen.ts)
    │ transformers.js inference
    ▼
    │ response back to service worker
    ▼
Service Worker
    │ response back to original caller
    ▼
Popup/Content Script
```

The offscreen document is created lazily on the first `EMBED_REQUEST` and 
reused. Only one offscreen document is permitted per extension at a time 
(Chrome limitation); this is the only one.

**Model:** `Xenova/all-MiniLM-L6-v2` (22 MB quantized, 384-dim embeddings). 
Downloaded once from HuggingFace CDN; cached by the browser thereafter.

---

### Decision 4: Content scripts are passive receivers + extractors only

Content scripts:
- Run the platform-specific `SiteAdapter` to extract conversation turns and 
  detect injection targets.
- Listen for `INJECT_REQUEST` messages from the service worker and call 
  `adapter.injectContext()`.
- Do **not** call `fetch()` directly. All network calls go through the 
  service worker.
- Do **not** access IndexedDB directly. All storage calls go through the 
  service worker.

This keeps the attack surface of content scripts minimal: if a host page's 
XSS compromises a content script, it cannot reach IndexedDB or the API key 
in `chrome.storage`.

---

### Decision 5: Service worker keep-alive during long operations

For long Anthropic API calls (compression pipeline, potentially 10–30 s), 
the service worker uses a `chrome.alarms`-based keep-alive: set a 0.5-minute 
alarm before the API call, clear it on completion. This prevents the worker 
from being killed mid-call.

Alternative considered: offscreen document for API calls too. Rejected 
because (a) only one offscreen doc is allowed, (b) Anthropic calls don't 
have the cold-start cost that transformers.js does.

---

## Consequences

- No module-level mutable state in any file imported by the service worker.
- The shared messaging types in `/packages/shared/messaging` are the single 
  source of truth for all inter-context contracts; changes require updating 
  all handlers.
- The offscreen document lifecycle must be managed carefully: create on first 
  need, reuse, do not recreate if already exists (`chrome.offscreen` throws 
  if you call `createDocument` twice).
- Content scripts have zero direct storage or network access — all proxied 
  through the service worker. This simplifies the threat model at the cost 
  of one message-passing hop per operation.
- `chrome.alarms` permission must be declared in the manifest.
