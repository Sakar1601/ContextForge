import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ConversationTurn } from '@contextforge/shared'

// ─── mock Anthropic SDK ──────────────────────────────────────────────────────

vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn()
  return {
    default: vi.fn().mockImplementation(() => ({
      beta: { messages: { create: mockCreate } },
    })),
    __mockCreate: mockCreate,
  }
})

async function getMockCreate() {
  const mod = await import('@anthropic-ai/sdk')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock introspection
  return (mod as any).__mockCreate as ReturnType<typeof vi.fn>
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const TURNS: ConversationTurn[] = [
  { role: 'user', content: 'How do I set up a pnpm workspace?', index: 0 },
  {
    role: 'assistant',
    content: 'Create a pnpm-workspace.yaml listing your package globs.',
    index: 1,
  },
]

function makeApiResponse(xml: string) {
  return { content: [{ type: 'text', text: xml }] }
}

const VALID_XML = `
<title>pnpm workspace setup</title>
<summary>User asked how to configure a pnpm workspace. Assistant explained creating pnpm-workspace.yaml.</summary>
<goals>
  <goal>Set up a pnpm monorepo workspace</goal>
</goals>
<constraints>
</constraints>
<decisions>
  <decision>Use pnpm-workspace.yaml with package globs</decision>
</decisions>
<openQuestions>
</openQuestions>
`

// ─── tests ────────────────────────────────────────────────────────────────────

describe('compress', () => {
  let mockCreate: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    mockCreate = await getMockCreate()
    mockCreate.mockReset()
  })

  it('returns raw mode immediately when apiKey is empty', async () => {
    const { compress } = await import('../compress')
    const result = await compress(TURNS, '', 'claude')
    expect(result.compressed).toBe(false)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('returns raw mode when the API throws', async () => {
    mockCreate.mockRejectedValueOnce(new Error('network error'))
    const { compress } = await import('../compress')
    const result = await compress(TURNS, 'sk-test', 'claude')
    expect(result.compressed).toBe(false)
  })

  it('returns raw mode after two consecutive schema mismatches', async () => {
    mockCreate.mockResolvedValue(makeApiResponse('<title>only title</title>'))
    const { compress } = await import('../compress')
    const result = await compress(TURNS, 'sk-test', 'claude')
    expect(result.compressed).toBe(false)
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })

  it('returns extracted fields on a valid API response', async () => {
    mockCreate.mockResolvedValueOnce(makeApiResponse(VALID_XML))
    const { compress } = await import('../compress')
    const result = await compress(TURNS, 'sk-test', 'claude')
    expect(result.compressed).toBe(true)
    if (result.compressed) {
      expect(result.fields.title).toBe('pnpm workspace setup')
      expect(result.fields.goals).toContain('Set up a pnpm monorepo workspace')
      expect(result.fields.decisions).toContain('Use pnpm-workspace.yaml with package globs')
      expect(result.fields.platform).toBe('claude')
      expect(result.fields.turnCount).toBe(2)
    }
  })

  it('succeeds on retry after an initial schema mismatch', async () => {
    mockCreate
      .mockResolvedValueOnce(makeApiResponse('<title>only title</title>'))
      .mockResolvedValueOnce(makeApiResponse(VALID_XML))
    const { compress } = await import('../compress')
    const result = await compress(TURNS, 'sk-test', 'claude')
    expect(result.compressed).toBe(true)
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })

  it('includes cache_control on the system message', async () => {
    mockCreate.mockResolvedValueOnce(makeApiResponse(VALID_XML))
    const { compress } = await import('../compress')
    await compress(TURNS, 'sk-test', 'claude')
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- mock.calls is typed any
    const callArgs = mockCreate.mock.calls[0]?.[0]
    expect(callArgs.system[0].cache_control).toEqual({ type: 'ephemeral' })
  })

  it('uses claude-haiku-4-5 model', async () => {
    mockCreate.mockResolvedValueOnce(makeApiResponse(VALID_XML))
    const { compress } = await import('../compress')
    await compress(TURNS, 'sk-test', 'claude')
    expect(mockCreate.mock.calls[0]?.[0].model).toBe('claude-haiku-4-5-20251001')
  })
})
