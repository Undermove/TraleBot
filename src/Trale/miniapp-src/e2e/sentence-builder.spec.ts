import { test, expect } from '@playwright/test'

// ─── Shared mock data ────────────────────────────────────────────────────────

const mockCatalog = {
  botUsername: 'TraleBot',
  miniAppEnabled: true,
  modules: [
    {
      id: 'postpositions',
      title: 'Постпозиции',
      emoji: '🏠',
      description: 'Грузинские послелоги',
      lessons: [
        {
          id: 1,
          title: 'Урок 1',
          short: 'L1',
          theory: {
            title: 'Постпозиции',
            goal: 'Изучи послелоги',
            blocks: [{ type: 'paragraph', text: '-ში = в (внутри), -ზე = на, -თან = у/рядом' }],
          },
        },
        {
          id: 2,
          title: 'Урок 2',
          short: 'L2',
          theory: {
            title: 'Постпозиции 2',
            goal: 'Продолжение',
            blocks: [{ type: 'paragraph', text: 'Практикуй постпозиции' }],
          },
        },
      ],
    },
  ],
}

// L1: 1 empty slot (positions 0 and 2 preset), correct answer = 'სახლში'
const mockL1Question = [
  {
    id: 'q-l1-1',
    questionType: 'sentence-builder',
    targetSentence: { ru: 'Я иду в дом' },
    level: 1,
    correctOrder: ['მე', 'სახლში', 'მივდივარ'],
    chipPool: ['სახლში', 'ვარ', 'გახვედი'],
    presetPositions: [
      { position: 0, token: 'მე' },
      { position: 2, token: 'მივდივარ' },
    ],
    hints: { '1': 'Постпозиция -ში стоит после существительного' },
    lemma: '',
    question: 'Я иду в дом',
    options: [],
    answerIndex: 0,
    explanation: '',
  },
]

// L2: 2 empty slots (only position 0 preset)
const mockL2Question = [
  {
    id: 'q-l2-1',
    questionType: 'sentence-builder',
    targetSentence: { ru: 'Ты идёшь в магазин' },
    level: 2,
    correctOrder: ['შენ', 'მაღაზიაში', 'მიდიხარ'],
    chipPool: ['მაღაზიაში', 'მიდიხარ', 'ვარ'],
    presetPositions: [{ position: 0, token: 'შენ' }],
    hints: {},
    lemma: '',
    question: 'Ты идёшь в магазин',
    options: [],
    answerIndex: 0,
    explanation: '',
  },
]

const proMeResponse = {
  authenticated: true,
  isPro: true,
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

const freeMeResponse = {
  authenticated: true,
  isPro: false,
  level: 'intermediate',
  vocabularyCount: 3,
  progress: {
    xp: 20,
    streak: 1,
    lastPlayedAtUtc: null,
    completedLessons: {},
    xpSpent: 0,
    totalTreatsGiven: 0,
    lastFedAtUtc: null,
    lastTreatIndex: null,
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function setupApiMocks(page: any, meResponse: object, lessonQuestions: object[]) {
  await page.route('/api/miniapp/content', (route: any) =>
    route.fulfill({ json: mockCatalog })
  )
  await page.route('/api/miniapp/me', (route: any) =>
    route.fulfill({ json: meResponse })
  )
  await page.route('/api/miniapp/modules/postpositions/lessons/1/questions', (route: any) =>
    route.fulfill({ json: lessonQuestions })
  )
  await page.route('/api/miniapp/modules/postpositions/lessons/2/questions', (route: any) =>
    route.fulfill({ json: mockL2Question })
  )
  await page.route('/api/miniapp/lessons/complete', (route: any) =>
    route.fulfill({ json: { xpEarned: 20, progress: (meResponse as any).progress } })
  )
  // Intercept plans (for paywall)
  await page.route('/api/miniapp/plans', (route: any) =>
    route.fulfill({ json: { plans: [{ id: 'Year', payloadId: 'year', stars: 900, durationDays: 365, title: 'Год', description: 'Полный год' }] } })
  )
}

async function navigateToPractice(page: any, lessonId: number = 1) {
  // From dashboard click module tile
  await page.locator('h2', { hasText: 'Постпозиции' }).click()
  // Click lesson circle
  await page.locator(`button[aria-label="Урок ${lessonId}"]`).click()
  // Click "к практике →"
  await page.getByRole('button', { name: /к практике/i }).click()
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  // Simulate being inside Telegram WebApp
  await page.addInitScript(() => {
    ;(window as any).Telegram = {
      WebApp: {
        initData: 'user=%7B%22id%22%3A123456%7D',
        BackButton: { show: () => {}, hide: () => {}, onClick: () => {}, offClick: () => {} },
        MainButton: { show: () => {}, hide: () => {} },
      },
    }
  })
})

test('L1 happy path — chip tap → slot fill → Проверить → FeedbackBanner სწორია! → Далее', async ({
  page,
}) => {
  await setupApiMocks(page, proMeResponse, mockL1Question)

  let completeLessonPayload: any = null
  await page.route('/api/miniapp/lessons/complete', async (route) => {
    completeLessonPayload = JSON.parse(route.request().postData() ?? '{}')
    await route.fulfill({ json: { xpEarned: 20, progress: proMeResponse.progress } })
  })

  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await navigateToPractice(page, 1)

  // Wait for SentenceBuilderCard to render
  await expect(page.locator('[data-testid="sentence-builder-card"]')).toBeVisible()

  // Tap chip 'სახლში'
  await page.getByRole('button', { name: 'სახლში' }).click()

  // Tap the empty slot (slot-1)
  await page.locator('[data-testid="slot-1"]').click()

  // Проверить should now be enabled
  const verifyBtn = page.getByRole('button', { name: /Проверить/i })
  await expect(verifyBtn).not.toHaveAttribute('aria-disabled', 'true')

  // Tap Проверить
  await verifyBtn.click()

  // FeedbackBanner 'სწორია!' should be visible
  await expect(page.locator('text=სწორია!')).toBeVisible()

  // Далее button should appear
  const nextBtn = page.getByRole('button', { name: /Далее/i })
  await expect(nextBtn).toBeVisible()

  // Tap Далее — triggers lesson completion API call
  await nextBtn.click()

  // Wait a bit for API call
  await page.waitForTimeout(500)

  // Assert isCorrect=true in intercepted API payload (correct: 1, total: 1)
  expect(completeLessonPayload).toBeTruthy()
  expect(completeLessonPayload.correct).toBe(1)
  expect(completeLessonPayload.total).toBe(1)
})

test('L2 incomplete answer — Проверить aria-disabled; tap is no-op', async ({ page }) => {
  await setupApiMocks(page, proMeResponse, mockL2Question)

  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await navigateToPractice(page, 1)

  await expect(page.locator('[data-testid="sentence-builder-card"]')).toBeVisible()

  // Fill only one of two empty slots
  await page.getByRole('button', { name: 'მაღაზიაში' }).click()
  await page.locator('[data-testid="slot-1"]').click()

  // Проверить should still be aria-disabled
  const verifyBtn = page.getByRole('button', { name: /Проверить/i })
  await expect(verifyBtn).toHaveAttribute('aria-disabled', 'true')

  // Force-tap disabled Проверить — no navigation should occur
  await verifyBtn.click({ force: true })

  // SentenceBuilderCard should still be visible (no navigation)
  await expect(page.locator('[data-testid="sentence-builder-card"]')).toBeVisible()
  // FeedbackBanner should NOT appear
  await expect(page.locator('text=სწორია!')).not.toBeVisible()
})

test('disabled Проверить — no network request on tap', async ({ page }) => {
  await setupApiMocks(page, proMeResponse, mockL1Question)

  let networkRequestFired = false
  await page.route('/api/miniapp/lessons/complete', (route) => {
    networkRequestFired = true
    route.fulfill({ json: { xpEarned: 0, progress: proMeResponse.progress } })
  })

  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await navigateToPractice(page, 1)

  await expect(page.locator('[data-testid="sentence-builder-card"]')).toBeVisible()

  // Do NOT fill the slot — Проверить is disabled
  const verifyBtn = page.getByRole('button', { name: /Проверить/i })
  await expect(verifyBtn).toHaveAttribute('aria-disabled', 'true')

  // Force-tap disabled button
  await verifyBtn.click({ force: true })
  await page.waitForTimeout(200)

  // No API request should have fired
  expect(networkRequestFired).toBe(false)
})

test('Chip return — tap filled slot returns chip to pool; slot reverts to dashed border', async ({
  page,
}) => {
  await setupApiMocks(page, proMeResponse, mockL1Question)

  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await navigateToPractice(page, 1)

  await expect(page.locator('[data-testid="sentence-builder-card"]')).toBeVisible()

  // Fill slot-1 with 'სახლში'
  await page.getByRole('button', { name: 'სახლში' }).click()
  await page.locator('[data-testid="slot-1"]').click()

  // Chip should be in slot (not in pool)
  await expect(page.getByRole('button', { name: 'სახლში' })).not.toBeVisible()

  // Tap the filled slot to return chip
  await page.locator('[data-testid="slot-1"]').click()

  // Chip should be back in the pool
  await expect(page.getByRole('button', { name: 'სახლში' })).toBeVisible()

  // Slot should be empty (Проверить disabled again)
  const verifyBtn = page.getByRole('button', { name: /Проверить/i })
  await expect(verifyBtn).toHaveAttribute('aria-disabled', 'true')

  // Slot element should have 'empty' state (dashed-border class)
  const slot1 = page.locator('[data-testid="slot-1"]')
  await expect(slot1).toHaveClass(/border-dashed/)
})

test('Free user — Postpositions L1 shows paywall component; tap-target ≥ 44px', async ({
  page,
}) => {
  // Use 375px viewport as required by spec
  await page.setViewportSize({ width: 375, height: 812 })
  await setupApiMocks(page, freeMeResponse, mockL1Question)

  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // Click the postpositions module tile (free user → paywall should appear, not module map)
  await page.locator('h2', { hasText: 'Постпозиции' }).click()

  // Paywall dialog should be visible
  const paywallDialog = page.locator('[role="dialog"][aria-label="Про-доступ"]')
  await expect(paywallDialog).toBeVisible()

  // SentenceBuilderCard should NOT be visible
  await expect(page.locator('[data-testid="sentence-builder-card"]')).not.toBeVisible()

  // Verify tap-target ≥ 44px for the CTA button
  // The paywall CTA ("купить" / "Купить за X ⭐") should be ≥ 44px tall
  const cta = paywallDialog.locator('button').filter({ hasText: /купить/i }).first()
  await expect(cta).toBeVisible()
  const box = await cta.boundingBox()
  expect(box).toBeTruthy()
  expect(box!.height).toBeGreaterThanOrEqual(44)
  expect(box!.width).toBeGreaterThanOrEqual(44)
})
