import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { PRODUCTS, orderText } from '../src/alphabet/cafe/products'

// Алфавит: знакомство с буквой через грузинское слово (стереть поверхность → обвести букву → слово с подсвеченной
// буквой), одна игра в середине урока («Превращение» в нечётных, «Собери слово» в чётных) и «Кафе Бомборы» в конце,
// перед праздником. Вопросы — настоящие из уроков 5 и 6.
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

const GEO: Record<string, string> = { а: 'ა', д: 'დ', р: 'რ', е: 'ე', э: 'ე', и: 'ი', с: 'ს', в: 'ვ', м: 'მ', н: 'ნ', л: 'ლ', ч: 'ჩ', х: 'ხ', о: 'ო', ш: 'შ' }

/** Сцены между вопросами: знакомство с буквой — пропустить, игру в середине — пройти. */
async function playScenes(page: Page) {
  if (await page.getByTestId('intro-skip').isVisible().catch(() => false)) {
    await page.getByTestId('intro-skip').click()
    await page.getByRole('button', { name: 'дальше →' }).click()
  }
  if (await page.getByText('Преврати слово в грузинское').isVisible().catch(() => false)) {
    let first = true
    while (await page.getByTestId('morph-choice').first().isVisible().catch(() => false)) {
      if (first) { await shot(page, '5-morph'); first = false }
      const ru = (await page.getByText(/Какая грузинская буква/).textContent())!.match(/«(.+?)»/)![1].toLowerCase()
      await page.getByTestId('morph-choice').and(page.getByLabel(GEO[ru], { exact: true })).click()
      await page.waitForTimeout(120)
      if (await page.getByText(/читается/).isVisible()) {
        await page.waitForTimeout(500)
        await shot(page, '6-morph-done')
        await page.getByRole('button', { name: /следующее слово|дальше/ }).click()
      }
    }
  }
  if (await page.getByText('Собери грузинское слово').isVisible().catch(() => false)) {
    for (let round = 0; round < 2; round++) {
      if (round === 0) await shot(page, '7-assemble')
      const slots = await page.getByTestId('assemble-slot').count()
      // Нужную букву не вычисляем — пробуем плитки по очереди: игра сама не пускает неверную.
      for (let s = 0; s < slots; s++) {
        const tiles = page.getByTestId('assemble-tile')
        const n = await tiles.count()
        for (let t = 0; t < n; t++) {
          const tile = tiles.nth(t)
          if (await tile.isDisabled()) continue
          const before = await page.locator('[data-testid="assemble-slot"] span').count()
          await tile.click({ force: true })
          await page.waitForTimeout(450)
          if ((await page.locator('[data-testid="assemble-slot"] span').count()) > before) break
        }
      }
      await page.waitForTimeout(500)
      if (round === 0) await shot(page, '8-assemble-done')
      await page.getByRole('button', { name: /следующее слово|дальше/ }).click()
    }
  }
}

async function answerAll(page: Page, lesson: number) {
  const qs = questions(lesson)
  for (let i = 0; i < Math.min(10, qs.length); i++) {
    await playScenes(page)
    const q = qs[i]
    await expect(page.getByText(q.question)).toBeVisible()
    await page.getByRole('button', { name: new RegExp(`^[a-z]\\s*${q.options[q.answerIndex].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).click()
    await page.getByRole('button', { name: 'проверить' }).click()
    await page.getByRole('button', { name: /дальше →|итог →/ }).click()
  }
}

test('letter intro: wipe the snow of თოვლი, trace the letter, read the Georgian word', async ({ page }) => {
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
  await expect(stage).toHaveAttribute('data-phase', 'trace', { timeout: 5000 })
  await expect(page.getByText('Обведи букву пальцем')).toBeVisible()
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
  await expect(page.getByText(/Новая буква თ/)).toBeVisible()
})

test('odd lesson: Morph in the middle, then the cafe — a guided first guest, a timed shift — and the celebration', async ({ page }) => {
  test.setTimeout(60_000)
  await page.clock.install()
  await setup(page, [1, 2, 3, 4])
  await openModule(page)
  await page.getByTestId('lesson-btn-5').click()
  await page.getByRole('button', { name: /к практике/i }).click()
  await answerAll(page, 5)

  // Кафе — последняя игра урока.
  await expect(page.getByTestId('cafe')).toBeVisible()
  await expect(page.getByTestId('cafe-howto')).toHaveText('Гость заказывает по-грузински. Прочитай заказ и подай нужное')
  await expect(page.getByTestId('cafe-pointer')).toBeVisible()
  await expect(page.getByText('Собери грузинское слово')).toHaveCount(0)
  await page.waitForTimeout(700)
  await shot(page, '10-cafe-guided')

  // Первый гость — без таймера; после подачи следующий заходит сам, и идёт смена.
  await expect(page.getByTestId('cafe-timer')).toHaveCount(0)
  await expect(page.getByTestId('cafe-sign')).toHaveText('Бомбора')
  for (let guest = 0; guest < 3; guest++) {
    const order = (await page.getByTestId('cafe-guest').getAttribute('data-order'))!
    const id = PRODUCTS.find(p => orderText(p, 5) === order)!.id
    if (guest > 0) await expect(page.getByTestId('cafe-pointer')).toHaveCount(0)
    await page.getByTestId(`shelf-${id}`).click()
    await expect(page.getByTestId('cafe-meaning')).toBeVisible()
    if (guest === 1) { await page.waitForTimeout(500); await shot(page, '11-cafe-served') }
    await expect(page.getByTestId('cafe-meaning')).toHaveCount(0, { timeout: 3000 })
    await expect(page.getByTestId('cafe-timer')).toBeVisible()
  }
  // Смена 45 секунд — проматываем часы страницы.
  await page.clock.runFor(46_000)
  await expect(page.getByTestId('cafe-summary')).toBeVisible()
  await page.waitForTimeout(500)
  await shot(page, '12-cafe-summary')
  await page.getByRole('button', { name: 'дальше →' }).click()

  await expect(page.getByTestId('alphabet-finale')).toBeVisible()
  await page.waitForTimeout(3500)
  await expect(page.getByTestId('finale-letters')).toHaveText('15 из 33')
  await expect(page.getByText(/кафе/i)).toHaveCount(0)
  await shot(page, '9-finale')
})

test('even lesson: «Собери слово» in the middle instead of «Превращение»; no cafe tile on the module map', async ({ page }) => {
  await setup(page, [1, 2, 3, 4, 5], 6)
  await openModule(page)
  await expect(page.getByTestId('cafe-tile')).toHaveCount(0)
  await page.getByTestId('lesson-btn-6').click()
  await page.getByRole('button', { name: /к практике/i }).click()
  let sawAssemble = false
  const qs = questions(6)
  for (let i = 0; i < 7; i++) {
    if (await page.getByText('Собери грузинское слово').isVisible().catch(() => false)) sawAssemble = true
    expect(await page.getByText('Преврати слово в грузинское').isVisible().catch(() => false)).toBe(false)
    await playScenes(page)
    if (i === 6) break
    const q = qs[i]
    await expect(page.getByText(q.question)).toBeVisible()
    await page.getByRole('button', { name: new RegExp(`^[a-z]\\s*${q.options[q.answerIndex].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).click()
    await page.getByRole('button', { name: 'проверить' }).click()
    await page.getByRole('button', { name: /дальше →|итог →/ }).click()
  }
  expect(sawAssemble).toBe(true)
  await expect(page.getByText(qs[6].question)).toBeVisible()
})
