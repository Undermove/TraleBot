import { defineConfig } from '@playwright/test'

// Настоящий сквозной прогон: мини-апп, который отдаёт сам сервер, против настоящего API и базы.
// Запускается только скриптом scripts/dev/run-real-e2e.sh (он поднимает сервер и базу и гасит их);
// в `npm run test:e2e` и в CI не входит — там по-прежнему набор с подменённым API (e2e/).

export default defineConfig({
  testDir: '.',
  timeout: 240_000,
  expect: { timeout: 10_000 },
  // У каждого теста свой пользователь, так что тесты друг другу не мешают.
  fullyParallel: true,
  workers: 3,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:1411',
    browserName: 'chromium',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  }
})
