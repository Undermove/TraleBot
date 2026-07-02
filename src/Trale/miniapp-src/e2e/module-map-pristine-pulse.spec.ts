import { test, expect } from '@playwright/test'

// #1003: on ModuleMap, the very first circle of a pristine module (0 completed
// lessons + no per-module "started" flag) pulses and shows a «▶ Начни здесь»
// badge. After the user taps anything in that module, the flag flips and the
// badge is gone — surviving a reload.

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
        { id: 1, title: 'Первые буквы', short: 'L1', theory: { title: 't', goal: 'g', blocks: [] } },
      ],
    },
    {
      id: 'intro',
      title: 'Знакомство',
      emoji: '👋',
      description: 'Первые фразы',
      lessons: [
        { id: 1, title: 'Привет', short: 'L1', theory: { title: 'Привет', goal: 'g', blocks: [] } },
        { id: 2, title: 'Как дела', short: 'L2', theory: { title: 'Как дела', goal: 'g', blocks: [] } },
      ],
    },
  ],
}

// Returning user who has already earned XP (dashboard gate is passed) and has
// completed alphabet L1 — but has NOT touched the "intro" module yet, so it's
// still pristine.
const me = {
  authenticated: true,
  level: 'beginner',
  isPro: true, // intro is a Pro module; Pro flag avoids paywall detours in the deep-link.
  isTrialActive: false,
  trialDaysLeft: 0,
  vocabularyCount: 0,
  onboardingHint: null,
  progress: {
    xp: 100,
    streak: 1,
    lastPlayedAtUtc: null,
    completedLessons: { 'alphabet-progressive': [1] },
    xpSpent: 0,
    totalTreatsGiven: 0,
    lastFedAtUtc: null,
    lastTreatIndex: null,
  },
}

async function setupApi(page: any) {
  await page.route('**/api/miniapp/content', (route: any) => route.fulfill({ json: catalog }))
  await page.route('**/api/miniapp/me', (route: any) => route.fulfill({ json: me }))
  await page.route('**/api/miniapp/activity-days*', (route: any) =>
    route.fulfill({ json: { dates: [] } })
  )
}

test('pristine module — first circle pulses with «▶ Начни здесь»; tapping it clears the badge and reload keeps it cleared', async ({ page }) => {
  await setupApi(page)
  await page.goto('/?playwright=1&moduleId=intro')

  // Badge is visible while the module is pristine.
  await expect(page.getByText(/Начни здесь/)).toBeVisible()

  // First-lesson button carries the pulse-ring animation as an inline style.
  const firstBtn = page.getByTestId('lesson-btn-1')
  await expect(firstBtn).toHaveCSS('animation-name', /pulse-ring/)

  // Tapping the second circle (any circle in the module) marks the module started.
  // We check the intent via localStorage instead of navigating, because navigation
  // away would unmount ModuleMap before we can assert cleared state on it.
  await firstBtn.click()

  // Reload the module (deep-link back). The badge must NOT appear anymore, and
  // the animation must be gone.
  await page.goto('/?playwright=1&moduleId=intro')

  await expect(page.getByText(/Начни здесь/)).toHaveCount(0)
  const firstBtnAfter = page.getByTestId('lesson-btn-1')
  await expect(firstBtnAfter).not.toHaveCSS('animation-name', /pulse-ring/)
})

test('module with completed lessons never pulses even without the start flag', async ({ page }) => {
  await page.route('**/api/miniapp/content', (route: any) => route.fulfill({ json: catalog }))
  await page.route('**/api/miniapp/me', (route: any) =>
    route.fulfill({
      json: {
        ...me,
        progress: { ...me.progress, completedLessons: { 'alphabet-progressive': [1], intro: [1] } },
      },
    })
  )
  await page.route('**/api/miniapp/activity-days*', (route: any) =>
    route.fulfill({ json: { dates: [] } })
  )

  await page.goto('/?playwright=1&moduleId=intro')

  // ModuleMap rendered — lesson buttons are the reliable anchor.
  await expect(page.getByTestId('lesson-btn-1')).toBeVisible()
  await expect(page.getByText(/Начни здесь/)).toHaveCount(0)
})
