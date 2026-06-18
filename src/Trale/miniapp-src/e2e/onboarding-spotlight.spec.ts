import { test, expect } from '@playwright/test'

// The dashboard surfaces the backend-chosen onboarding hint as a spotlight over the REAL
// element to tap (so the user learns the actual gesture). me() decides which hint is active.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as any).Telegram = {
      WebApp: {
        initData: 'user=%7B%22id%22%3A123456%7D',
        BackButton: { show: () => {}, hide: () => {}, onClick: () => {}, offClick: () => {} },
        MainButton: { show: () => {}, hide: () => {} },
        HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {} },
        openTelegramLink: () => {},
      },
    }
  })
})

const catalog = {
  botUsername: 'TraleBot',
  miniAppEnabled: true,
  modules: [
    {
      id: 'alphabet-progressive',
      title: 'Алфавит',
      emoji: '🔤',
      description: 'Грузинский алфавит',
      lessons: [{ id: 1, title: 'Первый урок', short: 'L1', theory: { title: 'Первый урок', goal: 'g', blocks: [] } }],
    },
  ],
}

const meWithHint = {
  authenticated: true,
  level: 'beginner',
  isPro: false,
  isTrialActive: false,
  vocabularyCount: 0,
  onboardingHint: 'first_lesson',
  progress: {
    xp: 20, // past the welcome gate → lands on the dashboard
    streak: 1,
    lastPlayedAtUtc: null,
    completedLessons: { welcome: [1] },
    xpSpent: 0,
    totalTreatsGiven: 0,
    lastFedAtUtc: null,
    lastTreatIndex: null,
  },
}

async function setupApi(page: any, me: typeof meWithHint) {
  await page.route('**/api/miniapp/content', (route: any) => route.fulfill({ json: catalog }))
  await page.route('**/api/miniapp/me', (route: any) => route.fulfill({ json: me }))
  await page.route('**/api/miniapp/activity-days*', (route: any) => route.fulfill({ json: { dates: [] } }))
}

test('spotlight highlights the real element; tapping it (not a CTA) opens the lesson', async ({ page }) => {
  let hintSeen = false
  await setupApi(page, meWithHint)
  await page.route('**/api/miniapp/onboarding/hint-seen', (route: any) => {
    hintSeen = true
    route.fulfill({ json: { ok: true } })
  })

  await page.goto('/?playwright=1')

  // The spotlight overlay for the active hint is shown...
  await expect(page.getByTestId('onboarding-spotlight-first_lesson')).toBeVisible()
  // ...and the app reported it shown.
  await expect.poll(() => hintSeen).toBe(true)

  // There is no separate CTA — the user taps the REAL highlighted element.
  await page.getByTestId('dashboard-suggestion').click()
  await expect(page.getByRole('button', { name: 'к практике →' })).toBeVisible()
})

test('no spotlight is shown when me() returns no hint', async ({ page }) => {
  await setupApi(page, { ...meWithHint, onboardingHint: null as any })
  await page.goto('/?playwright=1')

  await expect(page.getByTestId('module-tile-alphabet-progressive')).toBeVisible()
  await expect(page.getByTestId('onboarding-spotlight-first_lesson')).toHaveCount(0)
})
