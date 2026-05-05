import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { name: 'adapter-deepseek', include: ['src/**/*.test.ts'], environment: 'jsdom' } })
