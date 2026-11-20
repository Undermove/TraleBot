import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

// Дом Бомборы: всё, что собрано из подарков дня. Комната с мебелью, гардероб (надеть/снять), слова-сокровища,
// открытки. Подсказки — кнопка в упражнениях подсвечивает верный ответ.
// HOME_SHOTS=<папка> — снять экраны.

const here = dirname(fileURLToPath(import.meta.url))
const TODAY = JSON.parse(readFileSync(resolve(here, 'fixtures/daily/today.json'), 'utf8'))

test.use({ viewport: { width: 375, height: 667 }, ...(process.env.GIFT_VIDEO ? { video: { mode: 'on' as const, size: { width: 375, height: 667 } }, launchOptions: { slowMo: 350 } } : {}) })

async function setup(page: Page, { task = TODAY as any, progressPatch = {} as any, gift = GIFT() as any, prize = { rarity: 2, prize: 'boost', days: null as number | null } } = {}) {
  const calls: string[] = []
  let col = COL()
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
    if (path === 'bombora/stash') return route.fulfill({ json: col })
    if (path === 'bombora/wear') {
      const { slot, item } = JSON.parse(route.request().postData() ?? '{}')
      calls.push(`wear:${slot}:${item}`)
      const wear = { ...col.stash.wear }; if (item) wear[slot] = item; else delete wear[slot]
      col = { ...col, stash: { ...col.stash, wear } }
      return route.fulfill({ json: { stash: col.stash } })
    }
    if (path === 'daily-gift/hint') { calls.push('hint'); col = { ...col, stash: { ...col.stash, hints: col.stash.hints - 1 } }; return route.fulfill({ json: { hints: col.stash.hints } }) }
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
    burnsAtUtc: new Date(Date.now() + 6 * 3600_000).toISOString(), invite: { link: 'https://t.me/TraleBot?start=ref_123456', friendDays: 60, myDays: 7 },
    boxes: [
      { box: 0, ready, opened, rarity: opened ? 1 : null, prize: opened ? 'freeze' : null, days: null },
      { box: 1, ready: ready1, opened: false, rarity: null, prize: null, days: null }
    ]
  }
}
const DONE = { ...TODAY, done: true, offerTaken: true, result: { errors: 0, xpEarned: 20, streak: 3 }, offer: null }
const haptics = (page: Page) => page.evaluate(() => (window as any).__haptics as string[])


function COL() {
  return {
    stash: { hints: 2, words: ['supra'], cards: ['gaumarjos'], items: ['beret', 'round-glasses', 'scarf-kilim'], furniture: ['rug', 'lamp', 'picture', 'pillow'], wear: { head: 'beret' } },
    words: [{ id: 'supra', ka: 'სუფრა', tr: 'супра', ru: 'застолье', story: 'Грузинское застолье с тамадой и тостами.' }],
    cards: [{ id: 'gaumarjos', ka: 'გაუმარჯოს!', tr: 'гаумарджос!', ru: 'за здоровье!', when: 'к празднику' }],
    wordsTotal: 24, cardsTotal: 16
  }
}
const shots = process.env.HOME_SHOTS
const shot = async (page: Page, n: string) => { if (shots) { await page.waitForTimeout(400); await page.screenshot({ path: `${shots}/${n}.png` }) } }

test('тап по Бомборе — его дом: комната с мебелью, надетое, гардероб надевает и снимает', async ({ page }) => {
  const calls = await setup(page)
  await page.goto('/?playwright=1')
  await expect(page.getByTestId('today-bombora').locator('[data-wear="beret"]')).toBeVisible()
  await page.getByTestId('today-bombora').click()
  const home = page.getByTestId('bombora-home')
  await expect(home).toBeVisible()
  await expect(page.getByTestId('bombora-room').locator('[data-furn="rug"]')).toHaveCount(1)
  await expect(page.getByTestId('bombora-room').locator('[data-furn="clock"]')).toHaveCount(0)
  await expect(page.getByTestId('bombora-room').locator('[data-wear="beret"]')).toBeVisible()
  await expect(page.getByTestId('bombora-hints')).toHaveText('Подсказок: 2')
  await expect(page.getByTestId('bombora-item-crown')).toHaveAttribute('data-owned', 'false')
  await shot(page, '1-home-wear')

  await page.getByTestId('bombora-item-round-glasses').click()
  await expect(page.getByTestId('bombora-room').locator('[data-wear="round-glasses"]')).toBeVisible()
  await page.getByTestId('bombora-item-beret').click()
  await expect(page.getByTestId('bombora-room').locator('[data-wear="beret"]')).toHaveCount(0)
  await page.getByTestId('bombora-item-scarf-kilim').click()
  expect(calls).toEqual(expect.arrayContaining(['wear:eyes:round-glasses', 'wear:head:null', 'wear:neck:scarf-kilim']))
  await shot(page, '2-home-dressed')

  await page.getByTestId('bombora-tab-room').click()
  await expect(page.getByTestId('bombora-furn-rug')).toHaveAttribute('data-owned', 'true')
  await shot(page, '3-home-room')
  await page.getByTestId('bombora-tab-words').click()
  await expect(page.getByTestId('bombora-word-supra')).toContainText('სუფრა')
  await expect(page.getByTestId('bombora-panel-words')).toContainText('1/24')
  await shot(page, '4-home-words')
  await page.getByTestId('bombora-tab-cards').click()
  await expect(page.getByTestId('bombora-card-gaumarjos')).toContainText('за здоровье!')
  await shot(page, '5-home-cards')
  await page.getByTestId('bombora-home-close').click()
  await expect(page.getByTestId('gift-button')).toBeVisible()
})

test('подсказка в упражнении: кнопка подсвечивает верный ответ и тратится', async ({ page }) => {
  const calls = await setup(page)
  await page.goto('/?playwright=1')
  await page.getByTestId('dashboard-suggestion').getByRole('button').click()
  await expect(page.getByTestId('daily-warm-word')).toBeVisible({ timeout: 5000 })
  const hint = page.getByTestId('daily-hint')
  await expect(hint).toContainText('2')
  await hint.click()
  await expect(page.locator('[data-testid="daily-warm-option"][data-ok="yes"]').first()).toHaveClass(/td-hint/)
  await expect(hint).toContainText('1')
  expect(calls).toContain('hint')
  await shot(page, '6-hint')
  // Дальше — пары и проверка: кнопка в строке заголовка, рядом со счётом, ничего не закрывает.
  for (const r of TODAY.warm) await page.locator('[data-testid="daily-warm-option"][data-ok="yes"]').first().click()
  await expect(page.getByTestId('daily-game')).toBeVisible()
  const hb = (await page.getByTestId('daily-hint').boundingBox())!
  const score = (await page.getByTestId('daily-score').boundingBox())!
  expect(hb.x + hb.width).toBeLessThanOrEqual(score.x)
  await shot(page, '7-hint-pairs')
})
