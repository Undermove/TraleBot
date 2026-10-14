import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { PRODUCTS, orderText } from '../src/alphabet/cafe/products'

// Алфавит — урок как цепочка игр: знакомство с буквой (стереть поверхность → как пишется → слово), «Поймай букву»,
// «Пары», «Звук → буква», новые слова, «Превращение» / «Собери слово», «Кафе Бомборы» (с пятого урока), короткая
// проверка из 4 вопросов, праздник со словами в словаре. Каждый экран игры помещается в окно без прокрутки —
// проверяем на iPhone SE (375×667) и iPhone 12 (390×844). Вопросы — настоящие из уроков.
// SHOTS_DIR=… — сохранить скриншоты для описания PR.

const SHOTS = process.env.SHOTS_DIR
const shot = async (page: Page, name: string) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }) }

const lessonFile = (n: number) => JSON.parse(readFileSync(resolve(process.cwd(), `../Lessons/GeorgianAlphabetProgressive/questions${n === 1 ? '' : n}.json`), 'utf8'))
const questions = (n: number) => lessonFile(n).questions.map((q: any) => ({
  id: q.id, lemma: q.lemma, question: q.question, options: q.options, answerIndex: q.answer_index, explanation: q.explanation
}))

const catalog = {
  botUsername: 'TraleBot', miniAppEnabled: true,
  modules: [{
    id: 'alphabet-progressive', title: 'Алфавит', emoji: '', description: '33 буквы',
    lessons: Array.from({ length: 11 }, (_, i) => ({ id: i + 1, title: `Урок ${i + 1}`, short: `L${i + 1}`, theory: { title: `Урок ${i + 1}`, goal: 'g', blocks: [] } }))
  }]
}
const progress = (done: number[]) => ({ xp: 100, streak: 1, lastPlayedAtUtc: null, completedLessons: { 'alphabet-progressive': done }, xpSpent: 0, totalTreatsGiven: 0, lastFedAtUtc: null, lastTreatIndex: null })

async function setup(page: Page, done: number[], lesson = 5) {
  await page.addInitScript(() => {
    ;(window as any).Telegram = { WebApp: {
      initData: 'user=%7B%22id%22%3A123456%7D',
      BackButton: { show: () => {}, hide: () => {}, onClick: () => {}, offClick: () => {} },
      MainButton: { show: () => {}, hide: () => {} },
      HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {} },
      openTelegramLink: () => {}
    } }
    try { localStorage.setItem('bombora_kani_reveal_shown', '1') } catch {}
  })
  await page.route('**/api/miniapp/content', r => r.fulfill({ json: catalog }))
  await page.route('**/api/miniapp/me', r => r.fulfill({ json: { authenticated: true, isPro: true, isTrialActive: false, trialDaysLeft: 0, level: 'beginner', vocabularyCount: 0, progress: progress(done) } }))
  await page.route(`**/api/miniapp/modules/alphabet-progressive/lessons/${lesson}/questions`, r => r.fulfill({ json: questions(lesson) }))
  await page.route('**/api/miniapp/activity-days*', r => r.fulfill({ json: { dates: [] } }))
  await page.route('**/api/miniapp/progress/answer', r => r.fulfill({ json: { xpEarned: 1, progress: progress(done) } }))
  await page.route('**/api/miniapp/vocabulary/alphabet-words', r => r.fulfill({ json: { words: [{ word: 'და', translation: 'и', added: true }, { word: 'არა', translation: 'нет', added: true }, { word: 'რა', translation: 'что', added: true }], added: 3 } }))
  await page.route('**/api/miniapp/progress/lesson-complete', r => r.fulfill({ json: { xpEarned: 20, progress: progress([...done, lesson]) } }))
}

async function openModule(page: Page) {
  await page.goto('/?playwright=1')
  const tile = page.locator('[data-testid="module-tile-alphabet-progressive"]')
  await expect(tile).toBeVisible({ timeout: 15_000 })
  await tile.click()
}

/** Провести пальцем зигзагом по всей сцене. */
async function rub(page: Page, rows = 14) {
  const box = (await page.getByTestId('intro-touch').boundingBox())!
  await page.mouse.move(box.x + 5, box.y + 5)
  await page.mouse.down()
  for (let r = 0; r <= rows; r++) {
    const y = box.y + (box.height * r) / rows
    await page.mouse.move(r % 2 ? box.x + 5 : box.x + box.width - 5, y, { steps: 12 })
  }
  await page.mouse.up()
}

test('letter intro: wipe the snow of თოვლი, watch how it is written, write it, read the Georgian word', async ({ page }) => {
  test.setTimeout(60_000)
  await setup(page, [1, 2, 3, 4])
  await openModule(page)
  await page.getByTestId('lesson-btn-5').click()
  await page.getByRole('button', { name: /к практике/i }).click()

  const stage = page.getByTestId('intro-stage')
  await expect(stage).toHaveAttribute('data-ready', 'yes')
  await expect(page.getByText('Смахни снег')).toBeVisible()
  await shot(page, '1-intro-surface')

  await rub(page, 4)
  await shot(page, '2-intro-wiping')
  for (let i = 0; i < 4 && (await stage.getAttribute('data-phase')) === 'reveal'; i++) await rub(page)
  await expect(stage).toHaveAttribute('data-phase', /demo|trace/, { timeout: 5000 })
  await expect(stage).toHaveAttribute('data-phase', 'trace', { timeout: 6000 })
  await expect(page.getByText('Теперь ты')).toBeVisible()
  // «ещё раз показать» — перо снова выводит букву.
  await page.getByTestId('intro-replay').click()
  await expect(page.getByText('Как пишется')).toBeVisible()
  await expect(page.getByTestId('intro-pen')).toBeVisible()
  await page.waitForTimeout(1100)
  await shot(page, '2b-intro-demo')
  await expect(stage).toHaveAttribute('data-phase', 'trace', { timeout: 6000 })
  await expect(page.getByTestId('intro-start')).toBeVisible()
  await page.waitForTimeout(300)
  await rub(page, 5)
  await shot(page, '3-intro-trace')
  for (let i = 0; i < 4 && (await stage.getAttribute('data-phase')) === 'trace'; i++) await rub(page, 30)
  await expect(page.getByTestId('intro-word')).toHaveText('თოვლი')
  await expect(page.getByTestId('intro-meaning')).toHaveText('товли — снег')
  await expect(page.getByTestId('intro-caption')).toContainText('თ — звук «т»')
  await page.waitForTimeout(600)
  await shot(page, '4-intro-caption')
  await page.getByRole('button', { name: 'дальше →' }).click()
  await expect(page.getByText(/новая буква · 2 из 3/)).toBeVisible()
})

/** Экран игры целиком в окне: страница не прокручивается. */
async function fits(page: Page, where: string) {
  const [h, inner] = await page.evaluate(() => [document.scrollingElement!.scrollHeight, window.innerHeight])
  expect(h, `${where}: page scrolls (${h} > ${inner})`).toBeLessThanOrEqual(inner)
}

const seen = new Set<string>()
/** Снимок — один раз на сцену и только в большом окне (для описания PR). */
async function shotOnce(page: Page, name: string) {
  if (seen.has(name) || (page.viewportSize()?.height ?? 0) < 800) return
  seen.add(name); await shot(page, name)
}

async function tryEach(page: Page, testId: string, solved: () => Promise<boolean>) {
  const items = page.getByTestId(testId)
  for (let i = 0; i < await items.count(); i++) {
    if (await solved()) return
    await items.nth(i).click({ force: true }).catch(() => {})
    await page.waitForTimeout(160)
  }
}

/** Пройти игры урока до проверки — каждая сцена: помещается в окно, снимок, игра. */
async function playGames(page: Page) {
  for (let guard = 0; guard < 40; guard++) {
    await page.waitForTimeout(250)
    if (await page.getByTestId('intro-skip').isVisible().catch(() => false)) {
      await fits(page, 'letter intro')
      await page.getByTestId('intro-skip').click()
      await fits(page, 'letter caption')
      await page.getByRole('button', { name: 'дальше →' }).click()
      continue
    }
    if (await page.getByTestId('catch').isVisible().catch(() => false)) {
      await fits(page, 'catch'); await shotOnce(page, '15-catch')
      const targets = page.locator('[data-testid="catch-bubble"][data-target="yes"]:not([disabled])')
      while (await targets.count()) { await targets.first().dispatchEvent('pointerdown'); await page.waitForTimeout(120) }
      await page.waitForTimeout(600)
      continue
    }
    if (await page.getByTestId('pairs').isVisible().catch(() => false)) {
      await fits(page, 'pairs')
      for (const pair of ['p0', 'p1', 'p2']) {
        const cards = page.locator(`[data-testid="pair-card"][data-pair="${pair}"]`)
        await cards.nth(0).click(); if (pair === 'p0') { await page.waitForTimeout(500); await shotOnce(page, '16-pairs') }
        await cards.nth(1).click(); await page.waitForTimeout(450)
      }
      await page.waitForTimeout(1300)
      continue
    }
    if (await page.getByTestId('sound-letter').isVisible().catch(() => false)) {
      await fits(page, 'sound → letter'); await shotOnce(page, '17-sound-letter')
      await tryEach(page, 'sound-choice', async () => (await page.locator('[data-testid="sound-choice"].bg-navy').count()) > 0)
      await page.waitForTimeout(1400)
      continue
    }
    if (await page.getByTestId('word-intro').isVisible().catch(() => false)) {
      await fits(page, 'new word')
      const tiles = page.getByTestId('word-tile')
      const n = await tiles.count()
      for (let i = 0; i < n; i++) {
        await tiles.nth(i).dispatchEvent('pointerdown', { pointerId: 1, isPrimary: true })
        if (i === 0 && n > 1) { await page.waitForTimeout(250); await shotOnce(page, '13-word-tapping') }
      }
      await expect(page.getByTestId('word-intro')).toHaveAttribute('data-phase', 'meaning', { timeout: 4000 })
      await page.waitForTimeout(900); await shotOnce(page, '14-word-meaning')
      await page.getByRole('button', { name: 'в словарь →' }).click()
      await page.waitForTimeout(700)
      continue
    }
    if (await page.getByTestId('word-list').isVisible().catch(() => false)) {
      await fits(page, 'word list')
      await page.getByRole('button', { name: 'дальше →' }).click()
      continue
    }
    if (await page.getByText('Преврати слово в грузинское').isVisible().catch(() => false)) {
      await fits(page, 'morph'); await shotOnce(page, '5-morph')
      while (await page.getByTestId('morph-choice').first().isVisible().catch(() => false)) {
        const before = await page.locator('[data-testid^="morph-tile-"][data-turned="yes"]').count()
        await tryEach(page, 'morph-choice', async () => (await page.locator('[data-testid^="morph-tile-"][data-turned="yes"]').count()) > before || await page.getByTestId('morph-meaning').isVisible())
        if (await page.getByTestId('morph-meaning').isVisible()) {
          await page.waitForTimeout(500); await shotOnce(page, '6-morph-done')
          await page.getByRole('button', { name: /следующее слово|дальше/ }).click()
        }
      }
      continue
    }
    if (await page.getByText('Собери грузинское слово').isVisible().catch(() => false)) {
      await fits(page, 'assemble'); await shotOnce(page, '7-assemble')
      for (let round = 0; round < 2; round++) {
        const slots = await page.getByTestId('assemble-slot').count()
        for (let s = 0; s < slots; s++) {
          const before = await page.locator('[data-testid="assemble-slot"] span').count()
          await tryEach(page, 'assemble-tile', async () => (await page.locator('[data-testid="assemble-slot"] span').count()) > before)
          await page.waitForTimeout(350)
        }
        await page.waitForTimeout(500)
        if (round === 0) await shotOnce(page, '8-assemble-done')
        await page.getByRole('button', { name: /следующее слово|дальше/ }).click()
      }
      continue
    }
    if (await page.getByTestId('cafe').isVisible().catch(() => false)) {
      await fits(page, 'cafe')
      await expect(page.getByTestId('cafe-howto')).toHaveText('Гость заказывает по-грузински. Прочитай заказ и подай нужное')
      await expect(page.getByTestId('cafe-sign')).toHaveText('Бомбора')
      await page.waitForTimeout(700); await shotOnce(page, '10-cafe-guided')
      for (let guest = 0; guest < 3; guest++) {
        const order = (await page.getByTestId('cafe-guest').getAttribute('data-order'))!
        const id = PRODUCTS.find(p => p.geo === order)!.id
        await page.getByTestId(`shelf-${id}`).click()
        await expect(page.getByTestId('cafe-meaning')).toBeVisible()
        if (guest === 1) { await page.waitForTimeout(400); await shotOnce(page, '11-cafe-served') }
        await expect(page.getByTestId('cafe-meaning')).toHaveCount(0, { timeout: 3000 })
        await expect(page.getByTestId('cafe-timer')).toBeVisible()
        await fits(page, 'cafe shift')
      }
      await page.clock.runFor(46_000)
      await expect(page.getByTestId('cafe-summary')).toBeVisible()
      await fits(page, 'cafe summary'); await page.waitForTimeout(400); await shotOnce(page, '12-cafe-summary')
      await page.getByRole('button', { name: 'дальше →' }).click()
      continue
    }
    return
  }
}

/** Короткая проверка: последние 4 вопроса урока. */
async function exam(page: Page, lesson: number) {
  const qs = questions(lesson).slice(-4)
  for (const q of qs) {
    await expect(page.getByText(q.question)).toBeVisible()
    await page.getByRole('button', { name: new RegExp(`^[a-z]\\s*${q.options[q.answerIndex].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).click()
    await page.getByRole('button', { name: 'проверить' }).click()
    await page.getByRole('button', { name: /дальше →|итог →/ }).click()
  }
}

for (const size of [{ width: 375, height: 667 }, { width: 390, height: 844 }]) {
  test.describe(`${size.width}×${size.height}`, () => {
    test.use({ viewport: size })

    test('early lesson 1: letters, catch, pairs, new words, morph, a 4-question check, words fly into the dictionary', async ({ page }) => {
      test.setTimeout(90_000)
      await setup(page, [], 1)
      await openModule(page)
      await page.getByTestId('lesson-btn-1').click()
      await page.getByRole('button', { name: /к практике/i }).click()
      await playGames(page)
      await exam(page, 1)
      await expect(page.getByTestId('alphabet-finale')).toBeVisible()
      await page.waitForTimeout(4000)
      await expect(page.getByTestId('finale-dict')).toContainText('Эти слова теперь в твоём словаре')
      await expect(page.getByTestId('dict-count')).toHaveText('3')
      await fits(page, 'finale')
      await shotOnce(page, '9-finale')
      await page.getByRole('button', { name: 'открыть словарь' }).click()
    })

    test('late lesson 10: catch, sound → letter, new words, assemble, the cafe with a guided guest and a timed shift, the check', async ({ page }) => {
      test.setTimeout(90_000)
      await page.clock.install()
      await setup(page, [1, 2, 3, 4, 5, 6, 7, 8, 9], 10)
      await openModule(page)
      await page.getByTestId('lesson-btn-10').click()
      await page.getByRole('button', { name: /к практике/i }).click()
      await playGames(page)
      await exam(page, 10)
      await expect(page.getByTestId('alphabet-finale')).toBeVisible()
      await expect(page.getByTestId('cafe-tile')).toHaveCount(0)
    })
  })
}
