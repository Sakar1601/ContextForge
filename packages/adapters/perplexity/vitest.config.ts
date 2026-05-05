import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { name: 'adapter-perplexity', include: ['src/**/*.test.ts'], environment: 'jsdom' } })
