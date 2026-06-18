import { test, expect } from '@playwright/test'

// Visibility matrix for the "+7 дней бесплатно" referral CTA on Dashboard.
// Driven entirely by the `shouldShowReferralExtensionCta` flag the backend
// computes from User.ShouldShowReferralExtensionCta. UI must show the CTA
// only when that flag is true.

const baseMe = {
  authenticated: true,
  level: 'intermediate',
  vocabularyCount: 0,
  progress: {
    // xp > 0 so the user is past the first-lesson gate and lands on the
    // dashboard, where the referral CTA / trial banners under test live.
    xp: 200,
    streak: 0,
    lastPlayedAtUtc: null,
    completedLessons: { 'alphabet-progressive': [1] },
    xpSpent: 0,
    totalTreatsGiven: 0,
    lastFedAtUtc: null,
    lastTreatIndex: null,
  },
}

const catalog = {
  botUsername: 'TraleBot',
  miniAppEnabled: true,
  modules: [
    {
      id: 'alphabet-progressive',
      title: 'Алфавит',
      emoji: '🔤',
      description: '',
      lessons: [{ id: 1, title: 'L1', short: 'L1', theory: { title: 'L1', goal: 'g', blocks: [] } }],
    },
  ],
}

const referralResponse = {
  link: 'https://t.me/trale_bot?start=ref_123',
  shareText: 'TraleBot — учу грузинский 🇬🇪',
  invitedCount: 0,
  activatedCount: 0,
  rules: ['Друг получит 60 дней триала вместо 30.', 'Ты получишь +7 дней триала.'],
  capReached: false,
}

async function setup(page: any, me: any) {
  await page.addInitScript(() => {
    ;(window as any).Telegram = {
      WebApp: {
        initData: 'user=1',
        BackButton: { show: () => {}, hide: () => {}, onClick: () => {}, offClick: () => {} },
        MainButton: { show: () => {}, hide: () => {} },
        HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {} },
        openTelegramLink: () => {},
      },
    }
    try { localStorage.removeItem('bombora_collapsed') } catch {}
  })
  await page.route('**/api/miniapp/content', (r: any) => r.fulfill({ json: catalog }))
  await page.route('**/api/miniapp/me', (r: any) => r.fulfill({ json: me }))
  await page.route('**/api/miniapp/referral', (r: any) => r.fulfill({ json: referralResponse }))
  await page.route('**/api/miniapp/activity-days*', (r: any) => r.fulfill({ json: { dates: [] } }))
}

test('CTA hidden for fresh trial user (28 days left)', async ({ page }) => {
  await setup(page, { ...baseMe, isPro: false, isTrialActive: true, trialDaysLeft: 28, shouldShowReferralExtensionCta: false })
  await page.goto('/?playwright=1')
  await expect(page.locator('text=Бесплатный период')).toBeVisible()
  await expect(page.getByTestId('referral-extension-cta')).toBeHidden()
})

test('CTA visible when trial is ending in 2 days', async ({ page }) => {
  await setup(page, { ...baseMe, isPro: false, isTrialActive: true, trialDaysLeft: 2, shouldShowReferralExtensionCta: true })
  await page.goto('/?playwright=1')
  await expect(page.locator('text=Бесплатный период')).toBeVisible()
  await expect(page.getByTestId('referral-extension-cta')).toBeVisible()
})

test('CTA visible in expired-trial banner when no trial and no Pro', async ({ page }) => {
  await setup(page, { ...baseMe, isPro: false, isTrialActive: false, trialDaysLeft: 0, shouldShowReferralExtensionCta: true })
  await page.goto('/?playwright=1')
  await expect(page.getByTestId('trial-expired-banner')).toBeVisible()
  await expect(page.getByTestId('referral-extension-cta')).toBeVisible()
})

test('CTA hidden for active-Pro user', async ({ page }) => {
  await setup(page, {
    ...baseMe,
    isPro: true,
    isTrialActive: false,
    trialDaysLeft: 0,
    shouldShowReferralExtensionCta: false,
    subscriptionPlan: 'Month',
  })
  await page.goto('/?playwright=1')
  await expect(page.getByTestId('trial-expired-banner')).toBeHidden()
  await expect(page.getByTestId('referral-extension-cta')).toBeHidden()
})

test('CTA hidden for Lifetime user', async ({ page }) => {
  await setup(page, {
    ...baseMe,
    isPro: true,
    isTrialActive: false,
    trialDaysLeft: 0,
    shouldShowReferralExtensionCta: false,
    subscriptionPlan: 'Lifetime',
  })
  await page.goto('/?playwright=1')
  await expect(page.getByTestId('referral-extension-cta')).toBeHidden()
})

test('tapping CTA opens Telegram share link with referral URL', async ({ page }) => {
  await setup(page, { ...baseMe, isPro: false, isTrialActive: true, trialDaysLeft: 1, shouldShowReferralExtensionCta: true })
  await page.goto('/?playwright=1')
  await expect(page.getByTestId('referral-extension-cta')).toBeVisible()

  // telegram-web-app.js overrides our init-script mock by the time the React app
  // renders, so we patch openTelegramLink after the page settles and capture
  // calls into window.__shareCalls.
  await page.evaluate(() => {
    ;(window as any).__shareCalls = [] as string[]
    const tg = (window as any).Telegram?.WebApp
    if (tg) tg.openTelegramLink = (url: string) => (window as any).__shareCalls.push(url)
  })

  await page.getByTestId('referral-extension-cta').locator('button').click()
  await page.waitForTimeout(50)

  const calls = await page.evaluate(() => (window as any).__shareCalls)
  expect(calls.length).toBe(1)
  expect(calls[0]).toContain('t.me/share/url')
  expect(calls[0]).toContain(encodeURIComponent('https://t.me/trale_bot?start=ref_123'))
})
