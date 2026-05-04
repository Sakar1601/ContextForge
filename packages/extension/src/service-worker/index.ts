// Service worker entry point.
// No module-level mutable state — all state lives in IndexedDB or chrome.storage.
// The DB and repositories are module-level constants: Dexie opens lazily and
// holds no mutable JS state, so this is compliant with MV3 discipline.

import { commit } from '@contextforge/shared'
import type { ConversationTurn } from '@contextforge/shared'
import { compress } from '@contextforge/compression'
import { ContextForgeDB } from '../storage/db'
import { CapsuleRepository } from '../storage/repositories/capsule-repository'
import { BodyRepository } from '../storage/repositories/body-repository'

const db = new ContextForgeDB()
const capsuleRepo = new CapsuleRepository(db)
const bodyRepo = new BodyRepository(db)

chrome.runtime.onMessage.addListener(
  (
    msg: { type: string; [k: string]: unknown },
    _sender,
    sendResponse: (r: unknown) => void,
  ) => {
    handleMessage(msg, sendResponse)
    return true // keep channel open for async responses
  },
)

async function handleMessage(
  msg: { type: string; [k: string]: unknown },
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

      case 'ADAPTER_HEALTH_REQUEST': {
        const tabId = msg.tabId as number
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- chrome.tabs.sendMessage returns any
        const response = await chrome.tabs.sendMessage(tabId, {
          type: 'ADAPTER_HEALTH_REQUEST',
          tabId,
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

async function handleCapture(tabId: number, sendResponse: (r: unknown) => void) {
  // 1. Extract turns from the content script
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

  // 2. Get API key
  const storage = await chrome.storage.local.get('anthropicApiKey')
  const apiKey = (storage['anthropicApiKey'] as string | undefined) ?? ''

  // 3. Compress (or raw mode if no key)
  const turns = extracted.turns as ConversationTurn[]
  const result = await compress(turns, apiKey, 'claude')

  // 4. Build manifest fields
  const now = new Date().toISOString()
  const baseFields = result.compressed
    ? {
        ...result.fields,
        createdAt: now,
        updatedAt: now,
        parentIds: [],
        compressed: true as const,
      }
    : {
        title: `Captured ${new Date().toLocaleString()}`,
        summary: '',
        goals: [],
        constraints: [],
        decisions: [],
        openQuestions: [],
        platform: 'claude' as const,
        turnCount: turns.length,
        tokenEstimate: turns.reduce((n, t) => n + Math.ceil(t.content.length / 4), 0),
        tags: [],
        createdAt: now,
        updatedAt: now,
        parentIds: [],
        compressed: false as const,
      }

  // 5. Commit (computes content-hash id)
  const manifest = await commit(baseFields)

  // 6. Persist
  await capsuleRepo.save(manifest)
  const body = {
    capsuleId: manifest.id,
    full: result.compressed ? undefined : turns.map((t) => `[${t.role}] ${t.content}`).join('\n\n'),
    chunks: [],
  }
  await bodyRepo.save(body)

  sendResponse({ type: 'CAPTURE_RESPONSE', capsuleId: manifest.id })
}
