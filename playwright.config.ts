import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45000,
  expect: { timeout: 15000 },
  workers: 1,
  reporter: 'list',
  outputDir: 'artifacts/test-results',
  use: {
    baseURL: 'http://localhost:9100',
    channel: 'msedge',
    headless: true,
    viewport: { width: 390, height: 844 },
    screenshot: 'only-on-failure',
  },
  webServer: [
    { command: 'node tests/e2e/server.mjs', url: 'http://127.0.0.1:3100/api/health', reuseExistingServer: false, timeout: 30000 },
    {
      command: 'npm run dev:web', url: 'http://localhost:9100', reuseExistingServer: false, timeout: 90000,
      env: { VITE_APP_PORT: '9100', VITE_SERVER_BASEURL: 'http://127.0.0.1:3100/api', VITE_LOGIN_MODE: 'demo', VITE_BACKEND_MODE: 'http' },
    },
  ],
})
