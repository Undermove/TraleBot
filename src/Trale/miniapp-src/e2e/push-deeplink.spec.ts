import { test, expect } from '@playwright/test'

// Mock responses shared across tests
const catalog = {
  botUsername: 'TraleBot',
  miniAppEnabled: true,
  modules: [
    {
      id: 'alphabet-progressive',
      title: 'Алфавит',
      emoji: '🔤',
      description: 'Грузинский алфавит',
      lessons: [
        { id: 1, title: 'Урок 1', short: 'L1', theory: { title: 'Ანბანი', goal: 'Учим буквы', blocks: [] } },
        { id: 2, title: 'Урок 2', short: 'L2', theory: { title: 'Ანბანი 2', goal: 'Ещё буквы', blocks: [] } },
        { id: 3, title: 'Урок 3', short: 'L3', theory: { title: 'Ანბანი 3', goal: 'И ещё', blocks: [] } },
      ],
    },
    {
      id: 'numbers',
      title: 'Числа',
      emoji: '🔢',
      description: 'Числа',
      lessons: [
        { id: 1, title: 'Урок 1', short: 'L1', theory: { title: 'Числа', goal: 'Числа', blocks: [] } },
      ],
    },
  ],
}

const meWithProgress = {
  authenticated: true,
  level: 'beginner',
  vocabularyCount: 0,
  isPro: false,
  isTrialActive: false,
  trialDaysLeft: 0,
  shouldShowReferralExtensionCta: false,
  isOwner: false,
  progress: {
    xp: 100,
    streak: 2,
    lastPlayedAtUtc: null,
    completedLessons: { 'alphabet-progressive': [1, 2] },
    xpSpent: 0,
    totalTreatsGiven: 0,
    lastFedAtUtc: null,
    lastTreatIndex: null,
  },
}

async function setupApiMocks(page: any, trackFn?: (body: any) => void) {
  await page.route('**/api/miniapp/content', (r: any) => r.fulfill({ json: catalog }))
  await page.route('**/api/miniapp/me', (r: any) => r.fulfill({ json: meWithProgress }))
  await page.route('**/api/miniapp/activity-days*', (r: any) => r.fulfill({ json: { dates: [] } }))
  await page.route('**/api/miniapp/track', async (r: any) => {
    if (trackFn) {
      const body = await r.request().postDataJSON().catch(() => null)
      trackFn(body)
    }
    await r.fulfill({ json: { ok: true } })
  })
}

test.beforeEach(async ({ page }) => {
  // Simulate Telegram WebApp context so isInsideTelegram() returns true
  await page.addInitScript(() => {
    ;(window as any).Telegram = {
      WebApp: {
        initData: 'user=%7B%22id%22%3A99999%7D',
        BackButton: {
          show: () => {},
          hide: () => {},
          onClick: (fn: () => void) => { (window as any).__backButtonHandler = fn },
          offClick: () => {},
        },
        MainButton: { show: () => {}, hide: () => {} },
        HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {} },
        openTelegramLink: () => {},
      },
    }
    try { localStorage.removeItem('bombora_collapsed') } catch {}
  })
})

test('opens correct lesson screen when valid moduleId+lessonId params present', async ({ page }) => {
  await setupApiMocks(page)
  await page.goto('/?moduleId=alphabet-progressive&lessonId=3')

  // Should show lesson screen directly, not dashboard
  await expect(page.getByTestId('lesson-screen')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('dashboard')).not.toBeVisible()
})

test('tracks push_clicked event with moduleId and lessonId on deep-link open', async ({ page }) => {
  const trackCalls: any[] = []
  await setupApiMocks(page, (body) => trackCalls.push(body))

  await page.goto('/?moduleId=alphabet-progressive&lessonId=3')
  await expect(page.getByTestId('lesson-screen')).toBeVisible({ timeout: 10_000 })

  // Wait briefly for the track call to complete
  await page.waitForTimeout(500)

  expect(trackCalls.length).toBeGreaterThan(0)
  const pushEvent = trackCalls.find((c) => c?.event === 'push_clicked')
  expect(pushEvent).toBeDefined()
  expect(pushEvent.moduleId).toBe('alphabet-progressive')
  expect(pushEvent.lessonId).toBe('3')
})

test('falls back to Dashboard on unknown moduleId', async ({ page }) => {
  await setupApiMocks(page)

  const consoleErrors: string[] = []
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.goto('/?moduleId=nonexistent&lessonId=99')

  await expect(page.getByTestId('dashboard')).toBeVisible({ timeout: 10_000 })
  // No unhandled JS errors
  expect(consoleErrors.filter((e) => !e.includes('ResizeObserver'))).toHaveLength(0)
})

test('back button returns to Dashboard from deep-linked lesson', async ({ page }) => {
  await setupApiMocks(page)
  await page.goto('/?moduleId=alphabet-progressive&lessonId=3')
  await expect(page.getByTestId('lesson-screen')).toBeVisible({ timeout: 10_000 })

  // Trigger the Telegram WebApp back button
  await page.evaluate(() => {
    const handler = (window as any).__backButtonHandler
    if (handler) handler()
  })

  await expect(page.getByTestId('dashboard')).toBeVisible({ timeout: 5_000 })
})

test('falls back to Dashboard when only moduleId is present', async ({ page }) => {
  await setupApiMocks(page)
  await page.goto('/?moduleId=alphabet-progressive')
  await expect(page.getByTestId('dashboard')).toBeVisible({ timeout: 10_000 })
})
