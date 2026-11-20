import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

// Главная «Сегодня»: подарок дня — награда в конце (как сундук у Duolingo). Пока шаги не пройдены — закрыт и объясняет
// почему; прошёл — распаковка на весь экран с вибрацией; забрал — стоит раскрытым. «Что нового» — для тех, кто учился
// раньше. Экран ровно в окно; вкладки листаются свайпом.
// Задание — настоящий ответ сервера (fixtures/daily/today.json).
// TODAY_VIDEO=1 — записать видео (test-results/…/video.webm), чтобы посмотреть анимацию глазами.

const here = dirname(fileURLToPath(import.meta.url))
const TODAY = JSON.parse(readFileSync(resolve(here, 'fixtures/daily/today.json'), 'utf8'))

test.use({ viewport: { width: 375, height: 667 }, ...(process.env.TODAY_VIDEO ? { video: { mode: 'on' as const, size: { width: 375, height: 667 } }, launchOptions: { slowMo: 350 } } : {}) })

async function setup(page: Page, { task = TODAY as any, progressPatch = {} as any } = {}) {
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
    if (path.startsWith('activity-days')) return route.fulfill({ json: { dates: [] } })
    if (path === 'vocabulary') return route.fulfill({ json: { items: [], verbs: [], starterItems: [] } })
    return route.fulfill({ status: 204 })
  })
}

const haptics = (page: Page) => page.evaluate(() => (window as any).__haptics as string[])
const DONE = { ...TODAY, done: true, offerTaken: true, result: { errors: 0, xpEarned: 20, streak: 3 }, offer: null }

test('шаги не пройдены: подарок закрыт, нажал — «закрыто» и Бомбора объясняет, кнопка ведёт в задание', async ({ page }) => {
  await setup(page)
  await page.goto('/?playwright=1')
  const gift = page.getByTestId('gift-button')
  await expect(gift).toHaveAttribute('data-gift', 'locked')
  await expect(page.getByTestId('gift-hint')).toHaveText('в конце дня')
  await expect(page.getByTestId('today-say')).toHaveText('2 дня подряд! Два шага — и подарок твой')

  await gift.click()
  await expect(page.getByTestId('today-say')).toHaveText('Пройди оба шага — и подарок твой')
  expect(await haptics(page)).toContain('impact:rigid')

  await page.getByTestId('dashboard-suggestion').getByRole('button').click()
  await expect(page.getByTestId('daily-chat').first()).toBeVisible()
})

test('шаги пройдены: подарок светится, распаковка на весь экран с вибрацией, потом стоит раскрытым', async ({ page }) => {
  await setup(page, { task: DONE })
  await page.goto('/?playwright=1')
  const gift = page.getByTestId('gift-button')
  await expect(gift).toHaveAttribute('data-gift', 'ready')
  await expect(page.getByTestId('today-say')).toHaveText('Готово! Открывай подарок')
  await expect(page.getByTestId('dashboard-gift-cta')).toContainText('Открыть подарок')

  // Подарок готов — Бомбора довольна, а не хмурится.
  await expect(page.getByTestId('today-bombora').locator('svg').first()).toBeVisible()
  await gift.click()
  const reveal = page.getByTestId('gift-reveal')
  // Открываешь сам: три тапа, каждый подбрасывает сильнее.
  await expect(reveal).toContainText('Тапай по подарку!')
  const box = page.getByTestId('gift-reveal-box')
  await box.click()
  await expect(reveal).toContainText('Ещё!')
  await expect(page.getByTestId('gift3d').last()).toHaveAttribute('data-charge', '1')
  await box.click()
  await expect(reveal).toContainText('Ещё разок!')
  await expect(page.getByTestId('gift-reveal-hint')).toHaveText('1 тап — и он твой')
  await box.click()
  await expect(page.getByTestId('gift3d').last()).toHaveAttribute('data-state', 'open')
  await expect(reveal).toContainText('Это всё твоё!')
  await expect(page.getByTestId('gift-prize')).toContainText('+20 опыта')
  await expect(page.getByTestId('gift-prize')).toContainText('3 дня подряд')
  await expect.poll(() => haptics(page)).toEqual(expect.arrayContaining(['impact:rigid', 'impact:heavy', 'note:success']))

  await page.getByTestId('gift-reveal-close').click()
  await expect(reveal).toHaveCount(0)
  await expect(gift).toHaveAttribute('data-gift', 'claimed')
  await expect(page.getByTestId('today-say')).toContainText('Новый подарок через')
  // Дальше — по желанию: следующий урок курса.
  await expect(page.getByTestId('dashboard-suggestion')).toContainText('Пройти урок')

  // Забрал — до завтра так и стоит раскрытым.
  await page.reload()
  await expect(page.getByTestId('gift-button')).toHaveAttribute('data-gift', 'claimed')
})

test('Бомбора — нажал, и открывается его дом; покормить — через опыт наверху', async ({ page }) => {
  await setup(page)
  await page.goto('/?playwright=1')
  await page.getByTestId('today-bombora').click()
  await expect(page.getByTestId('bombora-home')).toBeVisible()
  await page.getByTestId('bombora-home-close').click()
  await page.getByTestId('dashboard-feed-button').click()
  await expect(page.getByText(/Покорми|угости|Угости/).first()).toBeVisible()
})

test('«Сегодня» ровно в окно: не прокручивается, всё нужное видно', async ({ page }) => {
  await setup(page)
  await page.goto('/?playwright=1')
  await expect(page.getByTestId('gift-button')).toBeInViewport({ ratio: 1 })
  await expect(page.getByTestId('today-bombora')).toBeInViewport({ ratio: 1 })
  const button = (await page.getByTestId('dashboard-suggestion').getByRole('button').boundingBox())!
  const bar = (await page.getByTestId('home-tabs').boundingBox())!
  expect(button.y + button.height).toBeLessThanOrEqual(bar.y)
  const sizes = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, vh: window.innerHeight, w: document.documentElement.scrollWidth }))
  expect(sizes.h).toBeLessThanOrEqual(sizes.vh)
  expect(sizes.w).toBeLessThanOrEqual(375)
})

async function swipe(page: Page, fromX: number, toX: number, y = 420) {
  await page.evaluate(([a, b, yy]) => {
    const el = document.elementFromPoint(a, yy)!
    const t = (x: number) => new Touch({ identifier: 1, target: el, clientX: x, clientY: yy })
    el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [t(a)], changedTouches: [t(a)] }))
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [t(b)] }))
  }, [fromX, toX, y])
}

test('вкладки листаются свайпом: влево — «Курс», ещё влево — «Глаголы», вправо — назад', async ({ page }) => {
  await setup(page)
  await page.goto('/?playwright=1')
  await expect(page.getByTestId('home-tab-today')).toHaveAttribute('aria-selected', 'true')
  await swipe(page, 300, 120)
  await expect(page.getByTestId('home-tab-course')).toHaveAttribute('aria-selected', 'true')
  await swipe(page, 300, 120)
  await expect(page.getByTestId('home-tab-verbs')).toHaveAttribute('aria-selected', 'true')
  await swipe(page, 100, 300)
  await expect(page.getByTestId('home-tab-course')).toHaveAttribute('aria-selected', 'true')
  // Короткое движение и движение вниз — не свайп.
  await swipe(page, 200, 170)
  await expect(page.getByTestId('home-tab-course')).toHaveAttribute('aria-selected', 'true')
})

test('что нового: подарок в конце дня, повторение под тебя, подарок раскрывается; второй раз не показывается', async ({ page }) => {
  await setup(page)
  await page.goto('/?playwright=1&intro=1')
  const intro = page.getByTestId('today-intro')
  await expect(intro).toContainText('Каждый день — подарок от Бомборы')
  await expect(intro).toContainText('повторение и новое')
  await page.getByTestId('today-intro-next').click()
  await expect(intro).toContainText('Повторение — из того, что ты уже учил')
  await expect(intro).toContainText('твои слова')
  await page.getByTestId('today-intro-next').click()
  await expect(intro).toContainText('Открыл подарок — серия растёт')
  await expect(intro.getByTestId('gift3d')).toHaveAttribute('data-state', 'open')
  await expect(page.getByTestId('today-intro-next')).toHaveText('К подарку')
  await page.getByTestId('today-intro-next').click()
  await expect(intro).toHaveCount(0)

  await page.reload()
  await expect(page.getByTestId('gift-button')).toBeVisible()
  await expect(page.getByTestId('today-intro')).toHaveCount(0)
})

test('без задания дня: подарок за урок, «что нового» — два экрана', async ({ page }) => {
  await setup(page, { task: null })
  await page.goto('/?playwright=1&intro=1')
  const intro = page.getByTestId('today-intro')
  await expect(intro).toContainText('пройди урок — и открывай')
  await page.getByTestId('today-intro-next').click()
  await expect(intro).toContainText('Открыл подарок — серия растёт')
  await page.getByTestId('today-intro-next').click()
  await expect(page.getByTestId('today-say')).toHaveText('2 дня подряд! Один урок — и подарок твой')
})

// Демо-ролик для просмотра глазами (TODAY_VIDEO=1 TODAY_DEMO=1).
test('демо: что нового → главная → закрытый подарок → свайпы → готовый подарок → распаковка', async ({ page }) => {
  test.skip(!process.env.TODAY_DEMO, 'только для записи ролика')
  test.setTimeout(90_000)
  await setup(page, { task: DONE })
  await page.goto('/?playwright=1&intro=1')
  await page.waitForTimeout(2600)
  await page.getByTestId('today-intro-next').click(); await page.waitForTimeout(3600)
  await page.getByTestId('today-intro-next').click(); await page.waitForTimeout(3200)
  await page.getByTestId('today-intro-next').click(); await page.waitForTimeout(3000)
  await swipe(page, 300, 120); await page.waitForTimeout(1300)
  await swipe(page, 100, 300); await page.waitForTimeout(1500)
  await page.getByTestId('gift-button').click(); await page.waitForTimeout(1800)
  for (let i = 0; i < 3; i++) { await page.getByTestId('gift-reveal-box').click({ force: true }); await page.waitForTimeout(i < 2 ? 900 : 3200) }
  await page.getByTestId('gift-reveal-close').click(); await page.waitForTimeout(2500)
})

test('на стенде: «подарок заново» снова закрывает забранный подарок', async ({ page }) => {
  await setup(page, { task: { ...DONE, dev: true } })
  await page.route('**/api/miniapp/daily-task', r => r.fulfill({ json: { ...DONE, dev: true } }))
  await page.addInitScript((day) => localStorage.setItem(`today-gift-${day}`, '1'), DONE.day)
  await page.goto('/?playwright=1')
  await expect(page.getByTestId('gift-button')).toHaveAttribute('data-gift', 'claimed')
  await page.waitForTimeout(1500)
  if (process.env.HOME_TABS_SHOTS) await page.screenshot({ path: `${process.env.HOME_TABS_SHOTS}/gift-claimed.png` })
  await page.getByTestId('dev-gift-again').click()
  await expect(page.getByTestId('gift-button')).toHaveAttribute('data-gift', 'ready')
})
