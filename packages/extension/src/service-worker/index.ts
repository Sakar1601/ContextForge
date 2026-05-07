// Service worker entry point.
// No module-level mutable state — all state lives in IndexedDB or chrome.storage.
// The DB and repositories are module-level constants: Dexie opens lazily and
// holds no mutable JS state, so this is compliant with MV3 discipline.

import { commit, selectResolution } from '@contextforge/shared'
import type { CapsuleManifest, ConversationTurn, Platform } from '@contextforge/shared'
import { compress } from '@contextforge/compression'
import { hybridSearch, capsuleText } from '@contextforge/retrieval'
import { ContextForgeDB } from '../storage/db'
import { CapsuleRepository } from '../storage/repositories/capsule-repository'
import { BodyRepository } from '../storage/repositories/body-repository'
import { ProvenanceRepository } from '../storage/repositories/provenance-repository'

const db = new ContextForgeDB()
const capsuleRepo = new CapsuleRepository(db)
const bodyRepo = new BodyRepository(db)
const provenanceRepo = new ProvenanceRepository(db)

chrome.runtime.onMessage.addListener(
  (
    msg: { type: string; target?: string; [k: string]: unknown },
    sender: chrome.runtime.MessageSender,
    sendResponse: (r: unknown) => void,
  ) => {
    // Messages targeted at the offscreen document are handled there; ignore here.
    if (msg.target === 'offscreen') return false
    handleMessage(msg, sender, sendResponse)
    return true // keep channel open for async responses
  },
)

async function handleMessage(
  msg: { type: string; [k: string]: unknown },
  sender: chrome.runtime.MessageSender,
  sendResponse: (r: unknown) => void,
) {
  try {
    switch (msg.type) {
      case 'EMBED_REQUEST': {
        await ensureOffscreen()
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- chrome.runtime returns any
        const embedResp = await chrome.runtime.sendMessage({
          target: 'offscreen', type: 'EMBED_REQUEST', texts: msg.texts,
        })
        sendResponse(embedResp)
        break
      }

      case 'SEARCH_REQUEST': {
        const query = msg.query as string
        const limit = typeof msg.limit === 'number' ? msg.limit : 10
        const manifests = await capsuleRepo.listRecent(500)
        let queryEmbedding: number[] | null = null
        try {
          await ensureOffscreen()
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- chrome.runtime returns any
          const r = await chrome.runtime.sendMessage({
            target: 'offscreen', type: 'EMBED_REQUEST', texts: [query],
          })
          queryEmbedding = (r as { embeddings?: number[][] }).embeddings?.[0] ?? null
        } catch { /* BM25-only fallback */ }
        const embeddingMap = new Map<string, number[]>()
        for (const m of manifests) {
          const body = await bodyRepo.get(m.id)
          const emb = body?.chunks[0]?.embedding
          if (emb) embeddingMap.set(m.id, emb)
        }
        const capsuleIds = hybridSearch(query, queryEmbedding, manifests, embeddingMap, limit)
        sendResponse({ type: 'SEARCH_RESPONSE', capsuleIds })
        break
      }

      case 'LIST_CAPSULES_REQUEST': {
        const limit = typeof msg.limit === 'number' ? msg.limit : 20
        const manifests = await capsuleRepo.listRecent(limit)
        sendResponse({ type: 'LIST_CAPSULES_RESPONSE', manifests })
        break
      }

      case 'CAPTURE_REQUEST': {
        const tabId = msg.tabId as number
        await handleCapture(tabId, sendResponse)
        break
      }

      case 'INJECT_REQUEST': {
        const capsuleId = msg.capsuleId as string
        const windowWidth = typeof msg.windowWidth === 'number' ? msg.windowWidth : 1200
        // tabId from sender (content script) or explicit (popup)
        const tabId = sender.tab?.id ?? (typeof msg.tabId === 'number' ? msg.tabId : undefined)
        await handleInject(capsuleId, windowWidth, tabId, sendResponse)
        break
      }

      case 'ADAPTER_HEALTH_REQUEST': {
        const tabId = msg.tabId as number
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- chrome.tabs.sendMessage returns any
        const response = await chrome.tabs.sendMessage(tabId, {
          type: 'ADAPTER_HEALTH_REQUEST',
        })
        sendResponse(response)
        break
      }

      case 'GET_CAPSULE_GRAPH_REQUEST': {
        const capsuleId = msg.capsuleId as string
        const all = await collectGraph(capsuleId)
        sendResponse({ type: 'GET_CAPSULE_GRAPH_RESPONSE', manifests: all })
        break
      }

      case 'ROLLBACK_REQUEST': {
        const capsuleId = msg.capsuleId as string
        const manifest = await capsuleRepo.get(capsuleId)
        if (!manifest) { sendResponse({ type: 'ROLLBACK_RESPONSE', success: false }); break }
        // Store the active version keyed by root id (first ancestor with no parents)
        const root = await findRoot(capsuleId)
        await chrome.storage.local.set({ [`active_${root}`]: capsuleId })
        sendResponse({ type: 'ROLLBACK_RESPONSE', success: true })
        break
      }

      case 'BRANCH_CREATE_REQUEST': {
        const { name, tipId } = msg as { type: string; name: string; tipId: string }
        const existing = (await chrome.storage.local.get('branches')) as { branches?: Array<{ name: string; tipId: string }> }
        const branches = existing.branches ?? []
        branches.push({ name, tipId })
        await chrome.storage.local.set({ branches })
        sendResponse({ type: 'BRANCH_CREATE_RESPONSE', branch: { name, tipId } })
        break
      }

      case 'BRANCH_LIST_REQUEST': {
        const stored = (await chrome.storage.local.get('branches')) as { branches?: Array<{ name: string; tipId: string }> }
        sendResponse({ type: 'BRANCH_LIST_RESPONSE', branches: stored.branches ?? [] })
        break
      }

      case 'UPDATE_LIFT_SCORE_REQUEST': {
        const capsuleId = msg.capsuleId as string
        const liftScore = msg.liftScore as number
        const manifest = await capsuleRepo.get(capsuleId)
        if (!manifest) { sendResponse({ type: 'UPDATE_LIFT_SCORE_RESPONSE', success: false }); break }
        await capsuleRepo.save({ ...manifest, liftScore })
        sendResponse({ type: 'UPDATE_LIFT_SCORE_RESPONSE', success: true })
        break
      }

      default:
        sendResponse({ error: `Unknown message type: ${msg.type}` })
    }
  } catch (err) {
    sendResponse({ error: String(err) })
  }
}

async function handleInject(
  capsuleId: string,
  windowWidth: number,
  tabId: number | undefined,
  sendResponse: (r: unknown) => void,
) {
  if (!tabId) {
    sendResponse({ type: 'INJECT_RESPONSE', success: false, error: 'No tab context' })
    return
  }

  const manifest = await capsuleRepo.get(capsuleId)
  if (!manifest) {
    sendResponse({ type: 'INJECT_RESPONSE', success: false, error: 'Capsule not found' })
    return
  }

  // For raw (uncompressed) capsules, surface the actual conversation text as the summary
  // so the injection has real content to show rather than empty extracted fields.
  let effectiveManifest = manifest
  if (!manifest.compressed) {
    const body = await bodyRepo.get(capsuleId)
    if (body?.full) {
      // 4000 chars covers ~6-8 typical exchanges; trim at a line boundary if possible
      const MAX = 4000
      let preview = body.full
      if (preview.length > MAX) {
        const cut = preview.lastIndexOf('\n', MAX)
        preview = preview.slice(0, cut > 0 ? cut : MAX) + '\n…'
      }
      effectiveManifest = { ...manifest, summary: preview }
    }
  }

  const resolution = selectResolution(windowWidth)

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- chrome.tabs.sendMessage returns any
  const result = await chrome.tabs.sendMessage(tabId, {
    type: 'INJECT_COMMAND',
    manifest: effectiveManifest,
    resolution,
  })

  // Save provenance record
  await provenanceRepo.save({
    id: crypto.randomUUID(),
    turnId: `inject-${Date.now()}`,
    capsuleIds: [capsuleId],
    platform: manifest.platform,
    injectedAt: new Date().toISOString(),
  })

  sendResponse({ type: 'INJECT_RESPONSE', success: true, ...(result as object) })
}

function platformFromUrl(url: string): Platform {
  if (url.includes('claude.ai'))           return 'claude'
  if (url.includes('chatgpt.com'))         return 'chatgpt'
  if (url.includes('gemini.google.com'))   return 'gemini'
  if (url.includes('perplexity.ai'))       return 'perplexity'
  if (url.includes('deepseek.com'))        return 'deepseek'
  if (url.includes('mail.google.com'))     return 'gmail'
  return 'claude'
}

async function handleCapture(tabId: number, sendResponse: (r: unknown) => void) {
  // Detect platform from the tab URL so the capsule is tagged correctly.
  const tab = await chrome.tabs.get(tabId)
  const platform = platformFromUrl(tab.url ?? '')

  const extracted = (await chrome.tabs.sendMessage(tabId, {
    type: 'EXTRACT_TURNS_REQUEST',
  })) as { type: string; turns: unknown[]; health: { status: string; reason?: string } }

  if (extracted.health.status === 'unhealthy') {
    sendResponse({
      type: 'CAPTURE_RESPONSE',
      capsuleId: '',
      error: extracted.health.reason ?? 'Adapter unhealthy',
    })
    return
  }

  const storage = await chrome.storage.local.get('anthropicApiKey')
  const apiKey = (storage['anthropicApiKey'] as string | undefined) ?? ''
  const turns = extracted.turns as ConversationTurn[]
  const result = await compress(turns, apiKey, platform)

  const now = new Date()
  const nowIso = now.toISOString()
  const baseFields = result.compressed
    ? {
        ...result.fields,
        createdAt: nowIso,
        updatedAt: nowIso,
        parentIds: [],
        compressed: true as const,
      }
    : {
        title: `Captured ${now.toLocaleString()}`,
        summary: '',
        goals: [],
        constraints: [],
        decisions: [],
        openQuestions: [],
        platform,
        turnCount: turns.length,
        tokenEstimate: turns.reduce((n, t) => n + Math.ceil(t.content.length / 4), 0),
        tags: [],
        createdAt: nowIso,
        updatedAt: nowIso,
        parentIds: [],
        compressed: false as const,
      }

  const manifest = await commit(baseFields)
  await capsuleRepo.save(manifest)
  const body = {
    capsuleId: manifest.id,
    full: result.compressed
      ? undefined
      : turns.map((t) => `[${t.role}] ${t.content}`).join('\n\n'),
    chunks: [],
  }
  await bodyRepo.save(body)

  sendResponse({ type: 'CAPTURE_RESPONSE', capsuleId: manifest.id })
  // Embed in the background; does not block the response.
  void embedCapsuleInBackground(manifest.id)
}

async function ensureOffscreen(): Promise<void> {
  try {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('src/offscreen/index.html'),
      reasons: ['WORKERS' as chrome.offscreen.Reason],
      justification: 'transformers.js embedding inference for capsule search',
    })
  } catch {
    // Offscreen document already exists — reuse it.
  }
}

async function embedCapsuleInBackground(capsuleId: string): Promise<void> {
  try {
    const manifest = await capsuleRepo.get(capsuleId)
    if (!manifest) return
    await ensureOffscreen()
    const text = capsuleText(manifest)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- chrome.runtime returns any
    const r = await chrome.runtime.sendMessage({
      target: 'offscreen', type: 'EMBED_REQUEST', texts: [text],
    })
    const embedding = (r as { embeddings?: number[][] }).embeddings?.[0]
    if (!embedding) return
    const existingBody = await bodyRepo.get(capsuleId)
    await bodyRepo.save({
      capsuleId,
      full: existingBody?.full,
      chunks: [{
        id: `${capsuleId}-embed`,
        text,
        embedding,
        startChar: 0,
        endChar: text.length,
      }],
    })
  } catch { /* embedding is best-effort; silently ignore failures */ }
}

async function collectGraph(capsuleId: string): Promise<CapsuleManifest[]> {
  const seen = new Set<string>()
  const queue = [capsuleId]
  const result: CapsuleManifest[] = []

  while (queue.length > 0) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    const manifest = await capsuleRepo.get(id)
    if (!manifest) continue
    result.push(manifest)
    for (const parentId of manifest.parentIds) {
      if (!seen.has(parentId)) queue.push(parentId)
    }
    const children = await capsuleRepo.getChildren(id)
    for (const childId of children) {
      if (!seen.has(childId)) queue.push(childId)
    }
  }

  return result
}

async function findRoot(capsuleId: string): Promise<string> {
  let id = capsuleId
  for (let i = 0; i < 100; i++) {
    const manifest = await capsuleRepo.get(id)
    if (!manifest || manifest.parentIds.length === 0) return id
    const firstParent = manifest.parentIds[0]
    if (!firstParent) return id
    id = firstParent
  }
  return id
}
