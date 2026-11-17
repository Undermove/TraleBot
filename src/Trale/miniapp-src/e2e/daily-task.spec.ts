import { test, expect, type Page } from '@playwright/test'
import { readFileSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

// «Задание дня» глазами человека: карточка на главной → вступление → разминка → пары → с русского на грузинский →
// проверка → итог → «новое» или ещё раунд.
// Задания — настоящие ответы сервера на настоящем профиле (fixtures/daily, их пишет DailyTaskService), вопросы
// минутной проверки — из файлов уроков «Знакомства»: грузинское здесь не пишется от руки.
// DAILY_SHOTS=<папка> — сохранить снимки каждого шага (375×667) для проверки глазами.

const here = dirname(fileURLToPath(import.meta.url))
const fixture = (name: string) => JSON.parse(readFileSync(resolve(here, 'fixtures/daily', name), 'utf8'))
const introQuestions = (lessonId: number) =>
  JSON.parse(readFileSync(resolve(here, `../../Lessons/GeorgianVocabIntro/questions${lessonId}.json`), 'utf8')).questions
    .map((q: any) => ({ id: q.id, question: q.question, options: q.options, answerIndex: q.answer_index, explanation: q.explanation, questionType: 'choice' }))

const TODAY = fixture('today.json')
const CLEAN = fixture('after-result.json')
const WITH_ERRORS = fixture('errors/after-result.json')
const EXTRA = fixture('extra.json')
const CHECK = {
  kind: 'check', title: 'Знакомство', line: 'проверка на минуту', button: 'Пройти проверку',
  say: 'Последний урок модуля «Знакомство» у тебя пройден, а 22 урока пропущены. Ответь без ошибок на 6 вопросов из них — и модуль закрыт.',
  moduleId: 'intro', checkLessons: [10, 11, 12, 13, 14, 15]
}

interface Mock {
  task: any
  access?: boolean
  /** Задание пока открыто только владельцу: остальным сервер отвечает 404. */
  owner?: boolean
  results: any[]
  offers: any[]
  extras: any[]
  /** Сколько ещё раундов сервер готов дать. */
  extraLeft?: number
  requests: string[]
}

async function setup(page: Page, task: any, patch: Partial<Mock> = {}): Promise<Mock> {
  const mock: Mock = { task, access: true, owner: true, results: [], offers: [], extras: [], extraLeft: 1, requests: [], ...patch }
  await page.addInitScript(() => {
    ;(window as any).Telegram = {
      WebApp: {
        initData: 'user=%7B%22id%22%3A123456%7D',
        BackButton: { show: () => {}, hide: () => {}, onClick: () => {}, offClick: () => {} },
        MainButton: { show: () => {}, hide: () => {} },
        HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {} },
        openTelegramLink: () => {}
      }
    }
  })
  const catalog = {
    botUsername: 'TraleBot', miniAppEnabled: true,
    modules: [
      { id: 'alphabet-progressive', title: 'Алфавит', emoji: '', description: '', lessons: [{ id: 1, title: 'Первые буквы', short: '' }] },
      { id: 'cases', title: 'Падежи', emoji: '', description: '', lessons: Array.from({ length: 10 }, (_, i) => ({ id: i + 1, title: `Урок ${i + 1}`, short: '' })) },
      { id: 'intro', title: 'Знакомство', emoji: '', description: '', lessons: Array.from({ length: 33 }, (_, i) => ({ id: i + 1, title: `Урок ${i + 1}`, short: '' })) }
    ]
  }
  const progress = { xp: 2173, streak: 2, lastPlayedAtUtc: '2026-11-16T09:31:43Z', completedLessons: { 'alphabet-progressive': [1], cases: [1, 2, 3, 4, 5, 6, 7] }, xpSpent: 0, totalTreatsGiven: 0, lastFedAtUtc: null, lastTreatIndex: null }
  await page.route('**/api/miniapp/**', (route: any) => {
    const request = route.request()
    const path = decodeURIComponent(new URL(request.url()).pathname).replace('/api/miniapp/', '')
    const body = () => { try { return JSON.parse(request.postData() ?? '{}') } catch { return {} } }
    mock.requests.push(path)
    if (path === 'content') return route.fulfill({ json: catalog })
    if (path === 'me') {
      return route.fulfill({ json: {
        authenticated: true, isPro: mock.access, isTrialActive: false, trialDaysLeft: 0, hasAccess: mock.access,
        shouldShowReferralExtensionCta: false, level: 'beginner', vocabularyCount: 752, uiHintsSeen: [], progress
      } })
    }
    if (path === 'daily-task') {
      if (!mock.owner) return route.fulfill({ status: 404, json: {} })
      return mock.access ? route.fulfill({ json: mock.task }) : route.fulfill({ status: 402, json: { error: 'subscription_required' } })
    }
    if (path === 'daily-task/result') {
      const report = body()
      mock.results.push(report)
      const played = report.pairWrong.length > 1 ? WITH_ERRORS : CLEAN
      mock.task = { ...played, dev: false }
      return route.fulfill({ json: { task: mock.task, xpEarned: 20, progress: { ...progress, xp: progress.xp + 20, streak: 3 } } })
    }
    if (path === 'daily-task/extra') {
      return route.fulfill({ json: { extra: mock.extraLeft! > 0 ? EXTRA : null } })
    }
    if (path === 'daily-task/extra/result') {
      mock.extras.push(body())
      mock.extraLeft! -= 1
      const extras = (mock.task.extras ?? 0) + 1
      mock.task = { ...mock.task, extras, result: { ...mock.task.result, xpEarned: mock.task.result.xpEarned + 10 } }
      return route.fulfill({ json: { task: mock.task, xpEarned: 10, progress: { ...progress, xp: progress.xp + 30, streak: 3 } } })
    }
    if (path === 'daily-task/offer') {
      mock.offers.push(body())
      mock.task = { ...mock.task, offerTaken: true }
      return route.fulfill({ json: { task: mock.task } })
    }
    const lesson = path.match(/^modules\/intro\/lessons\/(\d+)\/questions$/)
    if (lesson) return route.fulfill({ json: introQuestions(Number(lesson[1])) })
    if (path === 'verbs/section') return route.fulfill({ json: { levels: [], mine: [], learned: 0, total: 0, next: null } })
    if (path.startsWith('activity-days')) return route.fulfill({ json: { dates: [] } })
    return route.fulfill({ status: 404, json: {} })
  })
  return mock
}

const shotsDir = process.env.DAILY_SHOTS
async function shot(page: Page, name: string) {
  // На каждом шаге всё помещается в экран: прокрутки нет.
  const fits = await page.evaluate(() => document.scrollingElement!.scrollHeight <= window.innerHeight + 1)
  expect(fits, `${name}: экран прокручивается`).toBe(true)
  if (!shotsDir) return
  mkdirSync(shotsDir, { recursive: true })
  await page.waitForTimeout(400)
  await page.screenshot({ path: resolve(shotsDir, `${name}.png`) })
}

async function openFromCard(page: Page) {
  await page.goto('/?playwright=1')
  const card = page.getByTestId('dashboard-daily')
  await expect(card).toBeVisible({ timeout: 10_000 })
  await card.click()
}

async function playWarm(page: Page, wrongFirst = false) {
  for (let i = 0; i < TODAY.warm.length; i++) {
    await expect(page.getByTestId('daily-warm-word')).toHaveAttribute('data-key', TODAY.warm[i].item.key)
    if (i === 0) await shot(page, '2-warm')
    await page.locator(`[data-testid="daily-warm-option"][data-ok="${wrongFirst && i === 0 ? 'no' : 'yes'}"]`).first().click()
  }
}

async function playPairs(page: Page, pairs: any[], mistakes = 0) {
  await expect(page.getByTestId('daily-game')).toBeVisible({ timeout: 5000 })
  await shot(page, '3-game')
  for (let m = 0; m < mistakes; m++) {
    await page.locator(`[data-testid="daily-tile-l"][data-key="${pairs[m].key}"]`).click()
    await page.locator(`[data-testid="daily-tile-r"][data-key="${pairs[m + 1].key}"]`).click()
    await page.waitForTimeout(450)
  }
  for (const p of pairs) {
    await page.locator(`[data-testid="daily-tile-l"][data-key="${p.key}"]`).click()
    await page.locator(`[data-testid="daily-tile-r"][data-key="${p.key}"]`).click()
  }
  await expect(page.getByTestId('daily-game-say')).toHaveText('Все пары собраны.')
}

/** С русского на грузинский: по раунду на значение; wrongFirst — в первом раунде ошибиться. */
async function playBack(page: Page, rounds: any[], wrongFirst = false) {
  await expect(page.getByTestId('daily-back')).toBeVisible({ timeout: 5000 })
  for (let i = 0; i < rounds.length; i++) {
    await expect(page.getByTestId('daily-back-word')).toHaveAttribute('data-key', rounds[i].item.key)
    await expect(page.getByTestId('daily-back-word')).toHaveText(rounds[i].item.ru)
    if (i === 0) {
      // Варианты — грузинские, с транскрипцией.
      await expect(page.getByTestId('daily-back-option').first().getByTestId('daily-cyr')).toBeVisible()
      await shot(page, '35-back')
    }
    const wrong = wrongFirst && i === 0
    await page.locator(`[data-testid="daily-back-option"][data-ok="${wrong ? 'no' : 'yes'}"]`).first().click()
    if (wrong) await expect(page.getByTestId('daily-back-note')).toContainText(`Правильно: ${rounds[0].item.ka}`)
  }
}

async function playCheck(page: Page, check: any = TODAY.check) {
  await expect(page.getByTestId('daily-check')).toBeVisible({ timeout: 5000 })
  await expect(page.getByTestId('daily-check-say')).toHaveText(check.intro)
  await shot(page, '4-check')
  const wrong = check.picks.findIndex((p: any) => !p.ok)
  await page.getByTestId('daily-pick').nth(wrong).click()
  await expect(page.getByTestId('daily-check-say')).toHaveText(check.picks[wrong].message)
  await page.locator('[data-testid="daily-pick"][data-ok="yes"]').click()
  await expect(page.getByTestId('daily-check-say')).toHaveText(check.picks.find((p: any) => p.ok).message)
  await page.getByRole('button', { name: 'Готово' }).click()
}

test.describe('Задание дня', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('чистый проход: карточка → разминка → пары → проверка → итог → новые формы', async ({ page }) => {
    const mock = await setup(page, TODAY)
    await page.goto('/?playwright=1')
    const card = page.getByTestId('dashboard-daily')
    await expect(card).toBeVisible({ timeout: 10_000 })
    await expect(card).toHaveAttribute('data-state', 'next')
    await expect(page.getByTestId('dashboard-today')).toHaveAttribute('data-next', 'review')
    await expect(page.getByTestId('dashboard-daily-title')).toHaveText(TODAY.title)
    await shot(page, '0-dashboard')
    await card.click()

    await expect(page.getByTestId('daily-chat')).toHaveText(TODAY.chat)
    await shot(page, '1-intro')
    await page.getByTestId('daily-why-link').click()
    await expect(page.getByTestId('daily-why')).toContainText(TODAY.why[0])
    await page.getByRole('button', { name: 'Понятно' }).click()
    await expect(page.getByTestId('daily-why')).toBeHidden()
    await page.getByRole('button', { name: TODAY.button }).click()

    await expect(page.getByTestId('daily-steps')).toHaveAttribute('data-steps', '4')
    await playWarm(page)
    await playPairs(page, TODAY.pairs)
    await playBack(page, TODAY.back)
    await playCheck(page)

    await expect(page.getByTestId('daily-finale')).toBeVisible()
    expect(mock.results).toHaveLength(1)
    expect(mock.results[0]).toMatchObject({ day: TODAY.day, warmWrong: [], pairWrong: [], backWrong: [], errors: 0, checkErrors: 1 })
    await expect(page.getByTestId('daily-streak')).toContainText('2')
    await expect(page.getByTestId('daily-xp')).toContainText('+20')
    await expect(page.getByTestId('daily-offer')).toHaveAttribute('data-kind', 'forms')
    await expect(page.getByTestId('daily-finale-say')).toHaveText(CLEAN.offer.say)
    await shot(page, '5-finale')

    await page.getByRole('button', { name: CLEAN.offer.button }).click()
    await expect.poll(() => mock.offers).toEqual([{ day: TODAY.day, outcome: 'opened' }])
    // Новые формы открываются сессией глагола — она просит у сервера сам глагол.
    await expect.poll(() => mock.requests.some(r => r.startsWith(`verbs/${CLEAN.offer.verbId}`))).toBe(true)
  })

  test('ошибки в разминке, в парах и на обратном пути уходят на сервер, нового нет', async ({ page }) => {
    const mock = await setup(page, TODAY)
    await openFromCard(page)
    await page.getByRole('button', { name: TODAY.button }).click()
    await playWarm(page, true)
    await playPairs(page, TODAY.pairs, 2)
    await playBack(page, TODAY.back, true)
    await playCheck(page)

    await expect(page.getByTestId('daily-finale')).toBeVisible()
    const report = mock.results[0]
    expect(report.warmWrong).toEqual([TODAY.warm[0].item.key])
    expect(report.backWrong).toEqual([TODAY.back[0].item.key])
    expect(report.errors).toBe(2)
    expect(report.pairWrong).toEqual(expect.arrayContaining([TODAY.pairs[0].key, TODAY.pairs[1].key, TODAY.pairs[2].key]))
    await expect(page.getByTestId('daily-offer')).toHaveCount(0)
    await expect(page.getByTestId('daily-finale-say')).toContainText('Нового сегодня нет')
    await page.getByRole('button', { name: 'На главную' }).click()
    await expect(page.getByTestId('dashboard-daily')).toHaveAttribute('data-state', 'done')
    await expect(page.getByTestId('dashboard-daily-line')).toHaveText('Сделано на сегодня')
    // Нового задание не предложило — вторым шагом остаётся следующий урок курса.
    await expect(page.getByTestId('dashboard-today')).toHaveAttribute('data-next', 'new')
  })

  test('время вышло: несобранное — ошибки, можно сыграть ещё раз', async ({ page }) => {
    await page.clock.install()
    const mock = await setup(page, { ...TODAY, warm: [] })
    await openFromCard(page)
    await page.getByRole('button', { name: TODAY.button }).click()
    await expect(page.getByTestId('daily-steps')).toHaveAttribute('data-steps', '3')
    const first = TODAY.pairs[0]
    await page.locator(`[data-testid="daily-tile-l"][data-key="${first.key}"]`).click()
    await page.locator(`[data-testid="daily-tile-r"][data-key="${first.key}"]`).click()
    await page.clock.runFor((TODAY.seconds + 1) * 1000)
    await expect(page.getByText('Время вышло').first()).toBeVisible()
    await shot(page, '3-timeout')
    await page.getByRole('button', { name: 'Сыграть ещё раз' }).click()
    await playPairs(page, TODAY.pairs)
    await page.clock.runFor(1500)
    for (let i = 0; i < TODAY.back.length; i++) {
      await expect(page.getByTestId('daily-back-word')).toHaveAttribute('data-key', TODAY.back[i].item.key)
      await page.locator('[data-testid="daily-back-option"][data-ok="yes"]').click()
      await page.clock.runFor(1000)
    }
    await expect(page.getByTestId('daily-check')).toBeVisible()
    await page.locator('[data-testid="daily-pick"][data-ok="yes"]').click()
    await page.getByRole('button', { name: 'Готово' }).click()
    await expect.poll(() => mock.results.length).toBe(1)
    expect(mock.results[0].errors).toBe(TODAY.pairs.length - 1)
    expect(mock.results[0].pairWrong).toEqual(TODAY.pairs.slice(1).map((p: any) => p.key))
  })

  test('уже сделано сегодня: карточка ведёт к «новому», потом — «сделано»', async ({ page }) => {
    const mock = await setup(page, CLEAN)
    await page.goto('/?playwright=1')
    await expect(page.getByTestId('dashboard-daily')).toHaveAttribute('data-state', 'done', { timeout: 10_000 })
    await expect(page.getByTestId('dashboard-today-new')).toHaveAttribute('data-state', 'next')
    await expect(page.getByTestId('dashboard-today-new')).toContainText(CLEAN.offer.title)
    await page.getByTestId('dashboard-suggestion').getByRole('button').click()
    await expect(page.getByTestId('daily-finale')).toBeVisible()
    await expect(page.getByTestId('daily-offer')).toBeVisible()
    expect(mock.results).toHaveLength(0)
  })

  for (const passed of [true, false]) {
    test(`минутная проверка модуля: ${passed ? 'пройдена' : 'не пройдена'}`, async ({ page }) => {
      const mock = await setup(page, { ...CLEAN, offer: CHECK, next: CHECK })
      await openFromCard(page)
      await expect(page.getByTestId('daily-offer')).toHaveAttribute('data-kind', 'check')
      await page.getByRole('button', { name: 'Пройти проверку' }).click()
      for (let i = 0; i < CHECK.checkLessons.length; i++) {
        await expect(page.getByTestId('daily-steps')).toHaveAttribute('data-at', String(i + 1))
        if (i === 0) {
          await expect(page.getByTestId('daily-minute-cyr')).toBeVisible()
          await shot(page, '6-minute')
        }
        await page.locator(`[data-testid="daily-minute-option"][data-ok="${!passed && i === 2 ? 'no' : 'yes'}"]`).first().click()
        await page.getByRole('button', { name: i + 1 < CHECK.checkLessons.length ? 'Дальше' : 'Готово' }).click()
      }
      await expect(page.getByTestId('daily-minute-say')).toContainText(passed ? 'тебе не нужны' : 'пригодятся')
      await shot(page, passed ? '7-minute-passed' : '7-minute-failed')
      expect(mock.offers).toEqual([{ day: CLEAN.day, outcome: passed ? 'passed' : 'failed' }])
      await page.getByRole('button', { name: 'Готово' }).click()
      await expect(page.getByTestId('daily-finale')).toBeVisible()
      await expect(page.getByTestId('daily-offer')).toHaveCount(0)
    })
  }

  test('после задания — ещё раунд: пары → с русского на грузинский → проверка, +10 опыта, пока есть что повторять', async ({ page }) => {
    const mock = await setup(page, { ...WITH_ERRORS, extras: 0 }, { extraLeft: 1 })
    await openFromCard(page)
    await expect(page.getByTestId('daily-finale')).toBeVisible()
    await shot(page, '8-finale-extra')
    await page.getByRole('button', { name: 'Ещё раунд · +10 опыта' }).click()

    await expect(page.getByTestId('daily-chat')).toHaveText(EXTRA.chat)
    await page.getByRole('button', { name: EXTRA.button }).click()
    // Без разминки: пары, обратный путь, проверка.
    await expect(page.getByTestId('daily-steps')).toHaveAttribute('data-steps', '3')
    await playPairs(page, EXTRA.pairs)
    await playBack(page, EXTRA.back)
    await playCheck(page, EXTRA.check)

    await expect(page.getByTestId('daily-finale')).toBeVisible()
    expect(mock.results).toHaveLength(0)
    expect(mock.extras).toHaveLength(1)
    expect(mock.extras[0]).toMatchObject({ day: EXTRA.day, pairWrong: [], backWrong: [] })
    await expect(page.getByTestId('daily-xp')).toContainText(`+${WITH_ERRORS.result.xpEarned + 10}`)
    await expect(page.getByTestId('daily-stat')).toContainText('ещё 1 раунд')

    // Повторять больше нечего — так и говорим, кнопки раунда нет.
    await page.getByRole('button', { name: 'Ещё раунд · +10 опыта' }).click()
    await expect(page.getByTestId('daily-finale-say')).toHaveText('На сегодня повторено всё, что открыто. Завтра будет новое задание.')
    await expect(page.getByTestId('daily-extra')).toHaveCount(0)
  })

  test('без доступа карточки нет', async ({ page }) => {
    await setup(page, TODAY, { access: false })
    await page.goto('/?playwright=1')
    await expect(page.getByTestId('home-tabs')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('dashboard-daily')).toHaveCount(0)
  })

  test('пока задание открыто только владельцу: остальным карточки нет', async ({ page }) => {
    await setup(page, TODAY, { owner: false })
    await page.goto('/?playwright=1')
    await expect(page.getByTestId('home-tabs')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('dashboard-daily')).toHaveCount(0)
  })

  test('ссылка из сообщения бота открывает задание', async ({ page }) => {
    await setup(page, TODAY)
    await page.goto('/?playwright=1&screen=daily')
    await expect(page.getByTestId('daily-intro')).toBeVisible({ timeout: 10_000 })
  })
})
