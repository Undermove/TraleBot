import { test, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'fs'
import { resolve } from 'path'

// Обратная связь глазами человека: вопрос «Что остановило?» после закрытого экрана покупки, экран
// «Написать автору» (из профиля и по кнопке «Написать подробнее» из опроса) и список отзывов в админке.
// API подменяется. FEEDBACK_SHOTS=<папка> — дополнительно сохранить снимки экранов.

const shotsDir = process.env.FEEDBACK_SHOTS
async function shot(page: Page, name: string, fullPage = false) {
  if (!shotsDir) return
  mkdirSync(shotsDir, { recursive: true })
  await page.waitForTimeout(450) // шторка и анимации
  await page.screenshot({ path: resolve(shotsDir, `${name}.png`), fullPage })
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

const overview = {
  recent: [
    { kind: 'message', campaignKey: 'why-2026-10', option: null, text: 'Звёзды неудобно покупать: с карты не получается, а через друзей неловко.', atUtc: '2026-10-08T10:12:00Z', telegramId: 5000000101 },
    { kind: 'paywall', campaignKey: null, option: 'expensive', text: 'Месяц ещё ладно, но год сразу — много.', atUtc: '2026-10-08T09:40:00Z', telegramId: 5000000102 },
    { kind: 'survey', campaignKey: 'why-2026-10', option: 'Пока не нужно', text: null, atUtc: '2026-10-07T18:03:00Z', telegramId: 5000000103 },
    { kind: 'message', campaignKey: null, option: null, text: 'Спасибо за глаголы! Не хватает озвучки в словаре.', atUtc: '2026-10-07T12:30:00Z', telegramId: 5000000104 },
    { kind: 'paywall', campaignKey: null, option: 'unclear', text: null, atUtc: '2026-10-06T08:15:00Z', telegramId: 5000000105 },
  ],
  paywall: {
    shown: 41,
    options: [{ option: 'expensive', count: 11 }, { option: 'not_now', count: 9 }, { option: 'unclear', count: 4 }, { option: 'other', count: 2 }],
  },
  surveys: [{
    key: 'why-2026-10', question: 'Привет! Что больше всего мешает заниматься грузинским в мини-аппе?',
    options: [{ option: 'Дорого', count: 23 }, { option: 'Пока не нужно', count: 31 }, { option: 'Не понял, что получу', count: 8 }, { option: 'Другое', count: 5 }],
  }],
}

interface Calls { asked: number; answers: any[]; messages: any[] }

async function setup(page: Page, opts: { me?: object; due?: boolean; messageStatus?: number } = {}): Promise<Calls> {
  const calls: Calls = { asked: 0, answers: [], messages: [] }
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
  await page.route('**/api/admin/campaigns/audiences', json({ accessEnded: 553, onTrial: 17, paying: 3, proLapsed: 0, owner: 1 }))
  await page.route('**/api/admin/verbs/model-made', json({ verbs: [] }))
  await page.route('**/api/admin/feedback*', json(overview))
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

test('the owner sees counts per option and the latest answers in the admin', async ({ page }) => {
  await setup(page, { me: { isOwner: true, isPro: true, hasAccess: true } })
  await page.goto('/?playwright=1')
  await page.getByRole('button', { name: 'Профиль' }).first().click()
  await page.getByRole('button', { name: /Админка/ }).click()

  const panel = page.getByTestId('feedback-panel')
  await expect(panel.getByTestId('feedback-paywall')).toContainText('спросили 41 · ответили 26')
  await expect(panel.getByTestId('feedback-paywall')).toContainText('Дорого')
  await expect(panel.getByTestId('feedback-survey-why-2026-10')).toContainText('Пока не нужно')
  await expect(panel.getByTestId('feedback-recent')).toContainText('Звёзды неудобно покупать')
  await expect(panel.getByTestId('feedback-recent')).not.toContainText('expensive')
  await panel.scrollIntoViewIfNeeded()
  if (shotsDir) {
    mkdirSync(shotsDir, { recursive: true })
    // Шапка экрана прилипает к верху и закрыла бы начало панели на снимке.
    await page.addStyleTag({ content: '.sticky { position: static !important; }' })
    await panel.screenshot({ path: resolve(shotsDir, '3-admin-feedback.png') })
  }
})
