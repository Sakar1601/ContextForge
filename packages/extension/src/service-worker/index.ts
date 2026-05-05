// Service worker entry point.
// No module-level mutable state — all state lives in IndexedDB or chrome.storage.
// The DB and repositories are module-level constants: Dexie opens lazily and
// holds no mutable JS state, so this is compliant with MV3 discipline.

import { commit, selectResolution } from '@contextforge/shared'
import type { ConversationTurn } from '@contextforge/shared'
import { compress } from '@contextforge/compression'
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
    msg: { type: string; [k: string]: unknown },
    sender: chrome.runtime.MessageSender,
    sendResponse: (r: unknown) => void,
  ) => {
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

  const resolution = selectResolution(windowWidth)

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- chrome.tabs.sendMessage returns any
  const result = await chrome.tabs.sendMessage(tabId, {
    type: 'INJECT_COMMAND',
    manifest,
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

async function handleCapture(tabId: number, sendResponse: (r: unknown) => void) {
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
  const result = await compress(turns, apiKey, 'claude')

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
        platform: 'claude' as const,
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
}
