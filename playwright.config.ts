import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'

const extensionPath = path.resolve(import.meta.dirname, 'packages/extension/dist')

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    headless: false,
  },
  projects: [
    {
      name: 'chromium-extension',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        launchOptions: {
          args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
          ],
        },
      },
    },
  ],
})
