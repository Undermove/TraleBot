import { test, expect, type Page } from '@playwright/test'
import { mkdirSync, readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

// Обратная связь глазами человека: вопрос «Что остановило?» после закрытого экрана покупки, экран
// «Написать автору» (из профиля и по кнопке «Написать подробнее» из опроса), а у владельца — подразделы
// админки: конструктор опроса от готовой заготовки до отправки себе и «Отзывы».
// API подменяется; заготовки опросов берутся из исходника сервера, слово в слово.
// FEEDBACK_SHOTS=<папка> — дополнительно сохранить снимки экранов.

const here = dirname(fileURLToPath(import.meta.url))
const presetsSource = readFileSync(resolve(here, '../../../Application/Feedback/SurveyPresets.cs'), 'utf8')
const strings = (text: string) => [...text.matchAll(/"([^"]*)"/g)].map(m => m[1])
const presets = [...presetsSource.matchAll(/new\("([a-z]+)", "([^"]+)",\s*"([^"]+)",\s*\[([^\]]+)\]\)/g)]
  .map(m => ({ id: m[1], title: m[2], question: m[3], options: strings(m[4]) }))
const suggestions = strings(presetsSource.slice(presetsSource.indexOf('Suggestions =')))

const shotsDir = process.env.FEEDBACK_SHOTS
async function shot(page: Page, name: string, whole = false) {
  if (!shotsDir) return
  mkdirSync(shotsDir, { recursive: true })
  await page.waitForTimeout(450) // шторка и анимации
  // Экран целиком: прокручивается body, поэтому «вся страница» у Playwright обрезала бы его по высоте окна —
  // на время снимка окно вытягивается на всю высоту содержимого.
  const size = page.viewportSize()!
  if (whole) {
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.setViewportSize({ width: size.width, height: await page.evaluate(() => Math.max(document.body.scrollHeight, window.innerHeight)) })
  }
  await page.screenshot({ path: resolve(shotsDir, `${name}.png`) })
  if (whole) await page.setViewportSize(size)
}

const me = {
  authenticated: true,
  telegramId: 123456,
  isPro: false,
  isTrialActive: false,
  trialDaysLeft: 0,
  hasAccess: false,
  isOwner: false,
  level: 'intermediate',
  vocabularyCount: 12,
  notificationsEnabled: true,
  progress: {
    xp: 200, streak: 2, lastPlayedAtUtc: null, completedLessons: { 'alphabet-progressive': [1] },
    xpSpent: 0, totalTreatsGiven: 0, lastFedAtUtc: null, lastTreatIndex: null,
  },
}

const lesson = { id: 1, title: 'L1', short: 'L1', theory: { title: 'L1', goal: 'g', blocks: [] } }
const catalog = {
  botUsername: 'TraleBot',
  miniAppEnabled: true,
  modules: [
    { id: 'alphabet-progressive', title: 'Алфавит', emoji: '', description: 'Грузинский алфавит', lessons: [lesson] },
    { id: 'cases', title: 'Падежи', emoji: '', description: 'Падежи грузинского', lessons: [lesson] },
  ],
}

const plans = {
  plans: [
    { id: 'Month', payloadId: 'Stars_Pro_Month', stars: 100, durationDays: 30, title: '1 месяц', description: '30 дней' },
    { id: 'Year', payloadId: 'Stars_Pro_Year', stars: 600, durationDays: 365, title: '1 год', description: '365 дней' },
  ],
}

const KEY = 'survey-2026-10-missing'
const missing = presets.find(p => p.id === 'missing')!
const recent = [
  { kind: 'message', campaignKey: KEY, option: null, text: 'Хочу слышать, как звучит слово, которое я добавил в словарь, а не только читать его.', atUtc: '2026-10-08T10:12:00Z', telegramId: 5000000101 },
  { kind: 'paywall', campaignKey: null, option: 'expensive', text: 'Месяц ещё ладно, но год сразу — много.', atUtc: '2026-10-08T09:40:00Z', telegramId: 5000000102 },
  { kind: 'message', campaignKey: null, option: null, text: 'Спасибо за глаголы! Не хватает озвучки в словаре.', atUtc: '2026-10-07T12:30:00Z', telegramId: 5000000104 },
  { kind: 'paywall', campaignKey: null, option: 'unclear', text: null, atUtc: '2026-10-06T08:15:00Z', telegramId: 5000000105 },
]
const overview = {
  paywall: {
    shown: 41,
    options: [{ option: 'expensive', count: 11 }, { option: 'not_now', count: 9 }, { option: 'unclear', count: 4 }, { option: 'other', count: 2 }],
  },
  messages: 2,
  surveys: [
    {
      key: KEY, question: missing.question, createdAtUtc: '2026-10-08T08:00:00Z', audience: 'accessEnded', sent: 100, texts: 1,
      options: missing.options.map((option, i) => ({ option, count: [23, 9, 14, 5][i] })),
    },
    {
      key: 'survey-2026-09-likes', question: presets.find(p => p.id === 'likes')!.question, createdAtUtc: '2026-09-20T08:00:00Z', audience: 'onTrial', sent: 17, texts: 0,
      options: presets.find(p => p.id === 'likes')!.options.map((option, i) => ({ option, count: [4, 6, 1, 2][i] })),
    },
  ],
}

interface Calls { asked: number; answers: any[]; messages: any[]; prepared: any[]; sent: string[] }

async function setup(page: Page, opts: { me?: object; due?: boolean; messageStatus?: number } = {}): Promise<Calls> {
  const calls: Calls = { asked: 0, answers: [], messages: [], prepared: [], sent: [] }
  await page.addInitScript(() => {
    ;(window as any).Telegram = {
      WebApp: {
        initData: 'user=%7B%22id%22%3A123456%7D',
        initDataUnsafe: { user: { id: 123456 } },
        BackButton: { show: () => {}, hide: () => {}, onClick: () => {}, offClick: () => {} },
        MainButton: { show: () => {}, hide: () => {} },
        HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {} },
        openTelegramLink: () => {},
        onEvent: () => {},
        offEvent: () => {},
      },
    }
    try { localStorage.clear() } catch {}
  })
  const json = (body: object, status = 200) => (route: any) => route.fulfill({ status, json: body })
  await page.route('**/api/miniapp/content', json(catalog))
  await page.route('**/api/miniapp/me', json({ ...me, ...opts.me }))
  await page.route('**/api/miniapp/activity-days*', json({ dates: [] }))
  await page.route('**/api/miniapp/plans', json(plans))
  await page.route('**/api/miniapp/referral', json({
    link: 'https://t.me/trale_bot?start=ref_123456', shareText: '', invitedCount: 0, activatedCount: 0, rules: [],
    state: 'accessEnded', bonusShortLabel: 'неделя доступа', inviteLine: '', capReached: false,
  }))
  await page.route('**/api/miniapp/feedback/paywall-question', (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { due: opts.due ?? true } })
    calls.asked += 1
    return route.fulfill({ json: { show: true, id: '7b0e3f0a-0000-4000-8000-000000000001' } })
  })
  await page.route('**/api/miniapp/feedback/paywall-answer', (route) => {
    calls.answers.push(route.request().postDataJSON())
    return route.fulfill({ json: { ok: true } })
  })
  await page.route('**/api/miniapp/feedback', (route) => {
    calls.messages.push(route.request().postDataJSON())
    const status = opts.messageStatus ?? 200
    return route.fulfill({ status, json: status === 200 ? { ok: true } : { error: 'too_often' } })
  })
  await page.route('**/api/admin/stats', json({
    totalUsers: 848, activeUsers: 512, proUsers: 6, trialUsers: 17, freeUsers: 825, newUsersToday: 3, newUsersWeek: 21,
    newUsersMonth: 64, totalRevenueStars: 900, revenueWeekStars: 0, totalPurchases: 6, totalRefunds: 0,
    totalVocabularyEntries: 9100, averageVocabularyPerUser: 10.7, conversionPostTrialPct: 0.7,
  }))
  await page.route('**/api/admin/signups*', json({ days: 30, points: [] }))
  await page.route('**/api/admin/recent-users*', json({ users: [] }))
  await page.route('**/api/admin/verbs/model-made', json({ verbs: [] }))
  await page.route('**/api/admin/surveys/presets', json({ presets, suggestions, maxOptions: 4, maxOptionLength: 64 }))
  await page.route('**/api/admin/feedback*', (route) => {
    const query = new URL(route.request().url()).searchParams
    const items = recent.filter(r => (!query.get('kind') || r.kind === query.get('kind')) && (!query.get('campaign') || r.campaignKey === query.get('campaign')))
    return route.fulfill({ json: { ...overview, recent: items } })
  })
  // Кампании: сервер сам называет новый опрос; выбранные получатели ждут, пока их не отправят.
  const status = { key: KEY, audience: 'accessEnded', message: '', total: 0, sample: 0, pending: 0, sent: 0, blocked: 0, rejected: 0, unknown: 0, opened: 0,
    giftDays: 0, gifted: 0, playedVerbSession: 0, finishedVerbSession: 0, paidAfterOpen: 0, surveyAnswers: [] as object[] }
  await page.route('**/api/admin/campaigns/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/admin/campaigns/', '')
    if (path === 'audiences') return route.fulfill({ json: { accessEnded: 553, onTrial: 17, paying: 3, proLapsed: 0, owner: 1 } })
    if (path === 'prepare') {
      const body = route.request().postDataJSON()
      calls.prepared.push(body)
      const key = body.key || `survey-2026-10-${body.newSurveySlug}`
      const picked = body.audience === 'owner' ? 1 : body.sampleSize ?? 553
      if (!body.dryRun && body.audience !== 'owner') Object.assign(status, { message: body.message, total: picked, sample: picked, pending: picked })
      return route.fulfill({ json: { key, dryRun: body.dryRun, audienceTotal: 553, alreadyInCampaign: 0, picked, leftForLater: 553 - picked } })
    }
    if (path.endsWith('/send')) {
      calls.sent.push(path.replace('/send', ''))
      return route.fulfill({ json: { sent: 1, blocked: 0, rejected: 0, unknown: 0, retryAfterSeconds: 0, status } })
    }
    return route.fulfill({ json: status })
  })
  return calls
}

const paywall = (page: Page) => page.getByRole('dialog', { name: 'Про-доступ' })
const question = (page: Page) => page.getByTestId('paywall-question')

async function openPaywall(page: Page) {
  await page.goto('/?playwright=1')
  await page.getByTestId('module-tile-cases').click()
  await expect(paywall(page).getByText('1 месяц')).toBeVisible()
}

test('a paywall closed without a purchase asks «Что остановило?», and the answer reaches the server', async ({ page }) => {
  const calls = await setup(page)
  await openPaywall(page)
  expect(calls.asked).toBe(0)

  await page.getByRole('button', { name: 'Нет, пока нет' }).click()

  await expect(question(page)).toBeVisible()
  await expect(page.getByRole('radio')).toHaveText(['Дорого', 'Пока не нужно', 'Не понял, что получу', 'Другое'])
  await expect(page.getByRole('button', { name: 'Отправить' })).toBeDisabled()
  for (const control of await page.getByRole('radio').all()) {
    expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
  await page.getByRole('radio', { name: 'Дорого' }).click()
  await page.getByLabel('Своими словами').fill('Звёзды неудобно покупать')
  await shot(page, '1-paywall-question')
  await page.getByRole('button', { name: 'Отправить' }).click()

  await expect(page.getByTestId('paywall-question-thanks')).toBeVisible()
  await expect(page.getByRole('dialog')).toBeHidden()
  expect(calls.asked).toBe(1)
  expect(calls.answers).toEqual([{ id: '7b0e3f0a-0000-4000-8000-000000000001', option: 'expensive', text: 'Звёзды неудобно покупать' }])
})

test('the question can be closed without answering', async ({ page }) => {
  const calls = await setup(page)
  await openPaywall(page)
  await page.getByRole('button', { name: 'Нет, пока нет' }).click()
  await expect(question(page)).toBeVisible()

  await page.getByRole('button', { name: 'Закрыть' }).click()

  await expect(page.getByRole('dialog')).toBeHidden()
  expect(calls.answers).toEqual([])
})

test('when no question is due the paywall just closes', async ({ page }) => {
  const calls = await setup(page, { due: false })
  await openPaywall(page)

  await page.getByRole('button', { name: 'Нет, пока нет' }).click()

  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(question(page)).toHaveCount(0)
  expect(calls.asked).toBe(0)
})

test('«Написать автору» opens from the profile, sends the text and comes back to the profile', async ({ page }) => {
  const calls = await setup(page)
  await page.goto('/?playwright=1')
  await page.getByRole('button', { name: 'Профиль' }).first().click()
  const entry = page.getByTestId('feedback-entry')
  await entry.scrollIntoViewIfNeeded()
  expect((await entry.boundingBox())!.height).toBeGreaterThanOrEqual(44)

  await entry.click()

  await expect(page.getByTestId('feedback-screen')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Отправить' })).toBeDisabled()
  await page.getByLabel('Твоё сообщение').fill('Нравятся глаголы. Не хватает озвучки слов в словаре.')
  await expect(page.getByTestId('feedback-counter')).toHaveText('52 / 2000')
  await shot(page, '2-feedback-screen')
  await page.getByRole('button', { name: 'Отправить' }).click()

  await expect(page.getByTestId('feedback-sent')).toContainText('Спасибо!')
  await shot(page, '2-feedback-screen-sent')
  expect(calls.messages).toEqual([{ text: 'Нравятся глаголы. Не хватает озвучки слов в словаре.', campaign: null }])
  await page.getByRole('button', { name: 'Вернуться' }).click()
  await expect(page.getByTestId('feedback-entry')).toBeVisible()
})

test('«Написать подробнее» from a survey opens the screen tied to that campaign', async ({ page }) => {
  const calls = await setup(page)

  await page.goto('/?playwright=1&screen=feedback&fc=why-2026-10')

  await expect(page.getByTestId('feedback-screen')).toContainText('Расскажи подробнее')
  expect(new URL(page.url()).search).toBe('')
  await page.getByLabel('Твоё сообщение').fill('Дорого для раза в неделю')
  await page.getByRole('button', { name: 'Отправить' }).click()
  await expect(page.getByTestId('feedback-sent')).toBeVisible()
  expect(calls.messages).toEqual([{ text: 'Дорого для раза в неделю', campaign: 'why-2026-10' }])
  await page.getByRole('button', { name: 'Вернуться' }).click()
  await expect(page.getByTestId('module-tile-cases')).toBeVisible()
})

test('the daily limit is explained and the text stays', async ({ page }) => {
  await setup(page, { messageStatus: 429 })
  await page.goto('/?playwright=1&screen=feedback')
  await page.getByLabel('Твоё сообщение').fill('Шестое за день')

  await page.getByRole('button', { name: 'Отправить' }).click()

  await expect(page.getByTestId('feedback-error')).toHaveText('На сегодня хватит — напиши завтра, я всё прочитаю.')
  await expect(page.getByLabel('Твоё сообщение')).toHaveValue('Шестое за день')
})

test.describe('владелец', () => {
  // Ширина телефона, под которую свёрстан мини-апп.
  test.use({ viewport: { width: 375, height: 812 } })

  const owner = { isOwner: true, isPro: true, hasAccess: true }
  /** На экране ничего не вылезает за ширину телефона. */
  async function fits(page: Page) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  }
  async function openAdmin(page: Page) {
    await page.goto('/?playwright=1')
    await page.getByRole('button', { name: 'Профиль' }).first().click()
    await page.getByRole('button', { name: /Админка/ }).click()
    await expect(page.getByTestId('admin-sections')).toBeVisible()
  }
  const stepTitle = (page: Page) => page.getByTestId('survey-step-title')

  test('the admin has its sections on separate screens, and the broadcast form has no survey fields', async ({ page }) => {
    await setup(page, { me: owner })
    await openAdmin(page)
    await expect(page.getByTestId('admin-sections').getByRole('button')).toHaveText([/^Опрос/, /^Отзывы/, /^Рассылка/])
    await expect(page.getByTestId('campaign-panel')).toHaveCount(0)
    await fits(page)
    await shot(page, 'survey-0-admin-menu')

    await page.getByTestId('admin-section-broadcast').click()

    await expect(page.getByTestId('admin-broadcast-screen').getByTestId('campaign-panel')).toBeVisible()
    await expect(page.getByTestId('campaign-send')).toBeDisabled()
    await expect(page.getByTestId('campaign-send-hint')).toContainText('Отправка откроется, когда выберешь получателей')
    await expect(page.getByText(/вариант/i)).toHaveCount(0)
    await fits(page)
    await page.getByRole('button', { name: 'Назад' }).click()
    await expect(page.getByTestId('admin-sections')).toBeVisible()
  })

  test('a survey is built from a ready-made one and sent to oneself without typing anything', async ({ page }) => {
    const calls = await setup(page, { me: owner })
    await openAdmin(page)
    await page.getByTestId('admin-section-survey').click()

    await expect(stepTitle(page)).toHaveText('Выбери опрос')
    await expect(page.locator('[data-testid^="survey-preset-"]')).toHaveCount(presets.length + 1)
    await fits(page)
    await shot(page, 'survey-1-choose', true)
    await page.getByTestId('survey-preset-missing').click()

    await expect(stepTitle(page)).toHaveText('Проверь, как это выглядит')
    await expect(page.getByTestId('survey-preview')).toContainText(missing.question)
    for (const option of missing.options) await expect(page.getByTestId('survey-preview')).toContainText(option)
    for (const control of await page.getByTestId('survey-options').getByRole('button').all()) {
      const box = (await control.boundingBox())!
      expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44)
    }
    await fits(page)
    await shot(page, 'survey-2-preview', true)
    await page.getByTestId('survey-next').click()

    await expect(stepTitle(page)).toHaveText('Кому отправить')
    await expect(page.getByTestId('survey-audience-accessEnded')).toContainText('553')
    await fits(page)
    await shot(page, 'survey-3-audience', true)
    await page.getByTestId('survey-next').click()

    await expect(stepTitle(page)).toHaveText('Отправка')
    await expect(page.getByTestId('survey-send')).toBeDisabled()
    await page.getByTestId('survey-send-me').click()

    await expect(page.getByTestId('survey-note')).toContainText('Отправил тебе в чат с ботом')
    expect(calls.prepared).toEqual([{
      key: '', newSurveySlug: 'missing-test', audience: 'owner', message: missing.question, buttonText: null, buttonQuery: null,
      sampleSize: null, dryRun: false, surveyOptions: missing.options,
    }])
    expect(calls.sent).toEqual(['survey-2026-10-missing-test'])
    await expect(page.getByTestId('survey-send')).toBeDisabled()
    await fits(page)
    await shot(page, 'survey-4-send', true)

    // Получатели выбраны — только теперь открывается отправка порции; имя опросу дал сервер.
    page.on('dialog', dialog => dialog.accept())
    await page.getByTestId('survey-pick').click()
    await expect(page.getByTestId('survey-send')).toBeEnabled()
    await expect(page.getByTestId('survey-status')).toContainText('Выбрано 100 · ждут 100')
    expect(calls.prepared.slice(1).map(p => [p.key, p.newSurveySlug, p.audience, p.sampleSize, p.dryRun])).toEqual([
      ['', 'missing', 'accessEnded', 100, true], ['', 'missing', 'accessEnded', 100, false],
    ])
    expect(calls.sent).toHaveLength(1)
    await expect(page.getByTestId('survey-back')).toHaveCount(0)
    await shot(page, 'survey-4-send-picked', true)
  })

  test('the buttons of a survey are edited by taps', async ({ page }) => {
    await setup(page, { me: owner })
    await openAdmin(page)
    await page.getByTestId('admin-section-survey').click()
    await page.getByTestId('survey-preset-missing').click()

    await page.getByRole('button', { name: 'Убрать вариант Другого' }).click()
    await expect(page.getByTestId('survey-add-option')).toBeVisible()
    await fits(page)
    await shot(page, 'survey-2-preview-editing', true)
    await page.getByTestId('survey-suggestions').getByRole('button', { name: 'Всё устраивает' }).click()
    await page.getByTestId('survey-option-0').click()
    await page.getByLabel('Вариант 1').fill('Озвучки в словаре')
    await page.getByLabel('Вариант 1').press('Enter')

    await expect(page.getByTestId('survey-preview')).toContainText('Озвучки в словаре')
    await expect(page.getByTestId('survey-preview')).toContainText('Всё устраивает')
    await expect(page.getByTestId('survey-preview')).not.toContainText('Другого')
    await expect(page.getByTestId('survey-add-option')).toHaveCount(0)
    await fits(page)
  })

  test('«Отзывы»: surveys by their questions, and each kind of answers on its own screen', async ({ page }) => {
    await setup(page, { me: owner })
    await openAdmin(page)
    await page.getByTestId('admin-section-feedback').click()

    const list = page.getByTestId('feedback-list')
    await expect(list.getByTestId(`feedback-open-survey-${KEY}`)).toContainText(missing.question)
    await expect(list.getByTestId(`feedback-open-survey-${KEY}`)).toContainText('8 октября · доступ закончился · дошло 100 · ответили 51')
    await expect(list).not.toContainText('survey-2026')
    await fits(page)
    await shot(page, 'survey-5-feedback-list', true)

    await list.getByTestId(`feedback-open-survey-${KEY}`).click()
    const survey = page.getByTestId('feedback-survey')
    await expect(survey).toContainText('Озвучки слов')
    await expect(survey).toContainText('23 · 45%')
    await expect(survey).toContainText('Хочу слышать, как звучит слово')
    await expect(survey).not.toContainText('Спасибо за глаголы')
    await fits(page)
    await shot(page, 'survey-6-survey-results', true)

    await page.getByRole('button', { name: 'Назад' }).click()
    await page.getByTestId('feedback-open-paywall').click()
    await expect(page.getByTestId('feedback-paywall')).toContainText('Спросили 41 · ответили 26')
    await expect(page.getByTestId('feedback-paywall')).toContainText('Месяц ещё ладно')
    await expect(page.getByTestId('feedback-paywall')).not.toContainText('expensive')
    await fits(page)
    await shot(page, 'survey-7-paywall-answers', true)

    await page.getByRole('button', { name: 'Назад' }).click()
    await page.getByTestId('feedback-open-messages').click()
    await expect(page.getByTestId('feedback-messages')).toContainText(`из опроса: ${missing.question}`)
    await expect(page.getByTestId('feedback-messages')).toContainText('Спасибо за глаголы')
    await fits(page)
    await shot(page, 'survey-8-messages', true)

    await page.getByRole('button', { name: 'Назад' }).click()
    await page.getByRole('button', { name: 'Назад' }).click()
    await expect(page.getByTestId('admin-sections')).toBeVisible()
  })
})
