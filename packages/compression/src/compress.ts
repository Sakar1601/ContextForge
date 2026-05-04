import Anthropic from '@anthropic-ai/sdk'
import type { BetaTextBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import type { CapsuleManifest, ConversationTurn, Platform } from '@contextforge/shared'
import { ExtractionResultSchema } from './schema'
import { SYSTEM_PROMPT, buildUserMessage } from './prompt'

const MODEL = 'claude-haiku-4-5-20251001'

export type CompressResult =
  | {
      compressed: true
      fields: Omit<CapsuleManifest, 'id' | 'createdAt' | 'updatedAt' | 'parentIds' | 'compressed'>
    }
  | { compressed: false; rawTurns: ConversationTurn[] }

function extractTag(xml: string, tag: string): string {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`).exec(xml)
  return m?.[1]?.trim() ?? ''
}

function extractListTag(xml: string, tag: string): string[] {
  const results: string[] = []
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const text = m[1]?.trim()
    if (text) results.push(text)
  }
  return results
}

function parseXml(text: string) {
  return ExtractionResultSchema.parse({
    title: extractTag(text, 'title'),
    summary: extractTag(text, 'summary'),
    goals: extractListTag(text, 'goal'),
    constraints: extractListTag(text, 'constraint'),
    decisions: extractListTag(text, 'decision'),
    openQuestions: extractListTag(text, 'question'),
  })
}

const SYSTEM_BLOCK: BetaTextBlockParam = {
  type: 'text',
  text: SYSTEM_PROMPT,
  cache_control: { type: 'ephemeral' },
}

async function callApi(
  client: Anthropic,
  turns: ConversationTurn[],
  platform: Platform,
): Promise<string> {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: [SYSTEM_BLOCK],
    messages: [{ role: 'user', content: buildUserMessage(turns, platform) }],
    betas: ['prompt-caching-2024-07-31'],
  })
  const block = response.content[0]
  if (block?.type !== 'text') throw new Error('Unexpected response block type')
  return block.text
}

export async function compress(
  turns: ConversationTurn[],
  apiKey: string,
  platform: Platform,
): Promise<CompressResult> {
  if (!apiKey) return { compressed: false, rawTurns: turns }

  const client = new Anthropic({ apiKey })

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await callApi(client, turns, platform)
      const extracted = parseXml(text)
      return {
        compressed: true,
        fields: {
          title: extracted.title,
          summary: extracted.summary,
          goals: extracted.goals,
          constraints: extracted.constraints,
          decisions: extracted.decisions,
          openQuestions: extracted.openQuestions,
          platform,
          turnCount: turns.length,
          tokenEstimate: turns.reduce((n, t) => n + Math.ceil(t.content.length / 4), 0),
          tags: [],
        },
      }
    } catch {
      if (attempt === 1) return { compressed: false, rawTurns: turns }
    }
  }

  return { compressed: false, rawTurns: turns }
}
