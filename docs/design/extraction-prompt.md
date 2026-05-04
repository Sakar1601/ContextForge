# Extraction Prompt Design

## Purpose
The extraction prompt instructs Claude to distil a raw conversation into the
structured fields of a `CapsuleManifest`. This document is the single source
of truth for prompt content so it can be iterated without touching code.

## Model
`claude-haiku-4-5-20251001` — fast and cheap; extraction is a simple
classification task, not a reasoning task.

## Prompt caching
The system prompt is marked with `cache_control: { type: 'ephemeral' }`.
It never changes between calls, so every call after the first is a cache hit,
cutting input-token cost by ~90% for the system block.

---

## System prompt

```
You are an AI conversation analyst. Given a conversation between a user and
an AI assistant, extract the following structured information and output it
using the exact XML tags shown below.

Rules:
- title: One concise sentence describing what this conversation is about
  (max 60 characters).
- summary: A neutral, third-person abstract of the conversation in ≤150 words.
- goals: 1–5 bullet points capturing what the user was trying to accomplish.
  Each <goal> is one sentence.
- constraints: Rules, preferences, or restrictions the user stated or implied.
  Omit if none. Each <constraint> is one sentence.
- decisions: Conclusions, choices, or agreements reached during the
  conversation. Omit if none. Each <decision> is one sentence.
- openQuestions: Questions or topics raised but not resolved by the end of the
  conversation. Omit if none. Each <question> is one sentence.

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
</openQuestions>
```

---

## User message format

```
Conversation to analyse (${turnCount} turns, platform: ${platform}):

${turns.map(t => `[${t.role.toUpperCase()}]\n${t.content}`).join('\n\n')}
```

Turns are truncated to fit the context window (keep most-recent turns first,
retain any system prompt).

---

## Response parsing

Tags are extracted with a simple regex per field:
```
/<tagName>([\s\S]*?)<\/tagName>/
```
List items (`<goal>`, `<constraint>`, etc.) are extracted with:
```
/<itemTag>([\s\S]*?)<\/itemTag>/g
```
Text is trimmed. Empty lists default to `[]`.

The parsed result is validated against `ExtractionResultSchema` (Zod).
On mismatch: retry once with the same prompt. On second failure: caller
falls back to raw-capture mode.

---

## Failure modes

| Condition | Behaviour |
|---|---|
| API key absent or invalid | `compress()` returns `{ compressed: false }` immediately |
| Network error | Returns `{ compressed: false }` immediately |
| Schema mismatch on first parse | Retry once |
| Schema mismatch on retry | Returns `{ compressed: false }` |
| Response too slow (>30 s) | Anthropic SDK timeout; returns `{ compressed: false }` |
