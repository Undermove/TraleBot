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

test('the first-lesson spotlight appears right after the welcome lesson — no reload needed', async ({ page }) => {
  // me() #1 (on load): a fresh user with a level but no XP and no welcome yet → welcome screen,
  // and no hint (the gate needs welcome done). me() #2+ (after welcome): hint unlocked.
  const meFresh = {
    authenticated: true,
    level: 'beginner',
    vocabularyCount: 0,
    onboardingHint: null,
    progress: { xp: 0, streak: 0, lastPlayedAtUtc: null, completedLessons: {}, xpSpent: 0, totalTreatsGiven: 0, lastFedAtUtc: null, lastTreatIndex: null },
  }
  const meAfterWelcome = {
    ...meFresh,
    onboardingHint: 'first_lesson',
    progress: { ...meFresh.progress, xp: 20, completedLessons: { welcome: [1] } },
  }

  let meCalls = 0
  await page.route('**/api/miniapp/content', (route: any) => route.fulfill({ json: catalog }))
  await page.route('**/api/miniapp/activity-days*', (route: any) => route.fulfill({ json: { dates: [] } }))
  await page.route('**/api/miniapp/me', (route: any) => {
    meCalls += 1
    route.fulfill({ json: meCalls === 1 ? meFresh : meAfterWelcome })
  })
  await page.route('**/api/miniapp/progress/lesson-complete', (route: any) =>
    route.fulfill({ json: { xpEarned: 15, progress: meAfterWelcome.progress } })
  )
  await page.route('**/api/miniapp/onboarding/hint-seen', (route: any) => route.fulfill({ json: { ok: true } }))

  await page.goto('/?playwright=1')

  // Walk the welcome mini-lesson.
  await page.getByRole('button', { name: /дальше/i }).click()
  await page.getByTestId('welcome-listen-а').click()
  await page.getByTestId('welcome-name-ани').click()
  await page.getByRole('button', { name: /открыть приложение/i }).click()

  // Spotlight is there immediately on the dashboard — without any reload.
  await expect(page.getByTestId('onboarding-spotlight-first_lesson')).toBeVisible()
})
