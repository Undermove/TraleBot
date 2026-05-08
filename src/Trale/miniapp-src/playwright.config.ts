import { defineConfig } from '@playwright/test'

// Mini-app E2E config. The mini-app is a static SPA served by `vite preview`
// (port 4173). Tests mock the /api/* surface with page.route(), so they don't
// need the .NET backend or Postgres up. That's intentional: this layer
// verifies the front-end behaviour end-to-end as the user sees it.
//
// Backend integration is covered separately by the C# IntegrationTests
// suite (Testcontainers + Postgres). Cross-stack E2E may come later.
//
// Viewport mirrors a Telegram WebApp on iPhone 12 (~390px). The mini-app
// is designed for 375px-class viewports per the design specs.

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 4173)
const BASE_URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      // Telegram WebApp viewport on iPhone 12 (~390px). Chromium engine,
      // not WebKit — the browser bundled with bombora-agents image is chromium
      // only, so all our specs run there for consistency.
      name: 'chromium-mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: BASE_URL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
