import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

// Подарок дня с редкостями (сервер — DailyGiftService): на главной коробка, таймер сгорания, что может выпасть
// и шансы от серии; одна кнопка «Забрать подарок» ведёт в занятие. Распаковка — три тапа, каждый может поднять
// редкость; потом приз и «что завтра»: неделя до гарантированного эпического и вторая коробка за ещё один раунд.
// GIFT_VIDEO=1 — записать видео.

const here = dirname(fileURLToPath(import.meta.url))
const TODAY = JSON.parse(readFileSync(resolve(here, 'fixtures/daily/today.json'), 'utf8'))

test.use({ viewport: { width: 375, height: 667 }, ...(process.env.GIFT_VIDEO ? { video: { mode: 'on' as const, size: { width: 375, height: 667 } }, launchOptions: { slowMo: 350 } } : {}) })

async function setup(page: Page, { task = TODAY as any, progressPatch = {} as any, gift = GIFT() as any, prize = { rarity: 2, prize: 'boost', friendLink: null as string | null } } = {}) {
  const calls: string[] = []
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
  const progress = { ...{ xp: 2173, streak: 2, lastPlayedAtUtc: '2026-11-16T09:31:43Z', completedLessons: { 'alphabet-progressive': [1], cases: [1, 2, 3] }, xpSpent: 0, totalTreatsGiven: 0, lastFedAtUtc: null, lastTreatIndex: null }, ...progressPatch }
  await page.route('https://telegram.org/**', r => r.fulfill({ body: '', contentType: 'text/javascript' }))
  await page.route('**/api/miniapp/**', (route: any) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname).replace('/api/miniapp/', '')
    if (path === 'content') return route.fulfill({ json: catalog })
    if (path === 'me') return route.fulfill({ json: { authenticated: true, isPro: true, isTrialActive: false, trialDaysLeft: 0, hasAccess: true, level: 'beginner', vocabularyCount: 10, uiHintsSeen: [], progress } })
    if (path === 'daily-task') return task ? route.fulfill({ json: { ...task, dev: false } }) : route.fulfill({ status: 404, json: {} })
    if (path === 'daily-gift') return route.fulfill({ json: gift })
    if (path === 'daily-gift/open') {
      calls.push('open')
      const box = JSON.parse(route.request().postData() ?? '{}').box ?? 0
      gift = { ...gift, boxes: gift.boxes.map((b: any) => b.box === box ? { ...b, opened: true, ...prize } : b) }
      return route.fulfill({ json: { gift, box: gift.boxes.find((b: any) => b.box === box) } })
    }
    if (path === 'daily-task/extra') { calls.push('extra'); return route.fulfill({ json: { extra: null } }) }
    if (path.startsWith('activity-days')) return route.fulfill({ json: { dates: [] } })
    if (path === 'vocabulary') return route.fulfill({ json: { items: [], verbs: [], starterItems: [] } })
    return route.fulfill({ status: 204 })
  })
  return calls
}


function GIFT({ ready = false, opened = false, ready1 = false, streak = 3, guaranteedIn = 4 } = {}) {
  return {
    day: '2026-11-20', streak, odds: [0.565, 0.292, 0.115, 0.028], guaranteedIn, freezes: 1, boostToday: false,
    burnsAtUtc: new Date(Date.now() + 6 * 3600_000).toISOString(), friendDays: 7,
    boxes: [
      { box: 0, ready, opened, rarity: opened ? 1 : null, prize: opened ? 'freeze' : null, friendLink: null },
      { box: 1, ready: ready1, opened: false, rarity: null, prize: null, friendLink: null }
    ]
  }
}
const DONE = { ...TODAY, done: true, offerTaken: true, result: { errors: 0, xpEarned: 20, streak: 3 }, offer: null }
const haptics = (page: Page) => page.evaluate(() => (window as any).__haptics as string[])

test('до занятия: коробка закрыта на 2 минуты, таймер сгорания, что может выпасть, шансы; кнопка ведёт в занятие', async ({ page }) => {
  await setup(page)
  await page.goto('/?playwright=1')
  await expect(page.getByTestId('gift-button')).toHaveAttribute('data-gift', 'locked')
  await expect(page.getByTestId('gift-hint')).toHaveText('2 минуты занятия')
  await expect(page.getByTestId('gift-timer')).toHaveText(/^сгорит через \d\d:\d\d:\d\d$/)
  await expect(page.getByTestId('gift-ticker')).toBeVisible()
  await expect(page.getByTestId('gift-odds')).toContainText('редкий 29%')
  await expect(page.getByTestId('gift-odds')).toContainText('легендарный 3%')
  await expect(page.getByTestId('dashboard-gift-sub')).toHaveText('сначала 2 минуты занятия')
  const sizes = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, vh: window.innerHeight }))
  expect(sizes.h).toBeLessThanOrEqual(sizes.vh)
  await page.getByTestId('dashboard-suggestion').getByRole('button').click()
  await expect(page.getByTestId('daily-chat').first()).toBeVisible()
})

test('недельный день: Бомбора обещает минимум эпический', async ({ page }) => {
  await setup(page, { gift: GIFT({ streak: 7, guaranteedIn: 0 }) })
  await page.goto('/?playwright=1')
  await expect(page.getByTestId('gift-weekly')).toHaveText('Недельный: минимум эпический')
  await expect(page.getByTestId('today-say')).toHaveText('Сегодня недельный подарок — минимум эпический!')
})

test('распаковка: три тапа поднимают редкость до выпавшей, приз, потом неделя и вторая коробка за раунд', async ({ page }) => {
  const calls = await setup(page, { task: DONE, gift: GIFT({ ready: true }) })
  await page.goto('/?playwright=1')
  await expect(page.getByTestId('gift-button')).toHaveAttribute('data-gift', 'ready')
  await page.getByTestId('dashboard-gift-cta').getByRole('button').click()
  const reveal = page.getByTestId('gift-reveal')
  await expect(page.getByTestId('gift-rarity')).toHaveText('Обычный')
  await expect(page.getByTestId('gift-title')).toHaveText('Тапай по коробке!')
  await expect.poll(() => calls.includes('open')).toBe(true)

  const box = page.getByTestId('gift-reveal-box')
  await box.click()
  await expect(page.getByTestId('gift-rarity')).toHaveText('Редкий')
  await expect(page.getByTestId('gift-title')).toHaveText('Ого, повысился!')
  await box.click()
  await expect(page.getByTestId('gift-rarity')).toHaveText('Эпический')
  await expect(reveal).toHaveAttribute('data-rarity', '2')
  await box.click()
  await expect(page.getByTestId('gift-prize')).toHaveAttribute('data-prize', 'boost')
  await expect(page.getByTestId('gift-prize')).toContainText('×2 опыта на завтра')
  expect(await haptics(page)).toContain('note:success')

  await page.getByTestId('gift-reveal-close').click()
  await expect(page.getByTestId('gift-week-line')).toHaveText('Ещё 4 дня до гарантированного эпического')
  await expect(page.getByTestId('gift-week').locator('span')).toHaveCount(7)
  await page.getByTestId('gift-more').click()
  await expect.poll(() => calls.includes('extra')).toBe(true)
})

test('без подъёма: обычный приз — чурчхела для Бомборы', async ({ page }) => {
  await setup(page, { task: DONE, gift: GIFT({ ready: true }), prize: { rarity: 0, prize: 'churchkhela', friendLink: null } })
  await page.goto('/?playwright=1')
  await page.getByTestId('dashboard-gift-cta').getByRole('button').click()
  const box = page.getByTestId('gift-reveal-box')
  await page.waitForTimeout(300)
  await box.click()
  await expect(page.getByTestId('gift-title')).toHaveText('Ещё!')
  await box.click()
  await box.click()
  await expect(page.getByTestId('gift-prize')).toContainText('Чурчхела для Бомборы')
  await expect(page.getByTestId('gift-rarity')).toHaveText('Обычный')
})

test('легендарный: подарок другу уходит одноразовой ссылкой через «переслать»', async ({ page }) => {
  await setup(page, { task: DONE, gift: GIFT({ ready: true }), prize: { rarity: 3, prize: 'friend', friendLink: 'https://t.me/TraleBot?start=gift_abc234defg' } })
  await page.addInitScript(() => { (window as any).__links = [] })
  await page.goto('/?playwright=1')
  await page.evaluate(() => { (window as any).Telegram.WebApp.openTelegramLink = (u: string) => (window as any).__links.push(u) })
  await page.getByTestId('dashboard-gift-cta').getByRole('button').click()
  const box = page.getByTestId('gift-reveal-box')
  await page.waitForTimeout(300)
  for (let i = 0; i < 3; i++) await box.click()
  await expect(page.getByTestId('gift-prize')).toContainText('Подарок другу')
  await expect(page.getByTestId('gift-prize')).toContainText('7 дней полного доступа')
  await page.getByTestId('gift-friend-share').click()
  const links = await page.evaluate(() => (window as any).__links as string[])
  expect(decodeURIComponent(links[0])).toContain('start=gift_abc234defg')
})

test('первая коробка открыта: на главной она раскрыта в цвет редкости, кнопка — «ещё раунд → вторая коробка»', async ({ page }) => {
  await setup(page, { task: DONE, gift: GIFT({ ready: true, opened: true }) })
  await page.goto('/?playwright=1')
  await expect(page.getByTestId('gift-button')).toHaveAttribute('data-gift', 'claimed')
  await expect(page.getByTestId('gift3d').first()).toHaveClass(/g3-r1/)
  await expect(page.getByTestId('today-say')).toHaveText('Ещё раунд — и вторая коробка твоя')
  await expect(page.getByTestId('dashboard-gift-more')).toBeVisible()
})

test('раунд сыгран: вторая коробка готова к открытию', async ({ page }) => {
  await setup(page, { task: { ...DONE, extras: 1 }, gift: GIFT({ ready: true, opened: true, ready1: true }) })
  await page.goto('/?playwright=1')
  await expect(page.getByTestId('gift-button')).toHaveAttribute('data-gift', 'ready')
  await expect(page.getByTestId('dashboard-gift-cta').getByRole('button')).toHaveText('Открыть вторую коробку')
})

test('в занятии коробка ждёт в конце полоски', async ({ page }) => {
  await setup(page)
  await page.goto('/?playwright=1')
  await page.getByTestId('dashboard-suggestion').getByRole('button').click()
  await page.getByTestId('daily-intro').getByRole('button', { name: TODAY.button }).click()
  await expect(page.getByTestId('daily-steps-gift')).toBeVisible()
})
