import { test, expect } from '@playwright/test'

// ─── Shared mock data ────────────────────────────────────────────────────────

const meResponseNotificationsOn = {
  authenticated: true,
  isPro: false,
  notificationsEnabled: true,
  level: 'intermediate',
  vocabularyCount: 5,
  progress: {
    xp: 100,
    streak: 3,
    lastPlayedAtUtc: null,
    completedLessons: {},
    xpSpent: 0,
    totalTreatsGiven: 0,
    lastFedAtUtc: null,
    lastTreatIndex: null,
  },
}

const meResponseNotificationsOff = {
  ...meResponseNotificationsOn,
  notificationsEnabled: false,
}

const mockCatalog = {
  botUsername: 'TraleBot',
  miniAppEnabled: true,
  modules: [
    {
      id: 'alphabet-progressive',
      title: 'Алфавит',
      emoji: '🔤',
      description: 'Изучи грузинский алфавит',
      lessons: [],
    },
  ],
}

const mockReferral = {
  link: 'https://t.me/trale_bot?start=ref_999',
  shareText: 'Учи грузинский!',
  invitedCount: 0,
  activatedCount: 0,
  bonusLabel: '+30 дней',
  todayActivated: 0,
  dailyLimit: 3,
  yearActivated: 0,
  yearlyLimit: 30,
  trialCapReached: false,
  trialLimit: 3,
}

// ─── Setup helpers ───────────────────────────────────────────────────────────

async function setupProfileMocks(page: any, meResponse = meResponseNotificationsOn) {
  await page.route('**/api/miniapp/content', (route: any) =>
    route.fulfill({ json: mockCatalog })
  )
  await page.route('**/api/miniapp/me', (route: any) =>
    route.fulfill({ json: meResponse })
  )
  await page.route('**/api/miniapp/activity-days**', (route: any) =>
    route.fulfill({ json: { dates: [] } })
  )
  await page.route('**/api/miniapp/referral', (route: any) =>
    route.fulfill({ json: mockReferral })
  )
  await page.route('**/api/miniapp/plans', (route: any) =>
    route.fulfill({ json: { plans: [] } })
  )
  await page.route('**/api/miniapp/notifications', (route: any) =>
    route.fulfill({ json: { ok: true } })
  )
}

async function navigateToProfile(page: any) {
  await page.goto('/?playwright=1')
  const profileBtn = page.getByRole('button', { name: /мой профиль/i })
  await expect(profileBtn).toBeVisible({ timeout: 15_000 })
  await profileBtn.click()
  await expect(page.getByTestId('notifications-section')).toBeVisible({ timeout: 10_000 })
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('ProfileScreen_RendersNotificationsSection', async ({ page }) => {
  await setupProfileMocks(page)
  await navigateToProfile(page)

  const section = page.getByTestId('notifications-section')
  await expect(section).toBeVisible()
  await expect(page.getByText('Уведомления')).toBeVisible()
})

test('ProfileScreen_ToggleOff_CallsPatchWithEnabledFalse', async ({ page }) => {
  await setupProfileMocks(page, meResponseNotificationsOn)

  const requests: { url: string; method: string; body: string }[] = []
  await page.route('**/api/miniapp/notifications', async (route) => {
    const req = route.request()
    requests.push({
      url: req.url(),
      method: req.method(),
      body: req.postData() ?? '',
    })
    await route.fulfill({ json: { ok: true } })
  })

  await navigateToProfile(page)
  const toggle = page.getByTestId('notifications-toggle')
  await toggle.click()

  const patchReq = requests.find((r) => r.method === 'PATCH')
  expect(patchReq).toBeDefined()
  expect(JSON.parse(patchReq!.body)).toMatchObject({ enabled: false })

  // Toggle should now show unchecked state
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
})

test('ProfileScreen_ToggleOn_CallsPatchWithEnabledTrue', async ({ page }) => {
  await setupProfileMocks(page, meResponseNotificationsOff)

  const requests: { url: string; method: string; body: string }[] = []
  await page.route('**/api/miniapp/notifications', async (route) => {
    const req = route.request()
    requests.push({
      url: req.url(),
      method: req.method(),
      body: req.postData() ?? '',
    })
    await route.fulfill({ json: { ok: true } })
  })

  await navigateToProfile(page)
  const toggle = page.getByTestId('notifications-toggle')
  await toggle.click()

  const patchReq = requests.find((r) => r.method === 'PATCH')
  expect(patchReq).toBeDefined()
  expect(JSON.parse(patchReq!.body)).toMatchObject({ enabled: true })

  await expect(toggle).toHaveAttribute('aria-checked', 'true')
})

test('ProfileScreen_ThreeSubLabels_AreVisible', async ({ page }) => {
  await setupProfileMocks(page)
  await navigateToProfile(page)

  await expect(page.getByText('Праздники')).toBeVisible()
  await expect(page.getByText('Накопленные монеты')).toBeVisible()
  await expect(page.getByText('Стрик-достижения')).toBeVisible()
})

test('ProfileScreen_WhenToggleOff_SubLabelsAreMuted', async ({ page }) => {
  await setupProfileMocks(page, meResponseNotificationsOff)
  await navigateToProfile(page)

  const sublabels = page.getByTestId('notification-sublabels')
  await expect(sublabels).toBeVisible()

  // Sub-labels container should have opacity/muted class when disabled
  const classAttr = await sublabels.getAttribute('class') ?? ''
  expect(classAttr).toContain('opacity-40')
})

test('ProfileScreen_ToggleTapTarget_IsAtLeast44px', async ({ page }) => {
  await setupProfileMocks(page)
  await navigateToProfile(page)

  const toggle = page.getByTestId('notifications-toggle')
  const box = await toggle.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.height).toBeGreaterThanOrEqual(44)
  expect(box!.width).toBeGreaterThanOrEqual(44)
})

test('ProfileScreen_375px_NoHorizontalOverflow', async ({ page }) => {
  await setupProfileMocks(page)
  await page.setViewportSize({ width: 375, height: 812 })
  await navigateToProfile(page)

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  )
  expect(overflow).toBe(false)
})
