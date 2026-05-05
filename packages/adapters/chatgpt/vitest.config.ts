import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { name: 'adapter-chatgpt', include: ['src/**/*.test.ts'], environment: 'jsdom' } })
