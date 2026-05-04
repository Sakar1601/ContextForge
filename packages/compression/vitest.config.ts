import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'compression',
    include: ['src/**/*.test.ts'],
  },
})
