import { defineConfig } from 'vitest/config'

// Vitest 4 replaced workspace files with `test.projects`. Each package keeps its own config (environment, include).
export default defineConfig({
  test: {
    projects: [
      'packages/shared/vitest.config.ts',
      'packages/compression/vitest.config.ts',
      'packages/retrieval/vitest.config.ts',
      'packages/extension/vitest.config.ts',
      'packages/adapters/claude/vitest.config.ts',
      'packages/adapters/chatgpt/vitest.config.ts',
      'packages/adapters/gemini/vitest.config.ts',
      'packages/adapters/perplexity/vitest.config.ts',
      'packages/adapters/deepseek/vitest.config.ts',
      'packages/adapters/gmail/vitest.config.ts',
    ],
  },
})
