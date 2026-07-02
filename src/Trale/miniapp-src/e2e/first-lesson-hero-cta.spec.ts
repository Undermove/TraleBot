import { test, expect } from '@playwright/test'

// #1002: brand-new dashboard visitor (no completed lessons) sees the navy
// FirstLessonHeroCta with «გამარჯობა!» subtitle and tap goes straight into
// lesson-theory of the first module's first lesson. A returning user with any
// completed lessons falls back to the regular suggestion tile — hero absent.

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
        {
          id: 1,
          title: 'Первые буквы',
          short: 'L1',
          theory: { title: 'Первые буквы', goal: 'g', blocks: [] },
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

// Brand-new user who somehow lands on the dashboard with 0 completedLessons.
// XP > 0 keeps them past the pre-welcome gate (entryFlow), while an empty
// completedLessons map keeps the hero-gate active — the design's "new user
// with XP from referral" edge case (see spec table).
const newUserMe = {
  authenticated: true,
  level: 'beginner',
  isPro: false,
  isTrialActive: false,
  trialDaysLeft: 0,
  vocabularyCount: 0,
  onboardingHint: null,
  progress: {
    xp: 20,
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
  ...newUserMe,
  progress: {
    ...newUserMe.progress,
    xp: 100,
    completedLessons: { 'alphabet-progressive': [1] },
  },
}

async function setupApi(page: any, me: any) {
  await page.route('**/api/miniapp/content', (route: any) => route.fulfill({ json: catalog }))
  await page.route('**/api/miniapp/me', (route: any) => route.fulfill({ json: me }))
  await page.route('**/api/miniapp/activity-days*', (route: any) =>
    route.fulfill({ json: { dates: [] } })
  )
}

test('brand-new user sees the navy hero-CTA and tapping it opens lesson-theory of the first lesson', async ({ page }) => {
  await setupApi(page, newUserMe)
  await page.goto('/?playwright=1')

  const hero = page.getByTestId('dashboard-first-lesson-hero')
  await expect(hero).toBeVisible()
  await expect(hero).toContainText('первый урок')
  await expect(hero).toContainText('Первые буквы')
  await expect(hero).toContainText('გამარჯობა!')
  await expect(hero).toContainText('Алфавит')
  await expect(hero).toContainText('урок 1')

  // No regular suggestion tile while hero is showing.
  await expect(page.getByTestId('dashboard-suggestion')).toHaveCount(0)

  // Tap → LessonTheory for alphabet-progressive lesson 1.
  await hero.click()
  await expect(page.getByRole('heading', { name: /Первые буквы/ })).toBeVisible()
})

test('returning user with completed lessons sees the regular suggestion tile — no hero', async ({ page }) => {
  await setupApi(page, returningMe)
  await page.goto('/?playwright=1')

  await expect(page.getByTestId('dashboard-suggestion')).toBeVisible()
  await expect(page.getByTestId('dashboard-first-lesson-hero')).toHaveCount(0)
})
