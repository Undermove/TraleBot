import { test, expect } from '@playwright/test'
import { playWelcome } from './welcome'

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

  // The game-form intro is shown...
  await expect(page.getByTestId('welcome-screen')).toBeVisible()
  await expect(page.getByRole('button', { name: 'поехали →' })).toBeVisible()

  // ...and the dashboard hub (module grid) is NOT rendered.
  await expect(page.getByTestId('module-tile-alphabet-progressive')).toHaveCount(0)
  await expect(page.getByTestId('module-tile-intro')).toHaveCount(0)
})

const afterWelcome = { ...freshMe.progress, xp: 15, completedLessons: { welcome: [1] } }

/** Walks the welcome lesson to its win screen; returns the lesson-complete calls seen so far. */
async function finishWelcome(page: any) {
  const recorded: any[] = []
  // The welcome lesson records its completion via lesson-complete; return XP so the
  // app flips the gate to the dashboard, mirroring the real backend response.
  await page.route('**/api/miniapp/progress/lesson-complete', (route: any) => {
    recorded.push(route.request().postDataJSON())
    return route.fulfill({ json: { xpEarned: 15, progress: afterWelcome } })
  })
  await page.goto('/?playwright=1')
  await playWelcome(page)
  return recorded
}

test('after the welcome lesson the one main action is the next lesson', async ({ page }) => {
  await setupApi(page, freshMe)
  const recorded = await finishWelcome(page)

  // The lesson is already recorded — before any further tap…
  await expect.poll(() => recorded.length).toBe(1)
  expect(recorded[0]).toMatchObject({ moduleId: 'welcome', lessonId: 1 })
  // …and there is exactly one big button; the hub is a quiet link below it.
  await expect(page.locator('[data-testid="welcome-screen"] .jewel-btn')).toHaveCount(1)
  const browse = page.getByTestId('welcome-browse')
  expect((await browse.boundingBox())!.height).toBeGreaterThanOrEqual(44)

  await page.getByRole('button', { name: 'продолжить алфавит →' }).click()

  // Straight into alphabet lesson 1 — ა is already familiar there — not the hub.
  await expect(page.getByTestId('lesson-opener')).toBeVisible()
  await expect(page.getByText('Одну букву ты уже знаешь, ещё 2 — новые')).toBeVisible()
  await expect(page.getByTestId('module-tile-alphabet-progressive')).toHaveCount(0)
  expect(recorded.length).toBe(1)
})

test('the win screen fits a 375px phone without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await setupApi(page, freshMe)
  // The first lesson as the real catalog names it — the longest line the card has to hold.
  const realFirst = { ...catalog.modules[0].lessons[0], title: 'Гласные', short: 'ა ე ი ო უ' }
  await page.route('**/api/miniapp/content', (route: any) =>
    route.fulfill({ json: { ...catalog, modules: [{ ...catalog.modules[0], lessons: [realFirst] }, catalog.modules[1]] } })
  )
  await finishWelcome(page)
  const button = page.getByRole('button', { name: 'продолжить алфавит →' })
  await expect(button).toBeInViewport({ ratio: 1 })
  await expect(page.getByTestId('welcome-browse')).toBeInViewport({ ratio: 1 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  if (process.env.FIRST_MINUTES_SHOTS) {
    await page.screenshot({ path: `${process.env.FIRST_MINUTES_SHOTS}/after-welcome-375.png` })
  }
})

test('the hub with all lessons stays one tap away from the win screen', async ({ page }) => {
  await setupApi(page, freshMe)
  await finishWelcome(page)

  await page.getByTestId('welcome-browse').click()

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

test('the whole first minute plays on a 320px phone and every step is tracked', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await setupApi(page, freshMe)
  const events: any[] = []
  await page.route('**/api/miniapp/events', (route: any) => { events.push(...route.request().postDataJSON().events); return route.fulfill({ status: 204 }) })
  await page.route('**/api/miniapp/progress/lesson-complete', (route: any) =>
    route.fulfill({ json: { xpEarned: 15, progress: afterWelcome } }))
  await page.addInitScript(() => { (window as any).__lessonEventsOn = true })
  await page.goto('/?playwright=1')
  const dir = process.env.SHOTS_DIR
  let n = 50
  await playWelcome(page, async (name) => {
    const overflow = await page.evaluate(() => document.scrollingElement!.scrollHeight - innerHeight)
    expect(overflow, `${name} scrolls`).toBeLessThanOrEqual(1)
    if (dir) await page.screenshot({ path: `${dir}/${n++}-320-welcome-${name}.png` })
  })
  await page.getByRole('button', { name: 'продолжить алфавит →' }).click()
  await expect(page.getByTestId('lesson-opener')).toBeVisible()
  await page.waitForTimeout(1200)
  if (dir) await page.screenshot({ path: `${dir}/${n++}-320-lesson1-opener-known.png` })
  // Трекер шлёт пачку при уходе со страницы.
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
  await expect.poll(() => events.filter(e => e.moduleId === 'onboarding').map(e => `${e.step}:${e.stepKind}:${e.event}`)).toEqual(expect.arrayContaining([
    '0:greeting:lesson_open', '1:letter-intro:step_start', '2:catch:step_done', '3:first-word:step_done', '4:tour:step_done',
    '5:celebration:step_start', '5:celebration:lesson_complete'
  ]))
  expect(events.some(e => e.moduleId === 'alphabet-progressive' && e.event === 'lesson_open')).toBe(true)
})
