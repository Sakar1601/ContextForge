import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { name: 'adapter-gemini', include: ['src/**/*.test.ts'], environment: 'jsdom' } })
