import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { name: 'adapter-gmail', include: ['src/**/*.test.ts'], environment: 'jsdom' } })
