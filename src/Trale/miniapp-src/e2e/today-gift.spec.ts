import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

// Главная «Сегодня» как игрушка: подарок дня открывается и ведёт в задание, «что нового» для тех, кто учился
// раньше, Бомбору можно тыкать, а если потрясти телефон (акселерометр Telegram) — выпадет слово.
// Задание — настоящий ответ сервера (fixtures/daily/today.json).
// TODAY_VIDEO=1 — записать видео (test-results/…/video.webm), чтобы посмотреть анимацию глазами.

const here = dirname(fileURLToPath(import.meta.url))
const TODAY = JSON.parse(readFileSync(resolve(here, 'fixtures/daily/today.json'), 'utf8'))

test.use({ viewport: { width: 375, height: 667 }, ...(process.env.TODAY_VIDEO ? { video: { mode: 'on' as const, size: { width: 375, height: 667 } }, launchOptions: { slowMo: 350 } } : {}) })

async function setup(page: Page, { task = TODAY as any } = {}) {
  await page.addInitScript(() => {
    const handlers: Record<string, (() => void)[]> = {}
    const accel = { x: 0, y: 0, z: 9.8, started: false, start() { this.started = true }, stop() { this.started = false } }
    const w = window as any
    w.__accel = accel
    w.__fire = (ev: string) => (handlers[ev] ?? []).forEach(h => h())
    w.__haptics = [] as string[]
    w.Telegram = {
      WebApp: {
        initData: 'user=%7B%22id%22%3A123456%7D',
        isVersionAtLeast: () => true,
        Accelerometer: accel,
        DeviceOrientation: { start() {}, stop() {}, alpha: 0, beta: 0, gamma: 0 },
        BackButton: { show: () => {}, hide: () => {}, onClick: () => {}, offClick: () => {} },
        MainButton: { show: () => {}, hide: () => {} },
        HapticFeedback: {
          impactOccurred: (s: string) => w.__haptics.push(`impact:${s}`),
          notificationOccurred: (s: string) => w.__haptics.push(`note:${s}`),
          selectionChanged: () => w.__haptics.push('tick')
        },
        openTelegramLink: () => {},
        onEvent: (ev: string, h: () => void) => { (handlers[ev] ??= []).push(h) },
        offEvent: (ev: string, h: () => void) => { handlers[ev] = (handlers[ev] ?? []).filter(x => x !== h) }
      }
    }
  })
  const catalog = {
    botUsername: 'TraleBot', miniAppEnabled: true,
    modules: [
      { id: 'alphabet-progressive', title: 'Алфавит', emoji: '', description: '', lessons: [{ id: 1, title: 'Первые буквы', short: '' }] },
      { id: 'cases', title: 'Падежи', emoji: '', description: '', lessons: Array.from({ length: 10 }, (_, i) => ({ id: i + 1, title: `Урок ${i + 1}`, short: '' })) }
    ]
  }
  const progress = { xp: 2173, streak: 2, lastPlayedAtUtc: '2026-11-16T09:31:43Z', completedLessons: { 'alphabet-progressive': [1], cases: [1, 2, 3] }, xpSpent: 0, totalTreatsGiven: 0, lastFedAtUtc: null, lastTreatIndex: null }
  await page.route('https://telegram.org/**', r => r.fulfill({ body: '', contentType: 'text/javascript' }))
  await page.route('**/api/miniapp/**', (route: any) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname).replace('/api/miniapp/', '')
    if (path === 'content') return route.fulfill({ json: catalog })
    if (path === 'me') return route.fulfill({ json: { authenticated: true, isPro: true, isTrialActive: false, trialDaysLeft: 0, hasAccess: true, level: 'beginner', vocabularyCount: 10, uiHintsSeen: [], progress } })
    if (path === 'daily-task') return task ? route.fulfill({ json: { ...task, dev: false } }) : route.fulfill({ status: 404, json: {} })
    if (path.startsWith('activity-days')) return route.fulfill({ json: { dates: [] } })
    return route.fulfill({ status: 204 })
  })
}

const haptics = (page: Page) => page.evaluate(() => (window as any).__haptics as string[])

test('подарок дня: нажал на коробку — она открывается с вибрацией и ведёт в задание', async ({ page }) => {
  await setup(page)
  await page.goto('/?playwright=1')

  const box = page.getByTestId('gift-box')
  await expect(box).toBeVisible()
  await expect(box).toHaveAttribute('data-opened', 'false')
  await expect(page.getByTestId('today-say')).toHaveText('2 дня подряд! Открой подарок, не прерывай')

  await page.getByRole('button', { name: 'Открыть подарок дня' }).click()
  // Что внутри — вылетает из коробки: формы и слова из задания.
  await expect(page.getByText(/^\d+ (форма|формы|форм)$/).first()).toBeVisible()
  await expect(page.getByTestId('daily-chat').first()).toBeVisible({ timeout: 5000 })

  const felt = await haptics(page)
  expect(felt).toContain('tick')
  expect(felt).toContain('impact:heavy')
  expect(felt).toContain('note:success')
})

test('большая кнопка открывает тот же подарок', async ({ page }) => {
  await setup(page)
  await page.goto('/?playwright=1')
  await page.getByTestId('dashboard-suggestion').getByRole('button').click()
  await expect(page.getByTestId('daily-chat').first()).toBeVisible({ timeout: 5000 })
})

test('всё на главной видно без прокрутки: Бомбора, коробка, кнопка над вкладками', async ({ page }) => {
  await setup(page)
  await page.goto('/?playwright=1')
  await expect(page.getByTestId('gift-box')).toBeInViewport({ ratio: 1 })
  await expect(page.getByTestId('today-bombora')).toBeInViewport({ ratio: 1 })
  const button = (await page.getByTestId('dashboard-suggestion').getByRole('button').boundingBox())!
  const bar = (await page.getByTestId('home-tabs').boundingBox())!
  expect(button.y + button.height).toBeLessThanOrEqual(bar.y)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
})

test('потряс телефон — выпало слово с транскрипцией', async ({ page }) => {
  await setup(page)
  await page.goto('/?playwright=1')
  await expect(page.getByTestId('gift-box')).toBeVisible()
  expect(await page.evaluate(() => (window as any).__accel.started)).toBe(true)

  // Три резких рывка за полсекунды.
  for (const v of [[14, -12, 20], [-14, 12, -4], [14, -12, 20], [-14, 12, -4]]) {
    await page.evaluate(([x, y, z]) => { const a = (window as any).__accel; a.x = x; a.y = y; a.z = z; (window as any).__fire('accelerometerChanged') }, v)
    await page.waitForTimeout(40)
  }
  const card = page.getByTestId('today-surprise')
  await expect(card).toBeVisible()
  await expect(card).toContainText('Слово-сюрприз от Бомборы')
  // Слово — грузинское и рядом кириллица, не латиница.
  await expect(card).toContainText(/[ა-ჿ]/)
  await expect(card).not.toContainText(/[a-z]{3}/)
  await card.click()
  await expect(card).toHaveCount(0)
})

test('Бомбору можно тыкать: отвечает по-грузински, а на пятый тык — слово-сюрприз', async ({ page }) => {
  await setup(page)
  await page.goto('/?playwright=1')
  const bombora = page.getByTestId('today-bombora')
  await bombora.click()
  await expect(page.getByTestId('today-say')).toContainText(/[ა-ჿ].*\(.+\) — /)
  for (let i = 0; i < 4; i++) await bombora.click({ force: true, delay: 10 })
  await expect(page.getByTestId('today-surprise')).toBeVisible()
})

test('что нового: три экрана — подарок, из чего он собран, сколько времени; второй раз не показывается', async ({ page }) => {
  await setup(page)
  await page.goto('/?playwright=1&intro=1')

  const intro = page.getByTestId('today-intro')
  await expect(intro).toContainText('Каждый день — подарок от Бомборы')
  await page.getByTestId('today-intro-next').click()
  await expect(intro).toContainText('Из того, что ты уже учил')
  await expect(intro).toContainText('твои слова')
  await page.getByTestId('today-intro-next').click()
  await expect(intro).toContainText('Один подарок в день держит серию')
  await expect(page.getByTestId('today-intro-next')).toHaveText('К подарку')
  await page.getByTestId('today-intro-next').click()
  await expect(intro).toHaveCount(0)
  await expect(page.getByTestId('gift-box')).toBeVisible()

  await page.reload()
  await expect(page.getByTestId('gift-box')).toBeVisible()
  await expect(page.getByTestId('today-intro')).toHaveCount(0)
})

test('без задания дня «что нового» короче: про подарок и про время', async ({ page }) => {
  await setup(page, { task: null })
  await page.goto('/?playwright=1&intro=1')
  const intro = page.getByTestId('today-intro')
  await expect(intro).toContainText('Каждый день — подарок от Бомборы')
  await page.getByTestId('today-intro-next').click()
  await expect(intro).toContainText('Один подарок в день держит серию')
})

test('уже занимался сегодня — коробка открыта, Бомбора зовёт к новому', async ({ page }) => {
  await setup(page, { task: { ...TODAY, done: true, result: { errors: 0, xpEarned: 20, streak: 3 }, offer: null } })
  await page.goto('/?playwright=1')
  await expect(page.getByTestId('gift-box')).toHaveAttribute('data-opened', 'true')
  await expect(page.getByTestId('today-say')).toHaveText('Ещё немного?')
})

// Демо-ролик для просмотра глазами (TODAY_VIDEO=1 TODAY_DEMO=1): всё подряд в человеческом темпе.
test('демо: что нового → главная → Бомбора → встряхнуть → открыть подарок', async ({ page }) => {
  test.skip(!process.env.TODAY_DEMO, 'только для записи ролика')
  test.setTimeout(90_000)
  await setup(page)
  await page.goto('/?playwright=1&intro=1')
  await page.waitForTimeout(2200)
  for (let i = 0; i < 3; i++) { await page.getByTestId('today-intro-next').click(); await page.waitForTimeout(i === 0 ? 3600 : 2600) }
  await page.waitForTimeout(3200) // коробка ждёт и подпрыгивает
  const bombora = page.getByTestId('today-bombora')
  await bombora.click({ force: true }); await page.waitForTimeout(1500)
  await bombora.click({ force: true }); await page.waitForTimeout(1500)
  for (const v of [[14, -12, 20], [-14, 12, -4], [14, -12, 20], [-14, 12, -4]]) {
    await page.evaluate(([x, y, z]) => { const a = (window as any).__accel; a.x = x; a.y = y; a.z = z; (window as any).__fire('accelerometerChanged') }, v)
    await page.waitForTimeout(40)
  }
  await page.waitForTimeout(2800)
  await page.getByTestId('today-surprise').click()
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: 'Открыть подарок дня' }).click()
  await page.waitForTimeout(3500)
})
