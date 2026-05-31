import { test, expect } from '@playwright/test'

// ─── Mock data ────────────────────────────────────────────────────────────────

const mockVerbalAspectCatalog = {
  botUsername: 'TraleBot',
  miniAppEnabled: true,
  modules: [
    {
      id: 'verbal-aspect',
      title: 'Вид глагола',
      emoji: '⚡',
      description: 'Несовершенный и Совершенный вид',
      lessons: [
        {
          id: 1,
          title: 'Два вида — одна таблица',
          short: 'Вид глагола',
          theory: {
            title: 'Вид глагола: таблица 2×2',
            goal: 'Понять разницу между несовершенным и совершенным видом',
            blocks: [
              {
                type: 'paragraph',
                text: 'Грузинский глагол бывает двух видов: несовершенный (действие длилось или повторялось) и совершенный (действие завершено или произошло один раз). Посмотрим на глагол ვწერ- (писать).',
              },
              {
                type: 'verbal-aspect-table',
                rowHeaders: ['Несовершенный', 'Совершенный'],
                colHeaders: ['Прошлое', 'Настоящее+Будущее'],
                cells: [
                  { ge: 'ვწერდი', translit: "v-ts'erdi", ru: 'я писал' },
                  { ge: 'ვწერ', translit: "v-ts'er", ru: 'я пишу' },
                  { ge: 'დავწერე', translit: "da-v-ts'ere", ru: 'я написал' },
                  {
                    disabled: true,
                    placeholderText: 'Будущее время — разберём в следующем модуле',
                  },
                ],
              },
              {
                type: 'paragraph',
                text: 'Несовершенный = действие продолжается или повторяется; Совершенный = действие завершено или однократно.',
              },
              {
                type: 'paragraph',
                text: 'Вид выражается превербами და-, გა-, შე- и другими — не разными словами, как в русском.',
              },
            ],
          },
        },
      ],
    },
  ],
}

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function setupMocks(page: any) {
  await page.route('**/api/miniapp/content', (route: any) =>
    route.fulfill({ json: mockVerbalAspectCatalog })
  )
  await page.route('**/api/miniapp/me', (route: any) =>
    route.fulfill({ json: proMeResponse })
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
  await page.route('**/api/miniapp/modules/verbal-aspect/lessons/1/questions', (route: any) =>
    route.fulfill({ json: [] })
  )
}

async function navigateToVerbalAspectTheory(page: any) {
  const moduleTile = page.locator('[data-testid="module-tile-verbal-aspect"]')
  await expect(moduleTile).toBeVisible({ timeout: 15_000 })
  await moduleTile.click()
  const lessonBtn = page.locator('[data-testid="lesson-btn-1"]')
  await expect(lessonBtn).toBeVisible({ timeout: 10_000 })
  await lessonBtn.click()
}

// ─── Tests ────────────────────────────────────────────────────────────────────

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

test('theory-block renders 2x2 table with three active cells and one grey Future placeholder', async ({
  page,
}) => {
  await setupMocks(page)
  await page.goto('/?playwright=1')
  await page.waitForLoadState('networkidle')
  await navigateToVerbalAspectTheory(page)

  // Three active cells (no data-disabled attribute)
  const activeCells = page.locator('[data-cell-type="verbal-aspect-active"]')
  await expect(activeCells).toHaveCount(3, { timeout: 10_000 })

  // One disabled/grey Future cell
  const disabledCell = page.locator('[data-disabled="true"]')
  await expect(disabledCell).toHaveCount(1)
  await expect(disabledCell).toBeVisible()
})

test('theory-block contains key-row text and preverb disclaimer', async ({ page }) => {
  await setupMocks(page)
  await page.goto('/?playwright=1')
  await page.waitForLoadState('networkidle')
  await navigateToVerbalAspectTheory(page)

  // Key row: Несовершенный = ...
  await expect(
    page.getByText(/Несовершенный = действие продолжается или повторяется/i)
  ).toBeVisible({ timeout: 10_000 })

  // Preverb disclaimer
  await expect(
    page.getByText(/Вид выражается превербами/i)
  ).toBeVisible()
})

test('future-cell contains only placeholder text, no Georgian verb form', async ({ page }) => {
  await setupMocks(page)
  await page.goto('/?playwright=1')
  await page.waitForLoadState('networkidle')
  await navigateToVerbalAspectTheory(page)

  const disabledCell = page.locator('[data-disabled="true"]')
  await expect(disabledCell).toBeVisible({ timeout: 10_000 })

  // Placeholder text must be present
  await expect(disabledCell).toContainText('Будущее время')

  // No Georgian verb form — the cell must NOT contain ვ (common Georgian letter in verb forms)
  const cellText = await disabledCell.textContent()
  expect(cellText).not.toMatch(/^ვ/)
  // Active verb forms start with ვ (ვწერდი, ვწერ, დავწერე) — disabled cell must not show a Georgian form
  expect(cellText).not.toContain('ვწერ')
  expect(cellText).not.toContain('დავწერ')
})
