import { test, expect } from '@playwright/test'

// ─── Mock data ────────────────────────────────────────────────────────────────

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

const verbalAspectCatalog = {
  botUsername: 'TraleBot',
  miniAppEnabled: true,
  modules: [
    {
      id: 'verbal-aspect',
      title: 'Вид глагола',
      emoji: '🔄',
      description: 'Несовершенный и совершенный вид',
      lessons: [
        {
          id: 1,
          title: 'Вид глагола — обзор',
          short: 'L1',
          theory: {
            title: 'Вид глагола: несовершенный и совершенный',
            goal: 'Понять разницу между несовершенным и совершенным видом глагола.',
            blocks: [
              {
                type: 'table',
                table: {
                  colHeader1: 'Прошедшее',
                  colHeader2: 'Настоящее + Будущее',
                  rows: [
                    {
                      label: 'Несовершенный вид',
                      cell1: {
                        ge: 'ვწერდი',
                        translit: "vts'erdi",
                        ru: 'я писал',
                        disabled: false,
                      },
                      cell2: {
                        ge: 'ვწერ',
                        translit: "vts'er",
                        ru: 'я пишу',
                        disabled: false,
                      },
                    },
                    {
                      label: 'Совершенный вид',
                      cell1: {
                        ge: 'დავწერე',
                        translit: "davts'ere",
                        ru: 'я написал',
                        disabled: false,
                      },
                      cell2: {
                        ge: null,
                        translit: null,
                        ru: null,
                        disabled: true,
                        placeholder: 'Будущее время — разберём в следующем модуле',
                      },
                    },
                  ],
                },
              },
              {
                type: 'paragraph',
                text: 'Несовершенный = действие продолжается или повторяется; Совершенный = действие завершено или однократно.',
              },
              {
                type: 'paragraph',
                text: 'Вид выражается превербами და-, გა-, შე-... а не разными словами.',
              },
            ],
          },
        },
      ],
    },
  ],
}

const verbalAspectQuestions = [
  {
    id: 'va_q01',
    lemma: 'ვწერდი',
    question: '«Я писал письма каждый день» — несовершенный вид, прошедшее. Выберите грузинскую форму:',
    options: ['ვწერდი', 'დავწერე', 'ვწერ'],
    answer_index: 0,
    explanation: 'ვწერდი — имперфект. Ячейка таблицы 2×2: Несовершенный вид / Прошедшее = Imperfect (несов. прошл.).',
    questionType: 'multiple-choice',
    answerIndex: 0,
  },
  {
    id: 'va_q02',
    lemma: 'დავწერე',
    question: '«Я написал письмо» — совершенный вид, завершённое. Выберите грузинскую форму:',
    options: ['დავწერე', 'ვწერდი', 'ვწერ'],
    answer_index: 0,
    explanation: 'დავწერე — аорист. Ячейка таблицы 2×2: Совершенный вид / Прошедшее = Aorist (сов. прошл.).',
    questionType: 'multiple-choice',
    answerIndex: 0,
  },
  {
    id: 'va_q03',
    lemma: 'ვწერდი',
    question: '«Когда зазвонил телефон, я _____ письмо» — фоновое продолжительное действие. Выберите форму:',
    options: ['ვწერდი', 'დავწერე', 'ვწერ'],
    answer_index: 0,
    explanation: 'Фоновое действие продолжалось → продолжительное → несовершенный вид → Imperfect (ვწერდი).',
    questionType: 'multiple-choice',
    answerIndex: 0,
  },
  {
    id: 'va_q04',
    lemma: 'დავწერე',
    question: '«Вчера я _____ письмо другу» — завершённое однократное действие. Выберите форму:',
    options: ['დავწერე', 'ვწერდი', 'ვწერ'],
    answer_index: 0,
    explanation: 'Завершённое действие → совершенный вид → Aorist (დავწერე). Действие однократно и завершено.',
    questionType: 'multiple-choice',
    answerIndex: 0,
  },
  {
    id: 'va_q05',
    lemma: 'ვწერდი',
    question: '«ყოველ დღეს я _____ в дневнике» — хабитуальное регулярное действие. Выберите форму:',
    options: ['ვწერდი', 'დავწერე', 'ვწერ'],
    answer_index: 0,
    explanation: 'ყოველ დღეს → несовершенный вид → Imperfect (ვწერდი). Регулярное хабитуальное действие выражается имперфектом.',
    questionType: 'multiple-choice',
    answerIndex: 0,
  },
  {
    id: 'va_q06',
    lemma: 'დავწერე',
    question: '«Однажды я _____ длинное письмо» — разовое действие. Выберите форму:',
    options: ['დავწერე', 'ვწერდი', 'ვწერ'],
    answer_index: 0,
    explanation: 'Разовое действие: однократное → совершенный вид → Aorist (დავწერე). Не хабитуальное.',
    questionType: 'multiple-choice',
    answerIndex: 0,
  },
]

async function setupVerbalAspectMocks(page: any) {
  await page.route('**/api/miniapp/content', (route: any) =>
    route.fulfill({ json: verbalAspectCatalog })
  )
  await page.route('**/api/miniapp/me', (route: any) =>
    route.fulfill({ json: proMeResponse })
  )
  await page.route('**/api/miniapp/modules/verbal-aspect/lessons/1/questions', (route: any) =>
    route.fulfill({ json: verbalAspectQuestions })
  )
  await page.route('**/api/miniapp/progress/lesson-complete', (route: any) =>
    route.fulfill({ json: { xpEarned: 10, progress: proMeResponse.progress } })
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

test.beforeEach(async ({ page }) => {
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

async function navigateToVerbalAspectTheory(page: any) {
  const moduleTile = page.locator('[data-testid="module-tile-verbal-aspect"]')
  await expect(moduleTile).toBeVisible({ timeout: 15_000 })
  await moduleTile.click()
  const lessonBtn = page.locator('[data-testid="lesson-btn-1"]')
  await expect(lessonBtn).toBeVisible({ timeout: 10_000 })
  await lessonBtn.click()
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test('theory-block renders 2x2 table with three active cells and one grey Future placeholder', async ({
  page,
}) => {
  await setupVerbalAspectMocks(page)
  await page.goto('/?playwright=1')
  await page.waitForLoadState('networkidle')

  await navigateToVerbalAspectTheory(page)

  // Theory screen must be visible
  await expect(page.locator('[data-testid="lesson-theory"]')).toBeVisible({ timeout: 10_000 })

  // Three active (non-disabled) cells must be present
  const activeCells = page.locator('[data-testid="aspect-table-cell"]:not([data-disabled])')
  await expect(activeCells).toHaveCount(3)

  // One disabled Future cell
  const disabledCells = page.locator('[data-testid="aspect-table-cell"][data-disabled]')
  await expect(disabledCells).toHaveCount(1)
})

test('theory-block contains key-row text and preverb disclaimer', async ({ page }) => {
  await setupVerbalAspectMocks(page)
  await page.goto('/?playwright=1')
  await page.waitForLoadState('networkidle')

  await navigateToVerbalAspectTheory(page)

  await expect(page.locator('[data-testid="lesson-theory"]')).toBeVisible({ timeout: 10_000 })

  // Key-row text about imperfective/perfective
  await expect(
    page.getByText(/Несовершенный = действие продолжается/i)
  ).toBeVisible()

  // Preverb disclaimer
  await expect(page.getByText(/Вид выражается превербами/i)).toBeVisible()
})

test('future-cell contains only placeholder text, no Georgian verb form', async ({ page }) => {
  await setupVerbalAspectMocks(page)
  await page.goto('/?playwright=1')
  await page.waitForLoadState('networkidle')

  await navigateToVerbalAspectTheory(page)

  await expect(page.locator('[data-testid="lesson-theory"]')).toBeVisible({ timeout: 10_000 })

  const disabledCell = page.locator('[data-testid="aspect-table-cell"][data-disabled]')
  await expect(disabledCell).toBeVisible()

  // Must show placeholder text
  await expect(disabledCell).toContainText('Будущее время')

  // Must NOT contain Georgian script (active form like და, ვწ etc.)
  const cellText = await disabledCell.textContent()
  expect(cellText).not.toMatch(/[ა-ჰ]/)
})

test('practice-questions-visible-during-module-walkthrough', async ({ page }) => {
  await setupVerbalAspectMocks(page)
  await page.goto('/?playwright=1')
  await page.waitForLoadState('networkidle')

  // Navigate to lesson theory first
  await navigateToVerbalAspectTheory(page)
  await expect(page.locator('[data-testid="lesson-theory"]')).toBeVisible({ timeout: 10_000 })

  // Click "к практике" to enter practice mode
  const practiceBtn = page.getByRole('button', { name: /к практике/i })
  await expect(practiceBtn).toBeVisible({ timeout: 10_000 })
  await practiceBtn.click()

  // Practice screen must render with the recognition question visible
  const questionText = page.getByText(/несовершенный вид, прошедшее/i)
  await expect(questionText).toBeVisible({ timeout: 10_000 })

  // All three option buttons must be visible (ვწერდი, დავწერე, ვწერ)
  const optionButtons = page.getByRole('button').filter({ hasText: /ვწერდი|დავწერე|ვწერ/ })
  await expect(optionButtons).toHaveCount(3)

  // Select the correct answer (first option: ვწერდი)
  await optionButtons.filter({ hasText: 'ვწერდი' }).first().click()

  // For choice questions, click "проверить" to submit the answer
  const checkBtn = page.getByRole('button', { name: /проверить/i })
  await expect(checkBtn).toBeVisible({ timeout: 5_000 })
  await checkBtn.click()

  // Verify green feedback banner appears — "სწორია!" = correct
  const feedbackBanner = page.getByText(/სწორია/i)
  await expect(feedbackBanner).toBeVisible({ timeout: 5_000 })

  // Explanation must mention the aspect table cell
  await expect(page.getByText(/имперфект/i)).toBeVisible()
})

test('incorrect-answer-shows-red-feedback-with-correct-answer-revealed', async ({ page }) => {
  await setupVerbalAspectMocks(page)
  await page.goto('/?playwright=1')
  await page.waitForLoadState('networkidle')

  await navigateToVerbalAspectTheory(page)
  await expect(page.locator('[data-testid="lesson-theory"]')).toBeVisible({ timeout: 10_000 })

  const practiceBtn = page.getByRole('button', { name: /к практике/i })
  await expect(practiceBtn).toBeVisible({ timeout: 10_000 })
  await practiceBtn.click()

  // Recognition question appears (Q1: «Я писал письма каждый день»)
  await expect(page.getByText(/несовершенный вид, прошедшее/i)).toBeVisible({ timeout: 10_000 })

  // Select wrong answer: 'დავწერე' (index 1, incorrect for va_q01 where correct is ვწერდი)
  const wrongOption = page.getByRole('button').filter({ hasText: 'დავწერე' }).first()
  await expect(wrongOption).toBeVisible({ timeout: 5_000 })
  await wrongOption.click()

  const checkBtn = page.getByRole('button', { name: /проверить/i })
  await expect(checkBtn).toBeVisible({ timeout: 5_000 })
  await checkBtn.click()

  // Red feedback banner must appear — "არასწორია!" is the Georgian for "incorrect"
  await expect(page.getByText('არასწორია!')).toBeVisible({ timeout: 5_000 })

  // Explanation reveals the correct answer in context (имперфект)
  await expect(page.getByText(/имперфект/i)).toBeVisible()
})

test('correct-answers-produce-green-feedback-for-recognition-context-habitual-questions', async ({
  page,
}) => {
  await setupVerbalAspectMocks(page)
  await page.goto('/?playwright=1')
  await page.waitForLoadState('networkidle')

  await navigateToVerbalAspectTheory(page)
  await expect(page.locator('[data-testid="lesson-theory"]')).toBeVisible({ timeout: 10_000 })

  const practiceBtn = page.getByRole('button', { name: /к практике/i })
  await expect(practiceBtn).toBeVisible({ timeout: 10_000 })
  await practiceBtn.click()

  // Helper: click correct option by text, submit, optionally assert green, then proceed
  async function answerCorrectly(correctText: string, assertGreen: boolean) {
    const btn = page.getByRole('button').filter({ hasText: correctText }).first()
    await expect(btn).toBeVisible({ timeout: 10_000 })
    await btn.click()
    const check = page.getByRole('button', { name: /проверить/i })
    await expect(check).toBeVisible({ timeout: 5_000 })
    await check.click()
    if (assertGreen) {
      await expect(page.getByText('სწორია!')).toBeVisible({ timeout: 5_000 })
    }
    const next = page.getByRole('button', { name: /дальше →/i })
    await expect(next).toBeVisible({ timeout: 5_000 })
    await next.click()
    // Wait for transition: feedback banner must disappear before interacting with next question
    await expect(page.getByText('სწორია!')).not.toBeVisible({ timeout: 5_000 })
  }

  // Q1 — Recognition (Несовершенный вид / Прошедшее): ვწერდი is correct
  await expect(page.getByText(/несовершенный вид, прошедшее/i)).toBeVisible({ timeout: 10_000 })
  await answerCorrectly('ვწერდი', true) // verify green for recognition

  // Q2 — Recognition (Совершенный вид / Прошедшее): დავწერე is correct; no assertion needed
  await expect(page.getByText(/совершенный вид, завершённое/i)).toBeVisible({ timeout: 10_000 })
  await answerCorrectly('დავწერე', false)

  // Q3 — Context (background imperfect): ვწერდი is correct
  await expect(page.getByText(/Когда зазвонил телефон/i)).toBeVisible({ timeout: 10_000 })
  await answerCorrectly('ვწერდი', true) // verify green for context

  // Q4 — Context (perfective aorist): დავწერე is correct; no assertion needed
  await expect(page.getByText(/Вчера я/i)).toBeVisible({ timeout: 10_000 })
  await answerCorrectly('დავწერე', false)

  // Q5 — Habitual (ყოველ დღეს): ვწერდი is correct
  await expect(page.getByText(/ყოველ დღეს/i)).toBeVisible({ timeout: 10_000 })
  const habitualBtn = page.getByRole('button').filter({ hasText: 'ვწერდი' }).first()
  await expect(habitualBtn).toBeVisible({ timeout: 5_000 })
  await habitualBtn.click()
  const checkHabitual = page.getByRole('button', { name: /проверить/i })
  await checkHabitual.click()
  // Green feedback must appear for habitual question
  await expect(page.getByText('სწორია!')).toBeVisible({ timeout: 5_000 })
})
