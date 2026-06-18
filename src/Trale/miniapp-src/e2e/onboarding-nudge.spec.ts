import { test, expect } from '@playwright/test'

// The dashboard surfaces the backend-chosen contextual onboarding nudge, and acting on it
// navigates to the right place. me() decides which hint (if any) is active.

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

test('dashboard shows the active onboarding nudge and acting on it opens the lesson', async ({ page }) => {
  let hintSeen = false
  await setupApi(page, meWithHint)
  await page.route('**/api/miniapp/onboarding/hint-seen', (route: any) => {
    hintSeen = true
    route.fulfill({ json: { ok: true } })
  })

  await page.goto('/?playwright=1')

  // The nudge for the active hint is shown...
  const nudge = page.getByTestId('onboarding-nudge-first_lesson')
  await expect(nudge).toBeVisible()

  // ...and the app reported it shown (so the backend won't repeat it).
  await expect.poll(() => hintSeen).toBe(true)

  // Acting on it opens the first lesson.
  await page.getByTestId('onboarding-nudge-cta').click()
  await expect(page.getByRole('button', { name: 'к практике →' })).toBeVisible()
})

test('no nudge is shown when me() returns no hint', async ({ page }) => {
  await setupApi(page, { ...meWithHint, onboardingHint: null as any })
  await page.goto('/?playwright=1')

  await expect(page.getByTestId('module-tile-alphabet-progressive')).toBeVisible()
  await expect(page.getByTestId('onboarding-nudge-first_lesson')).toHaveCount(0)
})
