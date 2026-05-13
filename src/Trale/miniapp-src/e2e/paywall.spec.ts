import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // Simulate being inside Telegram WebApp so the app boots out of "not authenticated" mode.
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
    // Clean any previously persisted collapse state so sections render expanded.
    try { localStorage.removeItem('bombora_collapsed') } catch {}
  })
})

// Verifies the entitlement → paywall pipeline end-to-end:
// when /api/miniapp/me reports isPro=false and isTrialActive=false (the
// expired-Pro state the backend now returns once SubscribedUntil < now),
// Pro modules render with the lock affordance and the paywall sheet opens
// on tap. This is what guarantees a lapsed paying user actually sees the
// renewal CTA instead of silently keeping their access.

const expiredProMeResponse = {
  authenticated: true,
  isPro: false,
  isTrialActive: false,
  trialDaysLeft: 0,
  subscriptionPlan: 'Month',
  subscribedUntil: '2025-12-01T00:00:00Z',
  hasAccess: false,
  level: 'intermediate',
  vocabularyCount: 12,
  progress: {
    xp: 200,
    streak: 0,
    lastPlayedAtUtc: null,
    completedLessons: {},
    xpSpent: 0,
    totalTreatsGiven: 0,
    lastFedAtUtc: null,
    lastTreatIndex: null,
  },
}

const proMeResponse = { ...expiredProMeResponse, isPro: true, hasAccess: true }

// Minimal catalog: one launch (free-tier) module, one Pro module, and the
// personal vocabulary module so we can assert each gating type.
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
        { id: 1, title: 'L1', short: 'L1', theory: { title: 'L1', goal: 'g', blocks: [] } },
      ],
    },
    {
      id: 'cases',
      title: 'Падежи',
      emoji: '🧩',
      description: 'Падежи грузинского',
      lessons: [
        { id: 1, title: 'L1', short: 'L1', theory: { title: 'L1', goal: 'g', blocks: [] } },
      ],
    },
    {
      id: 'my-vocabulary',
      title: 'Мой словарь',
      emoji: '📒',
      description: 'Личный словарь',
      lessons: [],
    },
  ],
}

async function setupApi(page: any, me: typeof expiredProMeResponse) {
  await page.route('**/api/miniapp/content', (route: any) => route.fulfill({ json: catalog }))
  await page.route('**/api/miniapp/me', (route: any) => route.fulfill({ json: me }))
  await page.route('**/api/miniapp/activity-days*', (route: any) =>
    route.fulfill({ json: { dates: [] } })
  )
  await page.route('**/api/miniapp/plans', (route: any) =>
    route.fulfill({
      json: {
        plans: [
          { id: 'Month', payloadId: 'Stars_Pro_Month', stars: 100, durationDays: 30, title: '1 месяц', description: '30 дней' },
        ],
      },
    })
  )
}

test('expired-Pro user sees Pro module locked and paywall opens on tap', async ({ page }) => {
  await setupApi(page, expiredProMeResponse)
  // ?playwright=1 bypasses the Telegram-WebApp check (App.tsx isInsideTelegram).
  await page.goto('/?playwright=1')

  // Pro tile must be rendered.
  const proTile = page.getByTestId('module-tile-cases')
  await expect(proTile).toBeVisible()

  // Locked tile carries a ★ Про badge; that's the visual hint the user has lost access.
  await expect(proTile.locator('span[aria-label="Про-доступ"]')).toBeVisible()

  // Tapping a locked tile opens the paywall sheet.
  await proTile.click()
  await expect(page.getByRole('dialog', { name: 'Про-доступ' })).toBeVisible()
})

test('expired-Pro user sees my-vocabulary locked and paywall opens on tap', async ({ page }) => {
  await setupApi(page, expiredProMeResponse)
  await page.goto('/?playwright=1')

  const vocabTile = page.getByTestId('module-tile-my-vocabulary')
  await expect(vocabTile).toBeVisible()
  await expect(vocabTile.locator('span[aria-label="Про-доступ"]')).toBeVisible()

  await vocabTile.click()
  await expect(page.getByRole('dialog', { name: 'Про-доступ' })).toBeVisible()
})

test('trial user has full access to my-vocabulary', async ({ page }) => {
  const trialMe = { ...expiredProMeResponse, isPro: false, isTrialActive: true, trialDaysLeft: 20, hasAccess: true }
  await setupApi(page, trialMe)
  await page.goto('/?playwright=1')

  const vocabTile = page.getByTestId('module-tile-my-vocabulary')
  await expect(vocabTile).toBeVisible()
  // No lock badge for trial users.
  await expect(vocabTile.locator('span[aria-label="Про-доступ"]')).toBeHidden()
})

test('active-Pro user can tap a Pro module without paywall', async ({ page }) => {
  await setupApi(page, proMeResponse)
  // ?playwright=1 bypasses the Telegram-WebApp check (App.tsx isInsideTelegram).
  await page.goto('/?playwright=1')

  const proTile = page.getByTestId('module-tile-cases')
  await expect(proTile).toBeVisible()
  await proTile.click()

  // No paywall dialog should pop — Pro user has access.
  await expect(page.getByRole('dialog', { name: 'Про-доступ' })).toBeHidden()
  // And the locked-badge isn't shown on the tile.
  await expect(proTile.locator('span[aria-label="Про-доступ"]')).toBeHidden()
})
