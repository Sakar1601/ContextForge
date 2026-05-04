import type { ConversationTurn } from '@contextforge/shared'

export const SYSTEM_PROMPT = `You are an AI conversation analyst. Given a conversation between a user and \
an AI assistant, extract the following structured information and output it \
using the exact XML tags shown below.

Rules:
- title: One concise sentence describing what this conversation is about (max 60 characters).
- summary: A neutral, third-person abstract of the conversation in ≤150 words.
- goals: 1–5 bullet points capturing what the user was trying to accomplish. Each <goal> is one sentence.
- constraints: Rules, preferences, or restrictions the user stated or implied. Omit if none.
- decisions: Conclusions, choices, or agreements reached. Omit if none.
- openQuestions: Questions raised but not resolved. Omit if none.

Output format (use these exact tags, no other text outside the tags):

<title>…</title>
<summary>…</summary>
<goals>
  <goal>…</goal>
</goals>
<constraints>
  <constraint>…</constraint>
</constraints>
<decisions>
  <decision>…</decision>
</decisions>
<openQuestions>
  <question>…</question>
</openQuestions>`

export function buildUserMessage(turns: ConversationTurn[], platform: string): string {
  const formatted = turns
    .map((t) => `[${t.role.toUpperCase()}]\n${t.content}`)
    .join('\n\n')
  return `Conversation to analyse (${turns.length} turns, platform: ${platform}):\n\n${formatted}`
}
