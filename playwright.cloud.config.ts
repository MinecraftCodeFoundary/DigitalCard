import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e-cloud', timeout: 45000, expect: { timeout: 15000 }, workers: 1,
  reporter: 'list', outputDir: 'artifacts/cloud-test-results',
  use: { baseURL: 'http://localhost:9200', channel: 'msedge', headless: true, viewport: { width: 390, height: 844 }, screenshot: 'only-on-failure' },
  webServer: [
    { command: 'node tests/e2e-cloud/server.mjs', url: 'http://127.0.0.1:3200/api/health', reuseExistingServer: false, timeout: 30000 },
    { command: 'npm run dev:web', url: 'http://localhost:9200', reuseExistingServer: false, timeout: 90000,
      env: { VITE_APP_PORT: '9200', VITE_SERVER_BASEURL: 'http://127.0.0.1:3200/api', VITE_LOGIN_MODE: 'wechat', VITE_BACKEND_MODE: 'cloud' } },
  ],
})
