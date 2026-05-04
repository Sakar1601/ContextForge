import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'packages/shared/vitest.config.ts',
  'packages/compression/vitest.config.ts',
  'packages/extension/vitest.config.ts',
])
