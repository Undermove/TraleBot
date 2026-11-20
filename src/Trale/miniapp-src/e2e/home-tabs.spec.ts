import { test, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

// Главная — «Сегодня»: Бомбора и один план дня. Всё остальное — вкладками внизу: «Курс» (все модули),
// «Глаголы», «Словарь». У корней вкладок нет «Назад», из модуля «Назад» ведёт в «Курс», нажатия пишутся в AppEvents.

test.use({ viewport: { width: 375, height: 667 } })

const me = {
  authenticated: true, isPro: true, isTrialActive: false, trialDaysLeft: 0, hasAccess: true,
  level: 'beginner', vocabularyCount: 1,
  progress: {
    xp: 120, streak: 3, lastPlayedAtUtc: null, xpSpent: 0, totalTreatsGiven: 0, lastFedAtUtc: null, lastTreatIndex: null,
    completedLessons: { 'alphabet-progressive': [1, 2], intro: [1] }
  }
}

const lesson = (id: number) => ({ id, title: `Урок ${id}`, short: `У${id}`, theory: { title: `Урок ${id}`, goal: 'g', blocks: [] } })
const catalog = {
  botUsername: 'TraleBot', miniAppEnabled: true,
  modules: [
    { id: 'alphabet-progressive', title: 'Алфавит', emoji: '', description: '', lessons: [lesson(1), lesson(2)] },
    { id: 'intro', title: 'Знакомство', emoji: '', description: '', lessons: [lesson(1), lesson(2), lesson(3)] },
    { id: 'numbers', title: 'Числа', emoji: '', description: '', lessons: [lesson(1)] },
    { id: 'cases', title: 'Падежи', emoji: '', description: '', lessons: [lesson(1)] },
    { id: 'my-vocabulary', title: 'Мой словарь', emoji: '', description: '', lessons: [] }
  ]
}

const entry = {
  id: '1', word: 'стол', definition: 'მაგიდა', additionalInfo: '', example: '', dateAddedUtc: '2026-10-01T00:00:00Z',
  successCount: 0, successReverseCount: 0, failedCount: 0, mastery: 'new', isStarter: false, verb: null
}

async function setup(page: Page, who = me) {
  const taps: string[] = []
  await page.addInitScript(() => {
    const back = { visible: false, handler: null as null | (() => void) }
    ;(window as any).__back = back
    ;(window as any).__appEventsOn = true
    ;(window as any).Telegram = {
      WebApp: {
        initData: 'user=%7B%22id%22%3A123456%7D',
        BackButton: {
          show: () => { back.visible = true }, hide: () => { back.visible = false },
          onClick: (h: () => void) => { back.handler = h }, offClick: () => { back.handler = null }
        },
        MainButton: { show: () => {}, hide: () => {} },
        HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {} },
        openTelegramLink: () => {}, onEvent: () => {}, offEvent: () => {}
      }
    }
  })
  // Настоящий скрипт Telegram подменил бы заглушку с кнопкой «Назад».
  await page.route('https://telegram.org/**', r => r.fulfill({ body: '', contentType: 'text/javascript' }))
  await page.route('**/api/miniapp/content', r => r.fulfill({ json: catalog }))
  await page.route('**/api/miniapp/me', r => r.fulfill({ json: who }))
  await page.route('**/api/miniapp/activity-days*', r => r.fulfill({ json: { dates: [] } }))
  await page.route('**/api/miniapp/plans', r => r.fulfill({ json: { plans: [{ id: 'Month', payloadId: 'p', stars: 100, durationDays: 30, title: '1 месяц', description: '30 дней' }] } }))
  await page.route('**/api/miniapp/vocabulary', r => r.fulfill({ json: { items: [entry], verbs: [], starterItems: [] } }))
  await page.route('**/api/miniapp/daily-task', r => r.fulfill({ status: 404, json: {} }))
  await page.route('**/api/miniapp/app-events', r => {
    for (const e of r.request().postDataJSON().events) if (e.event === 'tap') taps.push(e.target)
    return r.fulfill({ status: 204 })
  })
  return { taps }
}

const backVisible = (page: Page) => page.evaluate(() => (window as any).__back.visible as boolean)
const pressBack = (page: Page) => page.evaluate(() => (window as any).__back.handler?.())

async function shot(page: Page, name: string) {
  if (!process.env.HOME_TABS_SHOTS) return
  const dir = resolve(process.env.HOME_TABS_SHOTS)
  mkdirSync(dir, { recursive: true })
  await page.screenshot({ path: resolve(dir, `${name}.png`) })
}

test('«Сегодня» — одна кнопка к следующему уроку, модулей на главной нет', async ({ page }) => {
  await setup(page)
  await page.goto('/?playwright=1')

  await expect(page.getByTestId('dashboard-today')).toBeVisible()
  await expect(page.getByTestId('home-tab-today')).toHaveAttribute('aria-selected', 'true')
  // Без задания дня план из одного шага — следующий урок курса.
  await expect(page.getByTestId('dashboard-today-new')).toContainText('Урок 2')
  await expect(page.getByTestId('dashboard-today-new')).toContainText('Знакомство')
  await expect(page.getByTestId('dashboard-suggestion').getByRole('button')).toHaveText('Пройти урок')
  await expect(page.locator('[data-testid^="module-tile-"]')).toHaveCount(0)
  await expect.poll(() => backVisible(page)).toBe(false)
  // Кнопка плана видна без прокрутки и не прячется под панелью.
  await expect(page.getByTestId('dashboard-suggestion')).toBeInViewport({ ratio: 1 })
  const tabTop = (await page.getByTestId('home-tabs').boundingBox())!.y
  const button = (await page.getByTestId('dashboard-suggestion').boundingBox())!
  expect(button.y + button.height).toBeLessThanOrEqual(tabTop)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  await shot(page, '1-today')
})

test('вкладки: курс → модуль → «Назад» в курс; глаголы и словарь в один тап; нажатия записаны', async ({ page }) => {
  const { taps } = await setup(page)
  await page.goto('/?playwright=1')

  await page.getByTestId('home-tab-course').click()
  await expect(page.getByTestId('home-tab-course')).toHaveAttribute('aria-selected', 'true')
  // Начатое — первым, пройденное — ниже, словаря в курсе нет: он своя вкладка.
  const tiles = page.locator('[data-testid^="module-tile-"]')
  await expect(tiles.first()).toHaveAttribute('data-testid', 'module-tile-intro')
  await expect(page.getByTestId('module-tile-my-vocabulary')).toHaveCount(0)
  await expect.poll(() => backVisible(page)).toBe(false)
  await shot(page, '2-course')

  await page.getByTestId('module-tile-intro').click()
  await expect(page.getByTestId('lesson-btn-1')).toBeVisible()
  await expect(page.getByTestId('home-tabs')).toHaveCount(0)
  await expect.poll(() => backVisible(page)).toBe(true)
  await pressBack(page)
  await expect(page.getByTestId('home-tab-course')).toHaveAttribute('aria-selected', 'true')

  await page.getByTestId('home-tab-verbs').click()
  await expect(page.getByTestId('home-tab-verbs')).toHaveAttribute('aria-selected', 'true')
  await expect.poll(() => backVisible(page)).toBe(false)

  await page.getByTestId('home-tab-vocab').click()
  await expect(page.getByText('стол')).toBeVisible()
  await expect.poll(() => backVisible(page)).toBe(false)
  // Кнопки квиза словаря стоят над панелью, а не под ней.
  const quiz = page.getByRole('button', { name: 'все', exact: true }).last()
  await expect(quiz).toBeVisible()
  const tabTop = (await page.getByTestId('home-tabs').boundingBox())!.y
  const q = (await quiz.boundingBox())!
  expect(q.y + q.height).toBeLessThanOrEqual(tabTop)
  await shot(page, '3-vocab')

  await page.getByTestId('home-tab-today').click()
  await expect(page.getByTestId('dashboard-today')).toBeVisible()
  await expect.poll(() => taps).toEqual(['tab-course', 'module-intro', 'tab-verbs', 'tab-vocab', 'tab-today'])
})

test('без доступа вкладка «Словарь» открывает покупку, как раньше плитка', async ({ page }) => {
  await setup(page, { ...me, isPro: false, hasAccess: false })
  await page.goto('/?playwright=1')

  await page.getByTestId('home-tab-vocab').click()
  await expect(page.getByRole('dialog', { name: 'Про-доступ' })).toBeVisible()
  await expect(page.getByTestId('home-tab-today')).toHaveAttribute('aria-selected', 'true')
})

test('пока набирают текст в словаре, панель вкладок прячется', async ({ page }) => {
  await setup(page)
  await page.goto('/?playwright=1&screen=vocabulary')

  await expect(page.getByTestId('home-tabs')).toBeVisible()
  await page.getByRole('textbox').first().focus()
  await expect(page.getByTestId('home-tabs')).toHaveCount(0)
})

test('профиль — кружок справа вверху, кнопка «Сегодня» видна без прокрутки', async ({ page }) => {
  await setup(page)
  await page.goto('/?playwright=1')

  const profile = page.getByTestId('dashboard-profile')
  await expect(profile).toBeVisible()
  const box = (await profile.boundingBox())!
  expect(box.x).toBeGreaterThan(375 / 2)
  expect(box.y).toBeLessThan(120)
  await expect(page.getByText('мой профиль')).toHaveCount(0)

  // Главная кнопка целиком над нижней панелью, листать не нужно.
  const button = page.getByTestId('dashboard-suggestion').getByRole('button')
  const b = (await button.boundingBox())!
  const bar = (await page.getByTestId('home-tabs').boundingBox())!
  expect(b.y + b.height).toBeLessThanOrEqual(bar.y)
  await shot(page, 'today-top-profile')

  await profile.click()
  await expect(page.getByTestId('home-tabs')).toHaveCount(0)
})

test('ещё не занимался сегодня — Бомбора говорит, что серия прервётся', async ({ page }) => {
  await setup(page)
  await page.goto('/?playwright=1')
  await expect(page.getByTestId('today-say')).toHaveText('3 дня подряд! Открой подарок, не прерывай')
})

test('сегодня уже занимался — кнопка не торопит', async ({ page }) => {
  await setup(page, { ...me, progress: { ...me.progress, lastPlayedAtUtc: new Date().toISOString() } })
  await page.goto('/?playwright=1')
  await expect(page.getByTestId('dashboard-suggestion')).toBeVisible()
  await expect(page.getByTestId('today-say')).not.toContainText('Открой подарок')
})

test('новичок после знакомства: «Начать первый урок» и вкладки на месте', async ({ page }) => {
  await setup(page, { ...me, progress: { ...me.progress, xp: 0, streak: 0, completedLessons: {} } })
  await page.goto('/?playwright=1')
  // Совсем новый попадает на знакомство с Бомборой, как и раньше.
  await page.getByText('пропустить знакомство').click()
  await page.getByText('посмотреть все уроки').click()
  await expect(page.getByTestId('home-tabs')).toBeVisible()
  await expect(page.getByTestId('dashboard-suggestion').getByRole('button')).toHaveText('Начать первый урок')
  await expect(page.getByTestId('today-say')).toHaveText('Привет! Открой подарок — начнём')
  await shot(page, 'today-newcomer')
})
