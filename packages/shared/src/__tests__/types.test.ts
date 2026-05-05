import { describe, expect, it } from 'vitest'
import { PLATFORMS, PlatformSchema } from '../types/platform'
import {
  CapsuleBodySchema,
  CapsuleManifestSchema,
  CapsuleSchema,
  ChunkSchema,
} from '../types/capsule'
import { ProvenanceMapSchema } from '../types/provenance'
import {
  AdapterHealthSchema,
  ConversationTurnSchema,
  InjectionResolutionSchema,
} from '../types/adapter'
import { ExtensionMessageSchema } from '../types/messaging'

// ─── helpers ────────────────────────────────────────────────────────────────

const NOW = '2024-01-01T00:00:00.000Z'

function validManifest() {
  return {
    id: 'deadbeef'.repeat(8),
    title: 'Test capsule',
    summary: 'A short summary',
    goals: ['finish the project'],
    constraints: ['no external APIs'],
    decisions: ['use Dexie'],
    openQuestions: ['what is the schema?'],
    platform: 'claude' as const,
    createdAt: NOW,
    updatedAt: NOW,
    turnCount: 3,
    tokenEstimate: 500,
    tags: ['work'],
    parentIds: [],
    compressed: true,
  }
}

// ─── Platform ────────────────────────────────────────────────────────────────

describe('PLATFORMS', () => {
  it('contains exactly the six supported platforms', () => {
    expect([...PLATFORMS].sort()).toEqual(
      ['chatgpt', 'claude', 'deepseek', 'gemini', 'gmail', 'perplexity'],
    )
  })
})

describe('PlatformSchema', () => {
  it.each(PLATFORMS)('accepts "%s"', (p) => {
    expect(PlatformSchema.parse(p)).toBe(p)
  })

  it('rejects an unknown platform', () => {
    expect(() => PlatformSchema.parse('openai')).toThrow()
  })

  it('rejects an empty string', () => {
    expect(() => PlatformSchema.parse('')).toThrow()
  })
})

// ─── Chunk ───────────────────────────────────────────────────────────────────

describe('ChunkSchema', () => {
  it('accepts a chunk without an embedding', () => {
    const chunk = { id: '1', text: 'hello world', startChar: 0, endChar: 11 }
    expect(ChunkSchema.parse(chunk)).toEqual(chunk)
  })

  it('accepts a chunk with an embedding', () => {
    const chunk = { id: '1', text: 'hello', startChar: 0, endChar: 5, embedding: [0.1, 0.9] }
    expect(ChunkSchema.parse(chunk)).toEqual(chunk)
  })

  it('rejects a negative startChar', () => {
    expect(() =>
      ChunkSchema.parse({ id: '1', text: 'x', startChar: -1, endChar: 1 }),
    ).toThrow()
  })
})

// ─── CapsuleManifest ─────────────────────────────────────────────────────────

describe('CapsuleManifestSchema', () => {
  it('accepts a fully valid manifest', () => {
    expect(CapsuleManifestSchema.parse(validManifest())).toEqual(validManifest())
  })

  it('rejects an empty title', () => {
    expect(() => CapsuleManifestSchema.parse({ ...validManifest(), title: '' })).toThrow()
  })

  it('rejects a negative turnCount', () => {
    expect(() => CapsuleManifestSchema.parse({ ...validManifest(), turnCount: -1 })).toThrow()
  })

  it('rejects a negative tokenEstimate', () => {
    expect(() =>
      CapsuleManifestSchema.parse({ ...validManifest(), tokenEstimate: -100 }),
    ).toThrow()
  })

  it('rejects an invalid platform', () => {
    expect(() =>
      CapsuleManifestSchema.parse({ ...validManifest(), platform: 'unknown' }),
    ).toThrow()
  })

  it('rejects a malformed createdAt', () => {
    expect(() =>
      CapsuleManifestSchema.parse({ ...validManifest(), createdAt: '2024-01-01' }),
    ).toThrow()
  })

  it('rejects a malformed updatedAt', () => {
    expect(() =>
      CapsuleManifestSchema.parse({ ...validManifest(), updatedAt: 'yesterday' }),
    ).toThrow()
  })

  it('accepts root capsule with empty parentIds', () => {
    expect(CapsuleManifestSchema.parse({ ...validManifest(), parentIds: [] })).toBeTruthy()
  })

  it('accepts a capsule with two parents (merge commit)', () => {
    const m = { ...validManifest(), parentIds: ['aaa', 'bbb'] }
    expect(CapsuleManifestSchema.parse(m)).toEqual(m)
  })

  it('round-trips through JSON without data loss', () => {
    const parsed = CapsuleManifestSchema.parse(validManifest())
    expect(CapsuleManifestSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed)
  })
})

// ─── CapsuleBody ─────────────────────────────────────────────────────────────

describe('CapsuleBodySchema', () => {
  it('accepts a body where full text has been evicted', () => {
    const body = { capsuleId: 'abc', chunks: [] }
    expect(CapsuleBodySchema.parse(body)).toEqual(body)
  })

  it('accepts a body with full verbatim text', () => {
    const body = { capsuleId: 'abc', full: 'whole conversation', chunks: [] }
    expect(CapsuleBodySchema.parse(body)).toEqual(body)
  })

  it('accepts a body with populated chunks', () => {
    const body = {
      capsuleId: 'abc',
      chunks: [{ id: '1', text: 'hello', startChar: 0, endChar: 5 }],
    }
    expect(CapsuleBodySchema.parse(body)).toEqual(body)
  })
})

// ─── Capsule (manifest + body) ────────────────────────────────────────────────

describe('CapsuleSchema', () => {
  it('accepts a valid capsule', () => {
    const capsule = {
      manifest: validManifest(),
      body: { capsuleId: validManifest().id, chunks: [] },
    }
    expect(CapsuleSchema.parse(capsule)).toEqual(capsule)
  })
})

// ─── ProvenanceMap ────────────────────────────────────────────────────────────

describe('ProvenanceMapSchema', () => {
  it('accepts a valid provenance map', () => {
    const pm = {
      id: 'pm-1',
      turnId: 'turn-42',
      capsuleIds: ['cap-1', 'cap-2'],
      platform: 'chatgpt',
      injectedAt: NOW,
    }
    expect(ProvenanceMapSchema.parse(pm)).toEqual(pm)
  })

  it('rejects an invalid platform', () => {
    expect(() =>
      ProvenanceMapSchema.parse({
        id: 'x',
        turnId: 't',
        capsuleIds: [],
        platform: 'gpt4',
        injectedAt: NOW,
      }),
    ).toThrow()
  })
})

// ─── ConversationTurn ─────────────────────────────────────────────────────────

describe('ConversationTurnSchema', () => {
  it.each(['user', 'assistant', 'system'] as const)('accepts role "%s"', (role) => {
    expect(ConversationTurnSchema.parse({ role, content: 'hi', index: 0 })).toMatchObject({
      role,
    })
  })

  it('rejects an unknown role', () => {
    expect(() =>
      ConversationTurnSchema.parse({ role: 'bot', content: 'hi', index: 0 }),
    ).toThrow()
  })

  it('rejects a negative index', () => {
    expect(() =>
      ConversationTurnSchema.parse({ role: 'user', content: 'hi', index: -1 }),
    ).toThrow()
  })
})

// ─── InjectionResolution ──────────────────────────────────────────────────────

describe('InjectionResolutionSchema', () => {
  it.each(['full', 'compact', 'minimal'] as const)('accepts "%s"', (r) => {
    expect(InjectionResolutionSchema.parse(r)).toBe(r)
  })

  it('rejects an unknown resolution', () => {
    expect(() => InjectionResolutionSchema.parse('medium')).toThrow()
  })
})

// ─── AdapterHealth ────────────────────────────────────────────────────────────

describe('AdapterHealthSchema', () => {
  it('accepts healthy status', () => {
    expect(AdapterHealthSchema.parse({ status: 'healthy' })).toEqual({ status: 'healthy' })
  })

  it('accepts unhealthy with a reason', () => {
    const h = { status: 'unhealthy', reason: 'selector not found' }
    expect(AdapterHealthSchema.parse(h)).toEqual(h)
  })

  it('rejects unhealthy without a reason', () => {
    expect(() => AdapterHealthSchema.parse({ status: 'unhealthy' })).toThrow()
  })

  it('rejects an unknown status', () => {
    expect(() => AdapterHealthSchema.parse({ status: 'degraded' })).toThrow()
  })
})

// ─── ExtensionMessage ─────────────────────────────────────────────────────────

describe('ExtensionMessageSchema', () => {
  const cases: Array<[string, unknown]> = [
    ['CAPTURE_REQUEST', { type: 'CAPTURE_REQUEST', tabId: 1 }],
    ['CAPTURE_RESPONSE', { type: 'CAPTURE_RESPONSE', capsuleId: 'abc' }],
    ['INJECT_REQUEST', { type: 'INJECT_REQUEST', capsuleId: 'abc', tabId: 2 }],
    ['INJECT_RESPONSE (ok)', { type: 'INJECT_RESPONSE', success: true }],
    ['INJECT_RESPONSE (error)', { type: 'INJECT_RESPONSE', success: false, error: 'nope' }],
    ['ADAPTER_HEALTH_REQUEST', { type: 'ADAPTER_HEALTH_REQUEST', tabId: 3 }],
    [
      'ADAPTER_HEALTH_RESPONSE (healthy)',
      { type: 'ADAPTER_HEALTH_RESPONSE', status: 'healthy' },
    ],
    [
      'ADAPTER_HEALTH_RESPONSE (unhealthy)',
      { type: 'ADAPTER_HEALTH_RESPONSE', status: 'unhealthy', reason: 'DOM changed' },
    ],
    ['EMBED_REQUEST', { type: 'EMBED_REQUEST', texts: ['hello', 'world'] }],
    ['EMBED_RESPONSE', { type: 'EMBED_RESPONSE', embeddings: [[0.1, 0.2], [0.3, 0.4]] }],
    ['SEARCH_REQUEST', { type: 'SEARCH_REQUEST', query: 'goals', limit: 5 }],
    ['SEARCH_RESPONSE', { type: 'SEARCH_RESPONSE', capsuleIds: ['c1'] }],
    // Phase 3 messages
    ['LIST_CAPSULES_REQUEST', { type: 'LIST_CAPSULES_REQUEST', limit: 20 }],
    // Phase 4 messages
    ['INJECT_REQUEST (from content script, no tabId)', { type: 'INJECT_REQUEST', capsuleId: 'abc', windowWidth: 1440 }],
    ['INJECT_REQUEST (from popup, with tabId)', { type: 'INJECT_REQUEST', capsuleId: 'abc', tabId: 5, windowWidth: 800 }],
    [
      'INJECT_COMMAND',
      {
        type: 'INJECT_COMMAND',
        manifest: {
          id: '0'.repeat(64),
          title: 'Test',
          summary: 'S',
          goals: [],
          constraints: [],
          decisions: [],
          openQuestions: [],
          platform: 'claude',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          turnCount: 1,
          tokenEstimate: 100,
          tags: [],
          parentIds: [],
          compressed: true,
        },
        resolution: 'full',
      },
    ],
    [
      'LIST_CAPSULES_RESPONSE',
      { type: 'LIST_CAPSULES_RESPONSE', manifests: [] },
    ],
    ['EXTRACT_TURNS_REQUEST', { type: 'EXTRACT_TURNS_REQUEST' }],
    // Phase 5 messages
    ['GET_CAPSULE_GRAPH_REQUEST', { type: 'GET_CAPSULE_GRAPH_REQUEST', capsuleId: 'abc' }],
    ['GET_CAPSULE_GRAPH_RESPONSE', { type: 'GET_CAPSULE_GRAPH_RESPONSE', manifests: [] }],
    ['ROLLBACK_REQUEST', { type: 'ROLLBACK_REQUEST', capsuleId: 'abc' }],
    ['ROLLBACK_RESPONSE (ok)', { type: 'ROLLBACK_RESPONSE', success: true }],
    ['BRANCH_CREATE_REQUEST', { type: 'BRANCH_CREATE_REQUEST', name: 'feature', tipId: 'abc' }],
    ['BRANCH_CREATE_RESPONSE', { type: 'BRANCH_CREATE_RESPONSE', branch: { name: 'feature', tipId: 'abc' } }],
    ['BRANCH_LIST_REQUEST', { type: 'BRANCH_LIST_REQUEST' }],
    ['BRANCH_LIST_RESPONSE', { type: 'BRANCH_LIST_RESPONSE', branches: [{ name: 'main', tipId: 'abc' }] }],
    [
      'EXTRACT_TURNS_RESPONSE (healthy)',
      {
        type: 'EXTRACT_TURNS_RESPONSE',
        turns: [{ role: 'user', content: 'hello', index: 0 }],
        health: { status: 'healthy' },
      },
    ],
    [
      'EXTRACT_TURNS_RESPONSE (unhealthy)',
      {
        type: 'EXTRACT_TURNS_RESPONSE',
        turns: [],
        health: { status: 'unhealthy', reason: 'selector missing' },
      },
    ],
  ]

  it.each(cases)('parses %s', (_label, msg) => {
    expect(ExtensionMessageSchema.parse(msg)).toEqual(msg)
  })

  it('rejects an unknown message type', () => {
    expect(() => ExtensionMessageSchema.parse({ type: 'UNKNOWN_MSG' })).toThrow()
  })
})
