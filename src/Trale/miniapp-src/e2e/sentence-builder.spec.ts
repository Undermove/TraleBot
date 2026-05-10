import { test, expect } from '@playwright/test'

// ─── Cases L10 mock data (issue #876) ────────────────────────────────────────

// L1 ergative question: empty slot 0 (კაcMА), presets at 1 and 2
const mockCasesL10Question = [
  {
    id: 'cases10-l1-q01',
    questionType: 'sentence-builder',
    targetSentence: { ru: 'Мужчина прочитал книгу' },
    level: 1,
    correctOrder: ['კაცმა', 'წაიკითხა', 'წიგნი'],
    chipPool: ['კაცმა', 'კაცი', 'კაცის', 'კაცით', 'წაიკითხა', 'წიგნი'],
    presetPositions: [
      { position: 1, token: 'წაიკითხა' },
      { position: 2, token: 'წიგნი' },
    ],
    hints: { '0': 'Подлежащее в эргативе' },
    lemma: 'კაცმა',
    question: 'Собери предложение: Мужчина прочитал книгу',
    options: [],
    answerIndex: 0,
    explanation: 'Эргатив (-მА): подлежащее переходного глагола в аористе.',
  },
]

const mockCasesCatalog = {
  botUsername: 'TraleBot',
  miniAppEnabled: true,
  modules: [
    {
      id: 'cases',
      title: 'Падежи',
      emoji: '🧩',
      description: 'Падежи грузинского языка',
      lessons: [
        {
          id: 10,
          title: 'Конструктор предложений — эргатив и датив',
          short: 'L10',
          theory: {
            title: 'Конструктор предложений: эргатив и датив',
            goal: 'Собирать предложения с эргативным субъектом и дательным объектом',
            blocks: [
              {
                type: 'list',
                items: [
                  '-მა (-მ после гласной) — эргатив: субъект переходного глагола в аористе',
                  '-ს — датив: прямой объект в настоящем времени или адресат',
                ],
              },
            ],
          },
        },
      ],
    },
  ],
}

async function setupCasesL10Mocks(page: any, lessonQuestions: object[]) {
  await page.route('**/api/miniapp/content', (route: any) =>
    route.fulfill({ json: mockCasesCatalog })
  )
  await page.route('**/api/miniapp/me', (route: any) =>
    route.fulfill({ json: proMeResponse })
  )
  await page.route('**/api/miniapp/modules/cases/lessons/10/questions', (route: any) =>
    route.fulfill({ json: lessonQuestions })
  )
  await page.route('**/api/miniapp/progress/lesson-complete', (route: any) =>
    route.fulfill({ json: { xpEarned: 0, progress: proMeResponse.progress } })
  )
  await page.route('**/api/miniapp/plans', (route: any) =>
    route.fulfill({
      json: {
        plans: [{ id: 'Year', payloadId: 'year', stars: 900, durationDays: 365, title: 'Год', description: 'Полный год' }],
      },
    })
  )
}

async function navigateToCasesL10(page: any) {
  const moduleTile = page.locator('[data-testid="module-tile-cases"]')
  await expect(moduleTile).toBeVisible({ timeout: 15_000 })
  await moduleTile.click()
  const lessonBtn = page.locator('[data-testid="lesson-btn-10"]')
  await expect(lessonBtn).toBeVisible({ timeout: 10_000 })
  await lessonBtn.click()
  const practiceBtn = page.getByRole('button', { name: /к практике/i })
  await expect(practiceBtn).toBeVisible({ timeout: 10_000 })
  await practiceBtn.click()
}

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

// 6 slots (positions 0-4 preset, slot 5 empty) — for overflow-x scroll-snap test
const mock6SlotQuestion = [
  {
    id: 'q-6slot',
    questionType: 'sentence-builder',
    targetSentence: { ru: 'Длинное предложение с шестью позициями' },
    level: 5,
    correctOrder: ['სიტ1', 'სიტ2', 'სიტ3', 'სიტ4', 'სიტ5', 'სიტ6'],
    chipPool: ['სიტ6', 'ვარ', 'ხარ'],
    presetPositions: [
      { position: 0, token: 'სიტ1' },
      { position: 1, token: 'სიტ2' },
      { position: 2, token: 'სიტ3' },
      { position: 3, token: 'სიტ4' },
      { position: 4, token: 'სიტ5' },
    ],
    hints: {},
    lemma: '',
    question: 'test-6slot',
    options: [],
    answerIndex: 0,
    explanation: '',
  },
]

// 10 chips in pool (1 empty slot) — for ChipPool wrap test
const mock10ChipQuestion = [
  {
    id: 'q-10chip',
    questionType: 'sentence-builder',
    targetSentence: { ru: 'Тест с десятью чипами в пуле' },
    level: 5,
    correctOrder: ['მე', 'სახლში', 'მივდივარ'],
    chipPool: ['სახლში', 'ვარ', 'ხარ', 'არის', 'ვიყავი', 'იყო', 'ვიქნები', 'იქნება', 'მაქვს', 'გაქვს'],
    presetPositions: [
      { position: 0, token: 'მე' },
      { position: 2, token: 'მივდივარ' },
    ],
    hints: {},
    lemma: '',
    question: 'test-10chip',
    options: [],
    answerIndex: 0,
    explanation: '',
  },
]

// Broken: chipPool missing 'სახლში' needed for non-preset slot 1 — triggers error fallback
const mockBrokenQuestion = [
  {
    id: 'q-broken',
    questionType: 'sentence-builder',
    targetSentence: { ru: 'Сломанное упражнение' },
    level: 1,
    correctOrder: ['მე', 'სახლში', 'მივდივარ'],
    chipPool: ['ვარ', 'გახვედი'],
    presetPositions: [
      { position: 0, token: 'მე' },
      { position: 2, token: 'მივდივარ' },
    ],
    hints: {},
    lemma: '',
    question: 'test-broken',
    options: [],
    answerIndex: 0,
    explanation: '',
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function setupApiMocks(page: any, meResponse: object, lessonQuestions: object[]) {
  await page.route('**/api/miniapp/content', (route: any) =>
    route.fulfill({ json: mockCatalog })
  )
  await page.route('**/api/miniapp/me', (route: any) =>
    route.fulfill({ json: meResponse })
  )
  await page.route('**/api/miniapp/modules/postpositions/lessons/1/questions', (route: any) =>
    route.fulfill({ json: lessonQuestions })
  )
  await page.route('**/api/miniapp/modules/postpositions/lessons/2/questions', (route: any) =>
    route.fulfill({ json: mockL2Question })
  )
  await page.route('**/api/miniapp/progress/lesson-complete', (route: any) =>
    route.fulfill({ json: { xpEarned: 20, progress: (meResponse as any).progress } })
  )
  // Intercept plans (for paywall)
  await page.route('**/api/miniapp/plans', (route: any) =>
    route.fulfill({ json: { plans: [{ id: 'Year', payloadId: 'year', stars: 900, durationDays: 365, title: 'Год', description: 'Полный год' }] } })
  )
}

async function navigateToPractice(page: any, lessonId: number = 1) {
  // Wait for the specific module tile (not the suggestion card which also contains 'Постпозиции')
  const moduleTile = page.locator('[data-testid="module-tile-postpositions"]')
  await expect(moduleTile).toBeVisible({ timeout: 15_000 })
  await moduleTile.click()
  // Click the lesson circle button by testId (each lesson circle has data-testid="lesson-btn-{id}")
  const lessonBtn = page.locator(`[data-testid="lesson-btn-${lessonId}"]`)
  await expect(lessonBtn).toBeVisible({ timeout: 10_000 })
  await lessonBtn.click()
  // Click "к практике →" button
  const practiceBtn = page.getByRole('button', { name: /к практике/i })
  await expect(practiceBtn).toBeVisible({ timeout: 10_000 })
  await practiceBtn.click()
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
  await page.route('**/api/miniapp/progress/lesson-complete', async (route) => {
    completeLessonPayload = JSON.parse(route.request().postData() ?? '{}')
    await route.fulfill({ json: { xpEarned: 20, progress: proMeResponse.progress } })
  })

  await page.goto('/?playwright=1')
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

  await page.goto('/?playwright=1')
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
  await page.route('**/api/miniapp/progress/lesson-complete', (route) => {
    networkRequestFired = true
    route.fulfill({ json: { xpEarned: 0, progress: proMeResponse.progress } })
  })

  await page.goto('/?playwright=1')
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

  await page.goto('/?playwright=1')
  await page.waitForLoadState('networkidle')

  await navigateToPractice(page, 1)

  await expect(page.locator('[data-testid="sentence-builder-card"]')).toBeVisible()

  // Fill slot-1 with 'სახლში'
  await page.getByRole('button', { name: 'სახლში' }).click()
  await page.locator('[data-testid="slot-1"]').click()

  // Chip should be in slot — the pool must NOT contain the chip button any more
  await expect(
    page.locator('[data-testid="chip-pool"]').getByRole('button', { name: 'სახლში' })
  ).toHaveCount(0)

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

  await page.goto('/?playwright=1')
  await page.waitForLoadState('networkidle')

  // Click the specific module tile (not the suggestion card which also contains 'Постпозиции')
  const moduleTile = page.locator('[data-testid="module-tile-postpositions"]')
  await expect(moduleTile).toBeVisible({ timeout: 15_000 })
  await moduleTile.click()

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

test('Practice screen — sentence-builder questionType routes to SentenceBuilderCard', async ({
  page,
}) => {
  await setupApiMocks(page, proMeResponse, mockL1Question)
  await page.goto('/?playwright=1')
  await page.waitForLoadState('networkidle')
  await navigateToPractice(page, 1)

  await expect(page.locator('[data-testid="sentence-builder-card"]')).toBeVisible({
    timeout: 10_000,
  })
})

test('WordChip — default/selected/disabled state classes; tap-target ≥ 44px in 375px viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await setupApiMocks(page, proMeResponse, mockL1Question)
  await page.goto('/?playwright=1')
  await page.waitForLoadState('networkidle')
  await navigateToPractice(page, 1)

  await expect(page.locator('[data-testid="sentence-builder-card"]')).toBeVisible()

  // default state: tap-target ≥ 44px
  const chip = page.getByRole('button', { name: 'სახლში' })
  await expect(chip).toBeVisible()
  const chipBox = await chip.boundingBox()
  expect(chipBox!.height).toBeGreaterThanOrEqual(44)
  expect(chipBox!.width).toBeGreaterThanOrEqual(44)

  // default state has bg-cream class
  await expect(chip).toHaveClass(/bg-cream/)

  // selected state: tap chip → gold bg
  await chip.click()
  await expect(chip).toHaveClass(/bg-gold/)

  // place chip, verify, then check disabled state
  await page.locator('[data-testid="slot-1"]').click()
  await page.getByRole('button', { name: /Проверить/i }).click()

  // after check — remaining chips in pool have disabled state (opacity-40)
  const remainingChips = page.locator('[data-testid="chip-pool"] button')
  const count = await remainingChips.count()
  if (count > 0) {
    await expect(remainingChips.first()).toHaveClass(/opacity-40/)
  }
})

test('SentenceSlot — incorrect state shows hint text below slot with ruby styling', async ({
  page,
}) => {
  await setupApiMocks(page, proMeResponse, mockL1Question)
  await page.goto('/?playwright=1')
  await page.waitForLoadState('networkidle')
  await navigateToPractice(page, 1)

  await expect(page.locator('[data-testid="sentence-builder-card"]')).toBeVisible()

  // Place wrong chip 'ვარ' in slot-1 (correct is 'სახლში')
  // exact: true avoids matching 'მივდივარ' (preset slot) which also contains 'ვარ'
  await page.locator('[data-testid="chip-pool"]').getByRole('button', { name: 'ვარ', exact: true }).click()
  await page.locator('[data-testid="slot-1"]').click()

  // Проверить should be enabled now (slot is filled)
  const verifyBtn = page.getByRole('button', { name: /Проверить/i })
  await expect(verifyBtn).not.toHaveAttribute('aria-disabled', 'true')
  await verifyBtn.click()

  // slot-1 should have ruby fill (incorrect state)
  await expect(page.locator('[data-testid="slot-1"]')).toHaveClass(/bg-ruby/)

  // hint text should appear below the incorrect slot
  const slotHint = page.locator('[data-testid="slot-hint"]')
  await expect(slotHint).toBeVisible()
  await expect(slotHint).toContainText('Постпозиция')
})

test('incorrect answer shows ruby slot fill and hint', async ({ page }) => {
  await setupApiMocks(page, proMeResponse, mockL1Question)
  await page.goto('/?playwright=1')
  await page.waitForLoadState('networkidle')
  await navigateToPractice(page, 1)

  await expect(page.locator('[data-testid="sentence-builder-card"]')).toBeVisible()

  // Place wrong chip (exact: true avoids matching 'მივდივარ' preset slot)
  await page.locator('[data-testid="chip-pool"]').getByRole('button', { name: 'ვარ', exact: true }).click()
  await page.locator('[data-testid="slot-1"]').click()
  await page.getByRole('button', { name: /Проверить/i }).click()

  // Ruby fill on incorrect slot
  await expect(page.locator('[data-testid="slot-1"]')).toHaveClass(/bg-ruby/)

  // FeedbackBanner shows incorrect header
  await expect(page.locator('text=არასწორია!')).toBeVisible()

  // Далее button appears even on wrong answer
  await expect(page.getByRole('button', { name: /Далее/i })).toBeVisible()
})

test('SentenceSlotRow — overflow-x auto present and scroll-snap active when 6+ slots', async ({
  page,
}) => {
  await setupApiMocks(page, proMeResponse, mock6SlotQuestion)
  await page.goto('/?playwright=1')
  await page.waitForLoadState('networkidle')
  await navigateToPractice(page, 1)

  await expect(page.locator('[data-testid="sentence-builder-card"]')).toBeVisible()

  // 6 slots should be rendered
  const slots = page.locator('[data-testid^="slot-"]')
  await expect(slots).toHaveCount(6)

  // SentenceSlotRow should have overflow-x: auto
  const slotRow = page.locator('[data-testid="sentence-slot-row"]')
  await expect(slotRow).toBeVisible()

  const overflowX = await slotRow.evaluate(
    (el) => window.getComputedStyle(el).overflowX
  )
  expect(overflowX).toBe('auto')

  // scroll-snap-type is set via inline style
  const scrollSnapType = await slotRow.evaluate(
    (el) => (el as HTMLElement).style.scrollSnapType
  )
  expect(scrollSnapType).toBeTruthy()
})

test('ChipPool — 10+ chips wrap without x-scroll at 375px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await setupApiMocks(page, proMeResponse, mock10ChipQuestion)
  await page.goto('/?playwright=1')
  await page.waitForLoadState('networkidle')
  await navigateToPractice(page, 1)

  await expect(page.locator('[data-testid="sentence-builder-card"]')).toBeVisible()

  // All 10 chips should be visible in pool
  const pool = page.locator('[data-testid="chip-pool"]')
  const chips = pool.locator('button')
  await expect(chips).toHaveCount(10)

  // No horizontal scroll: chips wrap to rows
  const { scrollWidth, clientWidth } = await pool.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }))
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
})

test('SentenceBuilderCard — error fallback renders for question with missing chip in pool', async ({
  page,
}) => {
  await setupApiMocks(page, proMeResponse, mockBrokenQuestion)
  await page.goto('/?playwright=1')
  await page.waitForLoadState('networkidle')
  await navigateToPractice(page, 1)

  await expect(page.locator('[data-testid="sentence-builder-card"]')).toBeVisible()

  // Error fallback must show
  await expect(page.locator('text=Упражнение не загрузилось')).toBeVisible()

  // Retry button present
  const retryBtn = page.getByRole('button', { name: /Попробовать снова/i })
  await expect(retryBtn).toBeVisible()

  // Tap retry → onAnswer(false) → navigates away (lesson completes with 0/1)
  await retryBtn.click()
  await page.waitForTimeout(600)

  // SentenceBuilderCard should no longer be visible (navigated to result screen)
  await expect(page.locator('[data-testid="sentence-builder-card"]')).not.toBeVisible()
})

// ─── Cases L10 — wrong chip order → ruby slot and incorrect FeedbackBanner ──
// AC from issue #876 qa-prep: "Negative case: unordered chip answer in Cases L10
// → ruby slot highlight + answer recorded in «Мои ошибки»"

test('Cases L10 — wrong chip order → ruby slot and incorrect FeedbackBanner', async ({
  page,
}) => {
  await setupCasesL10Mocks(page, mockCasesL10Question)

  let completeLessonPayload: any = null
  await page.route('**/api/miniapp/progress/lesson-complete', async (route) => {
    completeLessonPayload = JSON.parse(route.request().postData() ?? '{}')
    await route.fulfill({ json: { xpEarned: 0, progress: proMeResponse.progress } })
  })

  await page.goto('/?playwright=1')
  await page.waitForLoadState('networkidle')

  await navigateToCasesL10(page)

  await expect(page.locator('[data-testid="sentence-builder-card"]')).toBeVisible({ timeout: 10_000 })

  // Slot 0 is empty (ergative subject კაcMА). Place wrong chip კაcI (nominative) instead.
  // Use exact:true to avoid matching კაcIS or კАcIT in the pool
  await page.locator('[data-testid="chip-pool"]').getByRole('button', { name: 'კაცი', exact: true }).click()
  await page.locator('[data-testid="slot-0"]').click()

  // Проверить should be enabled (slot is filled)
  const verifyBtn = page.getByRole('button', { name: /Проверить/i })
  await expect(verifyBtn).not.toHaveAttribute('aria-disabled', 'true')
  await verifyBtn.click()

  // slot-0 must have ruby fill (incorrect state)
  await expect(page.locator('[data-testid="slot-0"]')).toHaveClass(/bg-ruby/)

  // FeedbackBanner shows incorrect header
  await expect(page.locator('text=არასწორია!')).toBeVisible()

  // Далее button appears even on wrong answer
  await expect(page.getByRole('button', { name: /Далее/i })).toBeVisible()

  // Tap Далее and assert lesson-complete payload has correct: 0
  await page.getByRole('button', { name: /Далее/i }).click()
  await page.waitForTimeout(500)

  expect(completeLessonPayload).toBeTruthy()
  expect(completeLessonPayload.correct).toBe(0)
})

// ─── Shopping L7 mock data (issue #879) ─────────────────────────────────────

// L1 price question: presets at positions 0 (რა) and 1 (ღირს), empty slot = 2 (ჩაი)
// chipPool includes ყავა (coffee) and პური (bread) as price-related distractors
const mockShoppingL7Question = [
  {
    id: 'shopping7-l1-q01',
    questionType: 'sentence-builder',
    targetSentence: { ru: 'Сколько стоит чай?' },
    level: 1,
    correctOrder: ['რა', 'ღირს', 'ჩაი'],
    chipPool: ['რა', 'ღირს', 'ჩაი', 'ყავა', 'პური', 'ყველი'],
    presetPositions: [
      { position: 0, token: 'რა' },
      { position: 1, token: 'ღირს' },
    ],
    hints: { '2': 'Объект в NOM после ღირს' },
    lemma: 'ჩაი',
    question: 'Собери предложение: Сколько стоит чай?',
    options: [],
    answerIndex: 0,
    explanation: 'რა ღირს + объект в именительном (без -ს).',
  },
]

const mockShoppingCatalog = {
  botUsername: 'TraleBot',
  miniAppEnabled: true,
  modules: [
    {
      id: 'shopping',
      title: 'Магазин',
      emoji: '🛒',
      description: 'რა ღირს — вопрос о цене',
      lessons: [
        {
          id: 7,
          title: 'Конструктор: «Сколько стоит?»',
          short: 'L7',
          theory: {
            title: 'Конструктор предложений: вопрос о цене «რა ღირს»',
            goal: 'Собирать вопросительные предложения о цене.',
            blocks: [
              {
                type: 'paragraph',
                text: 'Вопрос о цене: «რა ღირს X?» — «Сколько стоит X?».',
              },
            ],
          },
        },
      ],
    },
  ],
}

async function setupShoppingL7Mocks(page: any, lessonQuestions: object[]) {
  await page.route('**/api/miniapp/content', (route: any) =>
    route.fulfill({ json: mockShoppingCatalog })
  )
  await page.route('**/api/miniapp/me', (route: any) =>
    route.fulfill({ json: proMeResponse })
  )
  await page.route('**/api/miniapp/modules/shopping/lessons/7/questions', (route: any) =>
    route.fulfill({ json: lessonQuestions })
  )
  await page.route('**/api/miniapp/progress/lesson-complete', (route: any) =>
    route.fulfill({ json: { xpEarned: 0, progress: proMeResponse.progress } })
  )
  await page.route('**/api/miniapp/plans', (route: any) =>
    route.fulfill({
      json: {
        plans: [
          {
            id: 'Year',
            payloadId: 'year',
            stars: 900,
            durationDays: 365,
            title: 'Год',
            description: 'Полный год',
          },
        ],
      },
    })
  )
}

async function navigateToShoppingL7(page: any) {
  const moduleTile = page.locator('[data-testid="module-tile-shopping"]')
  await expect(moduleTile).toBeVisible({ timeout: 15_000 })
  await moduleTile.click()
  const lessonBtn = page.locator('[data-testid="lesson-btn-7"]')
  await expect(lessonBtn).toBeVisible({ timeout: 10_000 })
  await lessonBtn.click()
  const practiceBtn = page.getByRole('button', { name: /к практике/i })
  await expect(practiceBtn).toBeVisible({ timeout: 10_000 })
  await practiceBtn.click()
}

// ─── Shopping L7 — price distractor chip in slot → ruby slot + incorrect FeedbackBanner ──
// AC from issue #879 qa-prep: place ყავა (coffee) in the tea slot → ruby highlight + "არასწორია!"

test('Shopping L7 — price distractor chip in slot → ruby slot + incorrect FeedbackBanner', async ({
  page,
}) => {
  await setupShoppingL7Mocks(page, mockShoppingL7Question)

  let completeLessonPayload: any = null
  await page.route('**/api/miniapp/progress/lesson-complete', async (route) => {
    completeLessonPayload = JSON.parse(route.request().postData() ?? '{}')
    await route.fulfill({ json: { xpEarned: 0, progress: proMeResponse.progress } })
  })

  await page.goto('/?playwright=1')
  await page.waitForLoadState('networkidle')

  await navigateToShoppingL7(page)

  await expect(page.locator('[data-testid="sentence-builder-card"]')).toBeVisible({
    timeout: 10_000,
  })

  // Slot 2 is empty (ჩაი = tea). Place price distractor ყავა (coffee) instead.
  await page.locator('[data-testid="chip-pool"]').getByRole('button', { name: 'ყავა', exact: true }).click()
  await page.locator('[data-testid="slot-2"]').click()

  // Проверить should be enabled (slot is filled)
  const verifyBtn = page.getByRole('button', { name: /Проверить/i })
  await expect(verifyBtn).not.toHaveAttribute('aria-disabled', 'true')
  await verifyBtn.click()

  // slot-2 must have ruby fill (incorrect — coffee instead of tea)
  await expect(page.locator('[data-testid="slot-2"]')).toHaveClass(/bg-ruby/)

  // FeedbackBanner shows incorrect header
  await expect(page.locator('text=არასწორია!')).toBeVisible()

  // Далее button appears even on wrong answer
  await expect(page.getByRole('button', { name: /Далее/i })).toBeVisible()

  // Tap Далее → lesson-complete payload must have correct: 0
  await page.getByRole('button', { name: /Далее/i }).click()
  await page.waitForTimeout(500)

  expect(completeLessonPayload).toBeTruthy()
  expect(completeLessonPayload.correct).toBe(0)
})

// ─── PresentTense L7 mock data (issue #877) ──────────────────────────────────

// SOV question: preset slot 0 (subject), empty slots 1 (object) and 2 (verb)
const mockPresentTenseL7Question = [
  {
    id: 'present7-l1-q01',
    questionType: 'sentence-builder',
    targetSentence: { ru: 'Я читаю книгу' },
    level: 1,
    correctOrder: ['მე', 'წიგნს', 'ვკითხულობ'],
    chipPool: ['მე', 'წიგნს', 'ვკითხულობ', 'კითხულობს', 'ვწერ'],
    presetPositions: [{ position: 0, token: 'მე' }],
    hints: { '2': '-ვ- у 1 лица, Кл.1 глагол' },
    lemma: 'ვკითხულობ',
    question: 'Собери предложение: Я читаю книгу',
    options: [],
    answerIndex: 0,
    explanation: 'SOV: субъект + объект в дат. + глагол в конце.',
  },
]

const mockPresentTenseCatalog = {
  botUsername: 'TraleBot',
  miniAppEnabled: true,
  modules: [
    {
      id: 'present-tense',
      title: 'Настоящее время',
      emoji: '⏰',
      description: 'ვარ, მაქვს, ვაკეთებ',
      lessons: [
        {
          id: 7,
          title: 'Конструктор: SOV',
          short: 'L7',
          theory: {
            title: 'Конструктор предложений: SOV порядок',
            goal: 'Собирать предложения в порядке Subject-Object-Verb.',
            blocks: [
              {
                type: 'paragraph',
                text: 'Порядок слов: Subject-Object-Verb (SOV). Глагол в конце.',
              },
            ],
          },
        },
      ],
    },
  ],
}

async function setupPresentTenseL7Mocks(page: any, lessonQuestions: object[]) {
  await page.route('**/api/miniapp/content', (route: any) =>
    route.fulfill({ json: mockPresentTenseCatalog })
  )
  await page.route('**/api/miniapp/me', (route: any) =>
    route.fulfill({ json: proMeResponse })
  )
  await page.route('**/api/miniapp/modules/present-tense/lessons/7/questions', (route: any) =>
    route.fulfill({ json: lessonQuestions })
  )
  await page.route('**/api/miniapp/progress/lesson-complete', (route: any) =>
    route.fulfill({ json: { xpEarned: 0, progress: proMeResponse.progress } })
  )
  await page.route('**/api/miniapp/plans', (route: any) =>
    route.fulfill({
      json: {
        plans: [
          {
            id: 'Year',
            payloadId: 'year',
            stars: 900,
            durationDays: 365,
            title: 'Год',
            description: 'Полный год',
          },
        ],
      },
    })
  )
}

async function navigateToPresentTenseL7(page: any) {
  const moduleTile = page.locator('[data-testid="module-tile-present-tense"]')
  await expect(moduleTile).toBeVisible({ timeout: 15_000 })
  await moduleTile.click()
  const lessonBtn = page.locator('[data-testid="lesson-btn-7"]')
  await expect(lessonBtn).toBeVisible({ timeout: 10_000 })
  await lessonBtn.click()
  const practiceBtn = page.getByRole('button', { name: /к практике/i })
  await expect(practiceBtn).toBeVisible({ timeout: 10_000 })
  await practiceBtn.click()
}

// ─── Cafe L7 mock data (issue #878) ─────────────────────────────────────────

// L1 coffee question: presets at positions 0 (მე) and 1 (მINDA), empty slot = 2 (ყАVА)
// chipPool includes ჩАΙ (tea) and წყАLΙ (water) as distractors
const mockCafeL7Question = [
  {
    id: 'cafe7-l1-q01',
    questionType: 'sentence-builder',
    targetSentence: { ru: 'Я хочу кофе' },
    level: 1,
    correctOrder: ['მე', 'მინდა', 'ყავა'],
    chipPool: ['მე', 'შენ', 'მინდა', 'ყავა', 'ჩაი', 'წყალი'],
    presetPositions: [
      { position: 0, token: 'მე' },
      { position: 1, token: 'მინდა' },
    ],
    hints: { '2': 'ყавα = кофе' },
    lemma: 'ყავა',
    question: 'Собери предложение: Я хочу кофе',
    explanation: 'მINDA + объект в именительном (без -ს).',
  },
]

const mockCafeCatalog = {
  botUsername: 'TraleBot',
  miniAppEnabled: true,
  modules: [
    {
      id: 'cafe',
      title: 'В кафе',
      emoji: '☕',
      description: 'მENIU, შEKVETA, АНГАРИши',
      lessons: [
        {
          id: 7,
          title: 'Конструктор: Я хочу…',
          short: 'L7',
          theory: {
            title: 'Конструктор предложений: заказ в кафе',
            goal: 'Собирать фразы-заказы по шаблону «мINDA X».',
            blocks: [
              {
                type: 'paragraph',
                text: 'Шаблон заказа: мINDA + существительное. Я хочу = мINDA.',
              },
            ],
          },
        },
      ],
    },
  ],
}

async function setupCafeL7Mocks(page: any, lessonQuestions: object[]) {
  await page.route('**/api/miniapp/content', (route: any) =>
    route.fulfill({ json: mockCafeCatalog })
  )
  await page.route('**/api/miniapp/me', (route: any) =>
    route.fulfill({ json: proMeResponse })
  )
  await page.route('**/api/miniapp/modules/cafe/lessons/7/questions', (route: any) =>
    route.fulfill({ json: lessonQuestions })
  )
  await page.route('**/api/miniapp/progress/lesson-complete', (route: any) =>
    route.fulfill({ json: { xpEarned: 0, progress: proMeResponse.progress } })
  )
  await page.route('**/api/miniapp/plans', (route: any) =>
    route.fulfill({
      json: {
        plans: [
          {
            id: 'Year',
            payloadId: 'year',
            stars: 900,
            durationDays: 365,
            title: 'Год',
            description: 'Полный год',
          },
        ],
      },
    })
  )
}

async function navigateToCafeL7(page: any) {
  const moduleTile = page.locator('[data-testid="module-tile-cafe"]')
  await expect(moduleTile).toBeVisible({ timeout: 15_000 })
  await moduleTile.click()
  const lessonBtn = page.locator('[data-testid="lesson-btn-7"]')
  await expect(lessonBtn).toBeVisible({ timeout: 10_000 })
  await lessonBtn.click()
  const practiceBtn = page.getByRole('button', { name: /к практике/i })
  await expect(practiceBtn).toBeVisible({ timeout: 10_000 })
  await practiceBtn.click()
}

// ─── Cafe L7 — distractor chip (tea) in wrong slot → ruby slot + incorrect FeedbackBanner ──
// AC from issue #878 qa-prep: place ჩАΙ (tea) in the coffee slot → ruby highlight + "არАsworIA!"

test('Cafe L7 — distractor chip (tea) in wrong slot → ruby slot + incorrect FeedbackBanner', async ({
  page,
}) => {
  await setupCafeL7Mocks(page, mockCafeL7Question)

  let completeLessonPayload: any = null
  await page.route('**/api/miniapp/progress/lesson-complete', async (route) => {
    completeLessonPayload = JSON.parse(route.request().postData() ?? '{}')
    await route.fulfill({ json: { xpEarned: 0, progress: proMeResponse.progress } })
  })

  await page.goto('/?playwright=1')
  await page.waitForLoadState('networkidle')

  await navigateToCafeL7(page)

  await expect(page.locator('[data-testid="sentence-builder-card"]')).toBeVisible({
    timeout: 10_000,
  })

  // Slot 2 is empty (coffee: ყАVА). Place distractor ჩАΙ (tea) instead.
  await page.locator('[data-testid="chip-pool"]').getByRole('button', { name: 'ჩაი', exact: true }).click()
  await page.locator('[data-testid="slot-2"]').click()

  // Проверить should be enabled (slot is filled)
  const verifyBtn = page.getByRole('button', { name: /Проверить/i })
  await expect(verifyBtn).not.toHaveAttribute('aria-disabled', 'true')
  await verifyBtn.click()

  // slot-2 must have ruby fill (incorrect state — tea instead of coffee)
  await expect(page.locator('[data-testid="slot-2"]')).toHaveClass(/bg-ruby/)

  // FeedbackBanner shows incorrect header
  await expect(page.locator('text=არასწორია!')).toBeVisible()

  // Далее button appears even on wrong answer
  await expect(page.getByRole('button', { name: /Далее/i })).toBeVisible()

  // Tap Далее → lesson-complete payload must have correct: 0
  await page.getByRole('button', { name: /Далее/i }).click()
  await page.waitForTimeout(500)

  expect(completeLessonPayload).toBeTruthy()
  expect(completeLessonPayload.correct).toBe(0)
})

// ─── PresentTense L7 — wrong order → ruby slot + incorrect FeedbackBanner ───
// AC from issue #877 qa-prep: tap VSO arrangement (verb before object) →
// ruby slot highlight + FeedbackBanner "არასწორია!" + lesson-complete correct: 0

test('PresentTense L7 — wrong order → ruby slot + incorrect FeedbackBanner', async ({
  page,
}) => {
  await setupPresentTenseL7Mocks(page, mockPresentTenseL7Question)

  let completeLessonPayload: any = null
  await page.route('**/api/miniapp/progress/lesson-complete', async (route) => {
    completeLessonPayload = JSON.parse(route.request().postData() ?? '{}')
    await route.fulfill({ json: { xpEarned: 0, progress: proMeResponse.progress } })
  })

  await page.goto('/?playwright=1')
  await page.waitForLoadState('networkidle')

  await navigateToPresentTenseL7(page)

  await expect(page.locator('[data-testid="sentence-builder-card"]')).toBeVisible({
    timeout: 10_000,
  })

  // Tap verb ვკითხულობ first → placed in slot-1 (wrong: SVO instead of SOV)
  await page.locator('[data-testid="chip-pool"]').getByRole('button', { name: 'ვკითხულობ', exact: true }).click()
  await page.locator('[data-testid="slot-1"]').click()

  // Tap object წიგნს → placed in slot-2
  await page.locator('[data-testid="chip-pool"]').getByRole('button', { name: 'წიგნს', exact: true }).click()
  await page.locator('[data-testid="slot-2"]').click()

  // Проверить must be enabled (both empty slots filled)
  const verifyBtn = page.getByRole('button', { name: /Проверить/i })
  await expect(verifyBtn).not.toHaveAttribute('aria-disabled', 'true')
  await verifyBtn.click()

  // slot-1 must show ruby fill (wrong answer — verb placed before object)
  await expect(page.locator('[data-testid="slot-1"]')).toHaveClass(/bg-ruby/)

  // FeedbackBanner shows incorrect header
  await expect(page.locator('text=არასწორია!')).toBeVisible()

  // Далее button appears even on wrong answer
  await expect(page.getByRole('button', { name: /Далее/i })).toBeVisible()

  // Tap Далее → lesson-complete payload must have correct: 0
  await page.getByRole('button', { name: /Далее/i }).click()
  await page.waitForTimeout(500)

  expect(completeLessonPayload).toBeTruthy()
  expect(completeLessonPayload.correct).toBe(0)
})

// ─── Taxi L7 mock data (issue #880) ──────────────────────────────────────────

// L1 destination question: preset at position 0 (წავიდეთ), empty slot = 1 (ბათუმshi)
// chipPool includes -ზე and -თAN postposition distractors to force discrimination
const mockTaxiL7Question = [
  {
    id: 'taxi7-l1-q01',
    questionType: 'sentence-builder',
    targetSentence: { ru: 'Поехали в Батуми' },
    level: 1,
    correctOrder: ['წავიდეთ', 'ბათუმში'],
    chipPool: ['წავიდეთ', 'ბათუმში', 'თბილისში', 'ქუთაისში', 'ბათუმზე', 'ბათუმთან'],
    presetPositions: [{ position: 0, token: 'წავიდეთ' }],
    hints: { '1': 'место назначения — в конце' },
    lemma: 'ბათუმში',
    question: 'Собери предложение: Поехали в Батуми',
    options: [],
    answerIndex: 0,
    explanation: 'Место назначения (-ши) стоит в конце (SOV + destination-final).',
  },
]

const mockTaxiCatalog = {
  botUsername: 'TraleBot',
  miniAppEnabled: true,
  modules: [
    {
      id: 'taxi',
      title: 'Такси и город',
      emoji: '🚕',
      description: 'ტაქსი, გაჩერება, მარცხენა',
      lessons: [
        {
          id: 7,
          title: 'Конструктор: «Поехали в Батуми»',
          short: 'L7',
          theory: {
            title: 'Конструктор предложений: место назначения',
            goal: 'Собирать фразы о направлении.',
            blocks: [
              {
                type: 'paragraph',
                text: 'Место назначения — в конце предложения (SOV). Постпозиция -ши (-ში) показывает направление.',
              },
            ],
          },
        },
      ],
    },
  ],
}

async function setupTaxiL7Mocks(page: any, lessonQuestions: object[]) {
  await page.route('**/api/miniapp/content', (route: any) =>
    route.fulfill({ json: mockTaxiCatalog })
  )
  await page.route('**/api/miniapp/me', (route: any) =>
    route.fulfill({ json: proMeResponse })
  )
  await page.route('**/api/miniapp/modules/taxi/lessons/7/questions', (route: any) =>
    route.fulfill({ json: lessonQuestions })
  )
  await page.route('**/api/miniapp/progress/lesson-complete', (route: any) =>
    route.fulfill({ json: { xpEarned: 0, progress: proMeResponse.progress } })
  )
  await page.route('**/api/miniapp/plans', (route: any) =>
    route.fulfill({
      json: {
        plans: [
          {
            id: 'Year',
            payloadId: 'year',
            stars: 900,
            durationDays: 365,
            title: 'Год',
            description: 'Полный год',
          },
        ],
      },
    })
  )
}

async function navigateToTaxiL7(page: any) {
  const moduleTile = page.locator('[data-testid="module-tile-taxi"]')
  await expect(moduleTile).toBeVisible({ timeout: 15_000 })
  await moduleTile.click()
  const lessonBtn = page.locator('[data-testid="lesson-btn-7"]')
  await expect(lessonBtn).toBeVisible({ timeout: 10_000 })
  await lessonBtn.click()
  const practiceBtn = page.getByRole('button', { name: /к практике/i })
  await expect(practiceBtn).toBeVisible({ timeout: 10_000 })
  await practiceBtn.click()
}

// ─── Taxi L7 — wrong city in destination slot → ruby slot + incorrect FeedbackBanner ──
// AC from issue #880 qa-prep: wrong destination city → ruby highlight + "არასწორია!"

test('Taxi L7 — destination chip placed in wrong position → ruby slot + incorrect FeedbackBanner', async ({
  page,
}) => {
  await setupTaxiL7Mocks(page, mockTaxiL7Question)

  let completeLessonPayload: any = null
  await page.route('**/api/miniapp/progress/lesson-complete', async (route) => {
    completeLessonPayload = JSON.parse(route.request().postData() ?? '{}')
    await route.fulfill({ json: { xpEarned: 0, progress: proMeResponse.progress } })
  })

  await page.goto('/?playwright=1')
  await page.waitForLoadState('networkidle')

  await navigateToTaxiL7(page)

  await expect(page.locator('[data-testid="sentence-builder-card"]')).toBeVisible({
    timeout: 10_000,
  })

  // Slot 1 is empty (correct = ბათუმში). Place wrong city (თბილისshi) instead.
  await page.locator('[data-testid="chip-pool"]').getByRole('button', { name: 'თბილისში', exact: true }).click()
  await page.locator('[data-testid="slot-1"]').click()

  const verifyBtn = page.getByRole('button', { name: /Проверить/i })
  await expect(verifyBtn).not.toHaveAttribute('aria-disabled', 'true')
  await verifyBtn.click()

  await expect(page.locator('[data-testid="slot-1"]')).toHaveClass(/bg-ruby/)
  await expect(page.locator('text=არასწორია!')).toBeVisible()
  await expect(page.getByRole('button', { name: /Далее/i })).toBeVisible()

  await page.getByRole('button', { name: /Далее/i }).click()
  await page.waitForTimeout(500)

  expect(completeLessonPayload).toBeTruthy()
  expect(completeLessonPayload.correct).toBe(0)
})

// ─── Taxi L7 — wrong postposition (-ზე vs -ში) in destination slot → ruby highlight ──
// AC from issue #880 qa-prep: wrong postposition form → ruby slot

test('Taxi L7 — wrong postposition distractor (-ზე vs -ში) in destination slot → ruby highlight', async ({
  page,
}) => {
  await setupTaxiL7Mocks(page, mockTaxiL7Question)

  let completeLessonPayload: any = null
  await page.route('**/api/miniapp/progress/lesson-complete', async (route) => {
    completeLessonPayload = JSON.parse(route.request().postData() ?? '{}')
    await route.fulfill({ json: { xpEarned: 0, progress: proMeResponse.progress } })
  })

  await page.goto('/?playwright=1')
  await page.waitForLoadState('networkidle')

  await navigateToTaxiL7(page)

  await expect(page.locator('[data-testid="sentence-builder-card"]')).toBeVisible({
    timeout: 10_000,
  })

  // Slot 1 is empty (correct = ბათუმshi). Place postposition distractor ბათუმზე (-ზе) instead.
  await page.locator('[data-testid="chip-pool"]').getByRole('button', { name: 'ბათუმზე', exact: true }).click()
  await page.locator('[data-testid="slot-1"]').click()

  const verifyBtn = page.getByRole('button', { name: /Проверить/i })
  await expect(verifyBtn).not.toHaveAttribute('aria-disabled', 'true')
  await verifyBtn.click()

  // wrong postposition (-ზе instead of -ши) → ruby fill
  await expect(page.locator('[data-testid="slot-1"]')).toHaveClass(/bg-ruby/)
  await expect(page.locator('text=არასწორია!')).toBeVisible()

  await page.getByRole('button', { name: /Далее/i }).click()
  await page.waitForTimeout(500)

  expect(completeLessonPayload).toBeTruthy()
  expect(completeLessonPayload.correct).toBe(0)
})
