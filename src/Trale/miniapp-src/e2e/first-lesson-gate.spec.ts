import { test, expect } from '@playwright/test'

// Verifies the "hide the hub until the first XP" gate end-to-end:
// a fresh user (level chosen, 0 XP) is dropped straight into the first lesson
// instead of the full module grid, while a returning user who already earned
// XP lands on the dashboard as before. This is the funnel fix for the ~50% of
// mini-app openers who bounced from the hub without doing anything (prod, 2026-06).

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
    // Suppress the one-time alphabet "reveal" overlay so it can't cover the action bar.
    try { localStorage.setItem('bombora_kani_reveal_shown', '1') } catch {}
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
      lessons: [
        {
          id: 1,
          title: 'Первые буквы',
          short: 'L1',
          theory: { title: 'Первые буквы', goal: 'Запомнить первые буквы алфавита', blocks: [] },
        },
        {
          id: 2,
          title: 'Ещё буквы',
          short: 'L2',
          theory: { title: 'Ещё буквы', goal: 'g', blocks: [] },
        },
      ],
    },
    {
      id: 'intro',
      title: 'Знакомство',
      emoji: '👋',
      description: 'Первые фразы',
      lessons: [
        { id: 1, title: 'Привет', short: 'I1', theory: { title: 'Привет', goal: 'g', blocks: [] } },
      ],
    },
  ],
}

const freshMe = {
  authenticated: true,
  level: 'beginner',
  isPro: false,
  isTrialActive: false,
  trialDaysLeft: 0,
  vocabularyCount: 0,
  progress: {
    xp: 0,
    streak: 0,
    lastPlayedAtUtc: null,
    completedLessons: {},
    xpSpent: 0,
    totalTreatsGiven: 0,
    lastFedAtUtc: null,
    lastTreatIndex: null,
  },
}

const returningMe = {
  ...freshMe,
  progress: { ...freshMe.progress, xp: 200, completedLessons: { 'alphabet-progressive': [1, 2] } },
}

async function setupApi(page: any, me: typeof freshMe) {
  await page.route('**/api/miniapp/content', (route: any) => route.fulfill({ json: catalog }))
  await page.route('**/api/miniapp/me', (route: any) => route.fulfill({ json: me }))
  await page.route('**/api/miniapp/activity-days*', (route: any) =>
    route.fulfill({ json: { dates: [] } })
  )
}

test('fresh user (0 XP) lands on the welcome lesson, not the hub', async ({ page }) => {
  await setupApi(page, freshMe)
  await page.goto('/?playwright=1')

  // The one-letter welcome lesson is shown...
  await expect(page.getByTestId('welcome-screen')).toBeVisible()
  await expect(page.getByRole('button', { name: /дальше/i })).toBeVisible()

  // ...and the dashboard hub (module grid) is NOT rendered.
  await expect(page.getByTestId('module-tile-alphabet-progressive')).toHaveCount(0)
  await expect(page.getByTestId('module-tile-intro')).toHaveCount(0)
})

test('completing the welcome lesson reveals the dashboard hub', async ({ page }) => {
  await setupApi(page, freshMe)
  // The welcome lesson records its completion via lesson-complete; return XP so the
  // app flips the gate to the dashboard, mirroring the real backend response.
  await page.route('**/api/miniapp/progress/lesson-complete', (route: any) =>
    route.fulfill({
      json: {
        xpEarned: 15,
        progress: { ...freshMe.progress, xp: 15, completedLessons: { welcome: [1] } },
      },
    })
  )
  await page.goto('/?playwright=1')

  await page.getByRole('button', { name: /дальше/i }).click()
  await page.getByTestId('welcome-listen-а').click()
  await page.getByTestId('welcome-name-ани').click()
  await page.getByRole('button', { name: /открыть приложение/i }).click()

  await expect(page.getByTestId('module-tile-alphabet-progressive')).toBeVisible()
})

test('returning user with XP lands on the dashboard hub', async ({ page }) => {
  await setupApi(page, returningMe)
  await page.goto('/?playwright=1')

  // The module grid is shown...
  await expect(page.getByTestId('module-tile-alphabet-progressive')).toBeVisible()
  await expect(page.getByTestId('module-tile-intro')).toBeVisible()

  // ...and we did NOT get the welcome lesson.
  await expect(page.getByTestId('welcome-screen')).toHaveCount(0)
})
