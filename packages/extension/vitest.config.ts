import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'extension',
    include: ['src/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['./src/storage/__tests__/setup.ts'],
  },
})
