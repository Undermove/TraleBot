import { test, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'fs'
import { resolve } from 'path'

// Обратная связь глазами человека: вопрос «Что остановило?» после закрытого экрана покупки, экран
// «Написать автору», форма опроса (по вопросу на странице) — а у владельца подразделы админки:
// конструктор опроса от готовой формы до отправки себе и «Отзывы» с воронкой и ответами по вопросам.
// API подменяется. Готовые формы повторяют серверные (Application/Feedback/SurveyPresets.cs); что они
// проходят серверную проверку, смотрит интеграционный тест.
// FEEDBACK_SHOTS=<папка> — дополнительно сохранить снимки экранов.

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

const choice = (text: string, allowOther: boolean, ...options: string[]) => ({ text, kind: 'choice' as const, options, allowOther })
const free = (text: string) => ({ text, kind: 'text' as const, options: [] as string[], allowOther: false })
const ifGone = { ...choice('Что ты почувствуешь, если TraleBot завтра исчезнет?', false, 'Очень расстроюсь', 'Немного расстроюсь', 'Мне всё равно', 'Уже не пользуюсь'), optionKeys: ['very', 'somewhat', 'indifferent', 'unused'], headlineOption: 'very', headlineWithout: 'unused' }
const whatElseNow = choice('Чем ещё ты пользуешься для грузинского?', true, 'Репетитор или курсы', 'Другие приложения', 'Учебник или YouTube', 'Только TraleBot')
const whyGeorgian = choice('Зачем тебе грузинский?', true, 'Живу в Грузии', 'Собираюсь переехать', 'Еду в поездку', 'Семья или близкие', 'Просто интересно')
const lastHelped = free('Вспомни последний раз, когда TraleBot тебе реально помог. Что это было?')
const lastAnnoyed = free('А что в последний раз раздражало или мешало?')
const learningNow = choice('Ты сейчас учишь грузинский?', false, 'Да, другим способом', 'Пауза, вернусь', 'Нет, бросил(а)', 'Он мне больше не нужен')
const afterWhat = choice('После чего ты перестал(а) открывать TraleBot?', true, 'Не было времени', 'Стало слишком сложно', 'Стало скучно', 'Закончился бесплатный доступ', 'Не помню')
const whatElseThen = choice('Что ещё, кроме TraleBot, помогало тебе с грузинским?', true, 'Репетитор или курсы', 'Другие приложения', 'Учебник или YouTube', 'Ничего')
const goal = choice('Чего хотелось добиться в самом начале?', true, 'Читать вывески и меню', 'Объясняться в быту', 'Свободно разговаривать', 'Понять, как устроен язык')
const disliked = free('Что тебе не понравилось в TraleBot? Пиши как есть.')
const paywallQuestion = choice('Что остановило от покупки полного доступа?', true, 'Дорого', 'Пока не нужно', 'Не понял, что получу')
const whyBought = free('Вспомни день, когда ты оформил(а) подписку. Что тогда подтолкнуло?')
const whyNotRenewed = choice('Если подписка у тебя закончилась — почему не продлил(а)?', true, 'Подписка действует', 'Перестал(а) заниматься', 'Хватает бесплатного', 'Дорого', 'Просто забыл(а)')
const paidIntro = 'Привет! Это автор TraleBot. Ты один из немногих, кто оформил подписку, и мне очень важно твоё мнение. Это пять коротких вопросов.'
const intro = 'Привет! Это автор TraleBot. Помоги сделать его лучше — ответь на несколько коротких вопросов.'
const users = [ifGone, whatElseNow, whyGeorgian, lastHelped, lastAnnoyed]
const kit = {
  presets: [
    { id: 'users', title: 'Тем, кто пользуется', about: 'Насколько TraleBot нужен, чем ещё занимаются и что помогает', form: { intro, questions: users } },
    { id: 'left', title: 'Тем, кто перестал', about: 'Ушли от TraleBot или от языка, после чего и чего хотели', form: { intro, questions: [learningNow, afterWhat, whatElseThen, goal, disliked] } },
    { id: 'paid', title: 'Тем, кто платил', about: 'Что подтолкнуло оформить подписку, что помогает и почему не продлили', form: { intro: paidIntro, questions: [ifGone, whyBought, lastHelped, lastAnnoyed, whyNotRenewed] } },
  ],
  bank: [...users, learningNow, afterWhat, whatElseThen, goal, disliked, whyBought, whyNotRenewed, paywallQuestion],
  suggestions: ['Нет времени', 'Дорого', 'Всё устраивает', 'Сложно', 'Скучно', 'Мало практики', 'Не помню', 'Не знаю'],
  intro,
  otherLabel: 'Другое',
  limits: { questions: 6, options: 6, botOptions: 4, optionLength: 64, questionLength: 300 },
}
const withIds = (questions: object[]) => questions.map((q, i) => ({ ...q, id: `q${i + 1}` }))

const KEY = 'survey-2026-10-users'
const at = (day: number, time: string) => `2026-10-0${day}T${time}:00Z`
const recent = [
  { kind: 'message', campaignKey: KEY, option: null, text: 'Хочу слышать, как звучит слово, которое я добавил в словарь, а не только читать его.', atUtc: at(8, '10:12'), telegramId: 5000000101 },
  { kind: 'paywall', campaignKey: null, option: 'expensive', text: 'Месяц ещё ладно, но год сразу — много.', atUtc: at(8, '09:40'), telegramId: 5000000102 },
  { kind: 'message', campaignKey: null, option: null, text: 'Спасибо за глаголы! Не хватает озвучки в словаре.', atUtc: at(7, '12:30'), telegramId: 5000000104 },
  { kind: 'paywall', campaignKey: null, option: 'unclear', text: null, atUtc: at(6, '08:15'), telegramId: 5000000105 },
]
const sentSurvey = {
  key: KEY, title: ifGone.text, questions: 5, createdAtUtc: at(8, '08:00'), audience: 'activeLately', picked: 61, pending: 0,
  funnel: { sent: 61, answeredFirst: 34, openedForm: 22, finished: 15 },
}
const overview = {
  paywall: {
    shown: 41,
    options: [{ option: 'expensive', count: 11 }, { option: 'not_now', count: 9 }, { option: 'unclear', count: 4 }, { option: 'other', count: 2 }],
  },
  messages: 2,
  surveys: [
    sentSurvey,
    { key: 'survey-2026-09-left', title: learningNow.text, questions: 5, createdAtUtc: '2026-09-20T08:00:00Z', audience: 'inactiveLong', picked: 100, pending: 0, funnel: { sent: 96, answeredFirst: 21, openedForm: 9, finished: 6 } },
  ],
}
const wrote = (questionId: string, option: string | null, text: string, id: number) =>
  ({ kind: 'survey', campaignKey: KEY, questionId, option, text, atUtc: at(8, '11:20'), telegramId: 5000000200 + id })
/** Ответы по вопросам: у всех и у тех, кто на первый вопрос ответил «Очень расстроюсь». */
const surveyResults = (segment: string | null) => {
  const fans = segment === 'Очень расстроюсь'
  const counts = (q: { options: string[]; allowOther: boolean }, numbers: number[]) =>
    [...q.options, ...(q.allowOther ? ['Другое'] : [])].map((option, i) => ({ option, count: numbers[i] ?? 0 }))
  return {
    summary: sentSurvey,
    segment: fans ? segment : null,
    questions: [
      { id: 'q1', text: ifGone.text, kind: 'choice', answered: fans ? 14 : 34, options: counts(ifGone, fans ? [14, 0, 0, 0] : [14, 11, 5, 4]), headline: { option: 'Очень расстроюсь', without: 'Уже не пользуюсь', chose: 14, of: fans ? 14 : 30 }, texts: [] },
      { id: 'q2', text: whatElseNow.text, kind: 'choice', answered: fans ? 11 : 21, options: counts(whatElseNow, fans ? [6, 1, 1, 2, 1] : [7, 5, 3, 4, 2]), headline: null,
        texts: fans ? [wrote('q2', 'Другое', 'Смотрю грузинские сериалы с субтитрами', 1)] : [wrote('q2', 'Другое', 'Смотрю грузинские сериалы с субтитрами', 1), wrote('q2', 'Другое', 'Разговариваю с соседями', 2)] },
      { id: 'q3', text: whyGeorgian.text, kind: 'choice', answered: fans ? 10 : 19, options: counts(whyGeorgian, fans ? [7, 1, 0, 2, 0, 0] : [9, 3, 2, 3, 2, 0]), headline: null, texts: [] },
      { id: 'q4', text: lastHelped.text, kind: 'text', answered: fans ? 2 : 3, options: [], headline: null,
        texts: [wrote('q4', null, 'В аптеке: вспомнил, как сказать «у меня болит голова», и меня поняли с первого раза.', 3), wrote('q4', null, 'Разобрал вывеску на рынке.', 4), ...(fans ? [] : [wrote('q4', null, 'Честно — не помню.', 5)])] },
      { id: 'q5', text: lastAnnoyed.text, kind: 'text', answered: fans ? 1 : 2, options: [], headline: null,
        texts: [wrote('q5', null, 'Нет озвучки у слов, которые я сам добавил.', 6), ...(fans ? [] : [wrote('q5', null, 'Уроки по падежам слишком длинные.', 7)])] },
    ],
    written: [],
  }
}

interface Calls { asked: number; answers: any[]; messages: any[]; prepared: any[]; sent: string[]; formAnswers: any[]; formOpened: number; formFinished: number }

interface FormState { survey: { intro: string | null; questions: object[] }; finished: boolean; answers: Record<string, object> }

async function setup(page: Page, opts: { me?: object; due?: boolean; messageStatus?: number; form?: FormState | null } = {}): Promise<Calls> {
  const calls: Calls = { asked: 0, answers: [], messages: [], prepared: [], sent: [], formAnswers: [], formOpened: 0, formFinished: 0 }
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
  // Форма опроса глазами получателя: кому опрос не отправляли, тому сервер отвечает 404.
  await page.route('**/api/miniapp/surveys/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (!opts.form) return route.fulfill({ status: 404, json: { error: 'not_found' } })
    if (path.endsWith('/open')) { calls.formOpened += 1; return route.fulfill({ json: { key: KEY, ...opts.form } }) }
    if (path.endsWith('/answer')) calls.formAnswers.push(route.request().postDataJSON())
    if (path.endsWith('/finish')) calls.formFinished += 1
    return route.fulfill({ json: { ok: true } })
  })
  await page.route('**/api/admin/verbs/model-made', json({ verbs: [] }))
  await page.route('**/api/admin/surveys/presets', json(kit))
  // Кампании: сервер сам называет новый опрос; выбранные получатели ждут, пока их не отправят.
  const NEW = 'survey-2026-10-users-2'
  const status = { key: NEW, audience: 'accessEnded', message: '', total: 0, sample: 0, pending: 0, sent: 0, blocked: 0, rejected: 0, unknown: 0, opened: 0,
    giftDays: 0, gifted: 0, playedVerbSession: 0, finishedVerbSession: 0, paidAfterOpen: 0, surveyAnswers: [] as object[], survey: null as object | null }
  await page.route('**/api/admin/feedback/surveys/**', (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith(`/${NEW}`)) {
      const started = { key: NEW, title: ifGone.text, questions: 5, createdAtUtc: at(9, '08:00'), audience: 'accessEnded', picked: status.total, pending: status.pending,
        funnel: { sent: status.sent, answeredFirst: 0, openedForm: 0, finished: 0 } }
      return route.fulfill({ json: { ...surveyResults(null), summary: started, questions: surveyResults(null).questions.map(q => ({ ...q, answered: 0, texts: [], headline: null, options: q.options.map(o => ({ ...o, count: 0 })) })) } })
    }
    return route.fulfill({ json: surveyResults(url.searchParams.get('segment')) })
  })
  await page.route('**/api/admin/feedback?*', (route) => {
    const query = new URL(route.request().url()).searchParams
    const items = recent.filter(r => (!query.get('kind') || r.kind === query.get('kind')) && (!query.get('campaign') || r.campaignKey === query.get('campaign')))
    // Опрос, которому в этом сценарии уже выбрали получателей, сервер отдаёт с тем, сколько ждут.
    const started = status.total > 0
      ? [{ key: NEW, title: ifGone.text, questions: 5, createdAtUtc: at(9, '08:00'), audience: 'accessEnded', picked: status.total, pending: status.pending, funnel: { sent: status.sent, answeredFirst: 0, openedForm: 0, finished: 0 } }]
      : []
    return route.fulfill({ json: { ...overview, surveys: [...started, ...overview.surveys], recent: items } })
  })
  await page.route('**/api/admin/campaigns/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/admin/campaigns/', '')
    if (path === 'audiences') return route.fulfill({ json: { accessEnded: 553, onTrial: 17, paying: 3, proLapsed: 0, owner: 1, activeLately: 61, inactiveLong: 512 } })
    if (path === 'prepare') {
      const body = route.request().postDataJSON()
      calls.prepared.push(body)
      const key = body.key || (body.audience === 'owner' ? `survey-2026-10-${body.newSurveySlug}` : NEW)
      const picked = body.audience === 'owner' ? 1 : body.sampleSize ?? 553 - status.total
      if (!body.dryRun && body.audience !== 'owner') {
        Object.assign(status, {
          message: `${body.survey.intro}\n\n${body.survey.questions[0].text}`, total: status.total + picked, sample: status.sample + (body.sampleSize ?? 0), pending: status.pending + picked,
          survey: { intro: body.survey.intro, questions: withIds(body.survey.questions) },
          surveyAnswers: body.survey.questions[0].options.map((option: string) => ({ option, count: 0 })),
        })
      }
      return route.fulfill({ json: { key, dryRun: body.dryRun, audienceTotal: 553, alreadyInCampaign: 0, picked, leftForLater: 553 - picked } })
    }
    if (path.endsWith('/send')) {
      const key = path.replace('/send', '')
      calls.sent.push(key)
      const sent = key === NEW ? Math.min(route.request().postDataJSON().limit, status.pending) : 1
      if (key === NEW) Object.assign(status, { pending: status.pending - sent, sent: status.sent + sent })
      return route.fulfill({ json: { sent, blocked: 0, rejected: 0, unknown: 0, retryAfterSeconds: 0, status } })
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

// ── Форма опроса: получатель ──

const usersForm = (answers: Record<string, object> = {}, finished = false): FormState =>
  ({ survey: { intro, questions: withIds(users) }, finished, answers })
const tappedInBot = { q1: { option: 'Очень расстроюсь', other: false, text: null } }

/** На экране ничего не вылезает за ширину телефона. */
async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
}

test.describe('форма опроса', () => {
  test.use({ viewport: { width: 375, height: 812 } })
  const progress = (page: Page) => page.getByTestId('survey-progress')

  test('«Продолжить» from the bot opens the form after the answered question; «Другое» with words, a skipped question, thanks', async ({ page }) => {
    const calls = await setup(page, { form: usersForm(tappedInBot) })

    await page.goto(`/?playwright=1&screen=survey&s=${KEY}`)

    await expect(progress(page)).toHaveText('Вопрос 2 из 5')
    await expect(page.getByTestId('survey-page-question')).toHaveText(whatElseNow.text)
    await expect(page.getByRole('radio')).toHaveText([...whatElseNow.options, 'Другое'])
    await expect(page.getByTestId('survey-page-next')).toBeDisabled()
    for (const control of await page.getByRole('radio').all()) expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect(new URL(page.url()).search).toBe('')
    await page.getByRole('radio', { name: 'Другое' }).click()
    await page.getByLabel('Свой ответ').fill('Смотрю сериалы с субтитрами')
    await fits(page)
    await shot(page, 'form-user-1-other', true)
    await page.getByTestId('survey-page-next').click()

    await expect(progress(page)).toHaveText('Вопрос 3 из 5')
    await fits(page)
    await shot(page, 'form-user-2-choice', true)
    await page.getByRole('button', { name: 'Пропустить вопрос' }).click()

    await expect(progress(page)).toHaveText('Вопрос 4 из 5')
    await page.getByLabel('Твой ответ').fill('В аптеке вспомнил, как сказать «болит голова».')
    await fits(page)
    await shot(page, 'form-user-3-text', true)
    await page.getByTestId('survey-page-next').click()
    await expect(progress(page)).toHaveText('Вопрос 5 из 5')
    await expect(page.getByTestId('survey-page-next')).toHaveText('Готово')
    await page.getByTestId('survey-page').getByRole('button', { name: 'Назад' }).click()
    await expect(page.getByLabel('Твой ответ')).toHaveValue('В аптеке вспомнил, как сказать «болит голова».')
    await page.getByTestId('survey-page-next').click()
    await page.getByRole('button', { name: 'Пропустить вопрос' }).click()

    await expect(page.getByTestId('survey-thanks')).toContainText('Твои ответы у меня')
    await fits(page)
    await shot(page, 'form-user-4-thanks')
    expect(calls.formOpened).toBe(1)
    expect(calls.formFinished).toBe(1)
    expect(calls.formAnswers).toEqual([
      { questionId: 'q2', option: null, other: true, text: 'Смотрю сериалы с субтитрами' },
      { questionId: 'q4', option: null, other: false, text: 'В аптеке вспомнил, как сказать «болит голова».' },
      { questionId: 'q4', option: null, other: false, text: 'В аптеке вспомнил, как сказать «болит голова».' },
    ])
    await page.getByRole('button', { name: 'Вернуться' }).click()
    await expect(page.getByTestId('module-tile-cases')).toBeVisible()
  })

  test('someone who did not answer in the bot starts from the first question', async ({ page }) => {
    const calls = await setup(page, { form: usersForm() })
    await page.goto(`/?playwright=1&screen=survey&s=${KEY}`)

    await expect(progress(page)).toHaveText('Вопрос 1 из 5')
    await expect(page.getByRole('radio')).toHaveText(ifGone.options)
    await page.getByRole('radio', { name: 'Немного расстроюсь' }).click()
    await page.getByTestId('survey-page-next').click()

    await expect(progress(page)).toHaveText('Вопрос 2 из 5')
    expect(calls.formAnswers).toEqual([{ questionId: 'q1', option: 'Немного расстроюсь', other: false, text: null }])
  })

  test('a form already gone through says thanks and lets the answers be corrected', async ({ page }) => {
    await setup(page, { form: usersForm({ ...tappedInBot, q2: { option: 'Только TraleBot', other: false, text: null } }, true) })
    await page.goto(`/?playwright=1&screen=survey&s=${KEY}`)

    await expect(page.getByTestId('survey-already')).toContainText('Твои ответы уже у меня')
    await fits(page)
    await shot(page, 'form-user-5-already')
    await page.getByRole('button', { name: 'Поправить ответы' }).click()

    await expect(progress(page)).toHaveText('Вопрос 1 из 5')
    await expect(page.getByRole('radio', { name: 'Очень расстроюсь' })).toHaveAttribute('aria-checked', 'true')
  })

  test('a long question and long options keep inside the phone screen', async ({ page }) => {
    const long = choice(
      'Расскажи, пожалуйста, что именно происходило в тот день, когда ты в последний раз открывал(а) мини-апп, собирался(ась) позаниматься грузинским — и в итоге закрыл(а), так ничего и не сделав?',
      true, 'Открыл(а) урок, но он оказался слишком длинным для пяти свободных минут', 'Сверхдлинноесловобезпробеловкотороенедолжновылезатьзакрайэкрана', 'Не помню')
    await setup(page, { form: { survey: { intro: null, questions: withIds([ifGone, long]) }, finished: false, answers: tappedInBot } })
    await page.goto(`/?playwright=1&screen=survey&s=${KEY}`)

    await expect(progress(page)).toHaveText('Вопрос 2 из 2')
    await page.getByRole('radio', { name: 'Другое' }).click()
    await fits(page)
    await shot(page, 'form-user-6-long-texts', true)
  })

  test('a survey sent to someone else shows no questions', async ({ page }) => {
    await setup(page, { form: null })
    await page.goto(`/?playwright=1&screen=survey&s=${KEY}`)

    await expect(page.getByTestId('survey-problem')).toContainText('Этот опрос уже закрыт или был отправлен не тебе.')
    await expect(page.getByTestId('survey-page')).toHaveCount(0)
    await page.getByRole('button', { name: 'Вернуться' }).click()
    await expect(page.getByTestId('module-tile-cases')).toBeVisible()
  })
})

test.describe('владелец', () => {
  // Ширина телефона, под которую свёрстан мини-апп.
  test.use({ viewport: { width: 375, height: 812 } })

  const owner = { isOwner: true, isPro: true, hasAccess: true }
  const NEW = 'survey-2026-10-users-2'
  async function openAdmin(page: Page) {
    await page.goto('/?playwright=1')
    await page.getByRole('button', { name: 'Профиль' }).first().click()
    await page.getByRole('button', { name: /Админка/ }).click()
    await expect(page.getByTestId('admin-sections')).toBeVisible()
  }
  const stepTitle = (page: Page) => page.getByTestId('survey-step-title')
  const card = (page: Page, i: number) => page.getByTestId(`survey-question-${i}`)

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

  test('a form is built from a ready-made one with one question changed, walked through as a user and sent to oneself', async ({ page }) => {
    const calls = await setup(page, { me: owner })
    await openAdmin(page)
    await page.getByTestId('admin-section-survey').click()

    await expect(stepTitle(page)).toHaveText('Выбери опрос')
    await expect(page.locator('[data-testid^="survey-preset-"]')).toHaveCount(4)
    await expect(page.getByTestId('survey-preset-paid')).toContainText('Вспомни день, когда ты оформил(а) подписку. Что тогда подтолкнуло?')
    await expect(page.getByTestId('survey-preset-left')).toContainText('После чего ты перестал(а) открывать TraleBot?')
    await fits(page)
    await shot(page, 'form-1-choose', true)
    await page.getByTestId('survey-preset-users').click()

    await expect(stepTitle(page)).toHaveText('Вопросы')
    await expect(page.getByTestId('survey-preview')).toContainText(`${intro}\n\n${ifGone.text}`)
    await expect(page.locator('[data-testid^="survey-question-open-"]')).toHaveCount(5)
    await expect(card(page, 0)).toContainText('Вопрос 1 · в боте')
    await expect(card(page, 4)).toContainText('свободный ответ')
    for (const control of await page.getByTestId('survey-questions').getByRole('button').all()) {
      const box = (await control.boundingBox())!
      expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44)
    }
    await fits(page)
    await shot(page, 'form-2-questions', true)

    // Один вопрос — на своём экране: убрать вариант, взять готовый, выключить «Другое».
    await page.getByTestId('survey-question-open-1').click()
    const editor = page.getByTestId('survey-question-editor')
    await expect(editor).toContainText('Вопрос 2 из 5')
    await expect(page.getByTestId('survey-questions')).toHaveCount(0)
    await page.getByRole('button', { name: 'Убрать вариант Учебник или YouTube' }).click()
    await fits(page)
    await shot(page, 'form-3-question', true)
    await page.getByTestId('survey-option-1').click()
    await page.getByLabel('Вариант 2').fill('Duolingo и другие приложения')
    await page.getByLabel('Вариант 2').press('Enter')
    await page.getByTestId('survey-question-done').click()
    await expect(card(page, 1)).toContainText('Репетитор или курсы · Duolingo и другие приложения · Только TraleBot · Другое')

    // Добавить вопрос: готовые (те, которых в форме ещё нет) и свои.
    await page.getByRole('button', { name: 'Убрать вопрос 5' }).click()
    await page.getByTestId('survey-add-question').click()
    await expect(page.getByTestId('survey-bank')).toContainText(paywallQuestion.text)
    await expect(page.getByTestId('survey-bank')).not.toContainText(whyGeorgian.text)
    await fits(page)
    await shot(page, 'form-4-add-question', true)
    await page.getByTestId('survey-bank').getByRole('button', { name: new RegExp(lastAnnoyed.text.slice(0, 20)) }).click()
    await expect(page.locator('[data-testid^="survey-question-open-"]')).toHaveCount(5)

    // Прогон «как пользователь»: ничего не записывается и никуда не уходит.
    await page.getByTestId('survey-try').click()
    await expect(page.getByTestId('survey-try-form')).toContainText('Ответы никуда не записываются')
    await expect(page.getByTestId('survey-progress')).toHaveText('Вопрос 1 из 5')
    await page.getByRole('radio', { name: 'Мне всё равно' }).click()
    await page.getByTestId('survey-page-next').click()
    await expect(page.getByTestId('survey-progress')).toHaveText('Вопрос 2 из 5')
    await expect(page.getByRole('radio')).toHaveText(['Репетитор или курсы', 'Duolingo и другие приложения', 'Только TraleBot', 'Другое'])
    await fits(page)
    await shot(page, 'form-5-try', true)
    await page.getByRole('button', { name: 'Назад' }).first().click()
    await expect(stepTitle(page)).toHaveText('Вопросы')
    await page.getByTestId('survey-next').click()

    await expect(stepTitle(page)).toHaveText('Кому отправить')
    await expect(page.getByTestId('survey-audience-activeLately')).toContainText('61')
    await expect(page.getByTestId('survey-audience-inactiveLong')).toContainText('512')
    await fits(page)
    await shot(page, 'form-6-audience', true)
    await page.getByTestId('survey-audience-activeLately').click()
    await page.getByTestId('survey-next').click()

    await expect(stepTitle(page)).toHaveText('Отправка')
    await expect(page.getByTestId('survey-summary')).toContainText('Вопросов: 5 — первый в боте, остальные в мини-аппе. Кому: занимались за последние 30 дней — 61 чел.')
    await expect(page.getByTestId('survey-send')).toBeDisabled()
    await page.getByTestId('survey-send-me').click()

    await expect(page.getByTestId('survey-note')).toContainText('пройди форму до конца')
    expect(calls.prepared).toHaveLength(1)
    const sent = calls.prepared[0]
    expect([sent.key, sent.newSurveySlug, sent.audience, sent.sampleSize, sent.dryRun]).toEqual(['', 'users-test', 'owner', null, false])
    expect(sent.survey.intro).toBe(intro)
    expect(sent.survey.questions.map((q: any) => q.text)).toEqual([ifGone.text, whatElseNow.text, whyGeorgian.text, lastHelped.text, lastAnnoyed.text])
    expect(sent.survey.questions[1]).toMatchObject({ kind: 'choice', options: ['Репетитор или курсы', 'Duolingo и другие приложения', 'Только TraleBot'], allowOther: true })
    expect(sent.survey.questions[0]).toMatchObject({ optionKeys: ['very', 'somewhat', 'indifferent', 'unused'], headlineOption: 'very', headlineWithout: 'unused' })
    expect(calls.sent).toEqual(['survey-2026-10-users-test'])
    await expect(page.getByTestId('survey-send')).toBeDisabled()
    await fits(page)
    await shot(page, 'form-7-send', true)
    expect(calls.formAnswers).toEqual([])
  })

  test('the form for those who paid: the headline number survives renamed buttons, and the builder warns when it is lost', async ({ page }) => {
    const calls = await setup(page, { me: owner })
    await openAdmin(page)
    await page.getByTestId('admin-section-survey').click()
    await page.getByTestId('survey-preset-paid').click()

    await expect(page.getByTestId('survey-preview')).toContainText(`${paidIntro}\n\n${ifGone.text}`)
    await expect(page.locator('[data-testid^="survey-question-open-"]')).toHaveCount(5)
    await expect(card(page, 4)).toContainText('Подписка действует · Перестал(а) заниматься · Хватает бесплатного · Дорого · Просто забыл(а) · Другое')
    await expect(page.getByTestId('survey-question-headline-0')).toHaveText('с главной цифрой в результатах')
    await fits(page)
    await shot(page, 'form-10-paid-questions', true)

    await page.getByTestId('survey-question-open-0').click()
    await page.getByTestId('survey-option-0').click()
    await page.getByLabel('Вариант 1').fill('Будет очень жаль')
    await page.getByLabel('Вариант 1').press('Enter')
    await expect(page.getByTestId('survey-headline-ok')).toContainText('доля «Будет очень жаль» среди ответивших, не считая тех, кто выбрал «Уже не пользуюсь»')
    await fits(page)
    await shot(page, 'form-11-headline-kept', true)
    await page.getByTestId('survey-question-done').click()
    await page.getByTestId('survey-next').click()
    await page.getByTestId('survey-audience-paying').click()
    await page.getByTestId('survey-next').click()
    await page.getByTestId('survey-send-me').click()
    await expect(page.getByTestId('survey-note')).toContainText('пройди форму до конца')
    expect(calls.prepared[0].newSurveySlug).toBe('paid-test')
    expect(calls.prepared[0].survey.intro).toBe(paidIntro)
    expect(calls.prepared[0].survey.questions[0]).toMatchObject({
      options: ['Будет очень жаль', 'Немного расстроюсь', 'Мне всё равно', 'Уже не пользуюсь'],
      optionKeys: ['very', 'somewhat', 'indifferent', 'unused'], headlineOption: 'very', headlineWithout: 'unused',
    })

    await page.getByTestId('survey-back').click()
    await page.getByTestId('survey-back').click()
    await page.getByTestId('survey-question-open-0').click()
    await page.getByRole('button', { name: 'Убрать вариант Уже не пользуюсь' }).click()
    await expect(page.getByTestId('survey-headline-ok')).toHaveCount(0)
    await expect(page.getByTestId('survey-headline-lost')).toContainText('Главной цифры по этому вопросу в результатах не будет')
    await fits(page)
    await shot(page, 'form-12-headline-lost', true)
    await page.getByTestId('survey-question-done').click()
    await expect(page.getByTestId('survey-question-headline-0')).toContainText('главной цифры в результатах не будет')

    await page.getByRole('button', { name: 'Убрать вопрос 1' }).click()
    await expect(page.getByTestId('survey-headline-removed')).toContainText('Ты его убрал, цифры в результатах не будет')
    await fits(page)
    await shot(page, 'form-13-headline-question-removed', true)
  })

  test('the builder explains why a question cannot stand first', async ({ page }) => {
    await setup(page, { me: owner })
    await openAdmin(page)
    await page.getByTestId('admin-section-survey').click()
    await page.getByTestId('survey-preset-users').click()

    await page.getByRole('button', { name: 'Поднять вопрос 3' }).click()
    await page.getByRole('button', { name: 'Поднять вопрос 2' }).click()

    await expect(card(page, 0)).toContainText(whyGeorgian.text)
    await expect(page.getByTestId('survey-question-problem-0')).toHaveText('Первый вопрос приходит в бот кнопками — у него не больше 4 вариантов. Убери лишние или поставь первым другой вопрос.')
    await expect(page.getByTestId('survey-next')).toBeDisabled()
    await expect(page.getByTestId('survey-try')).toBeDisabled()
    await fits(page)
    await shot(page, 'form-2-questions-problem', true)

    await page.getByRole('button', { name: 'Опустить вопрос 1' }).click()
    await expect(page.getByTestId('survey-problem')).toHaveCount(0)
    await expect(page.getByTestId('survey-next')).toBeEnabled()
  })

  test('a survey left half sent is found again, finished, and sent to the rest of the group', async ({ page }) => {
    const calls = await setup(page, { me: owner })
    page.on('dialog', dialog => dialog.accept())
    await openAdmin(page)
    await page.getByTestId('admin-section-survey').click()
    await expect(page.getByTestId('survey-unfinished')).toHaveCount(0)
    await page.getByTestId('survey-preset-users').click()
    await page.getByTestId('survey-next').click()
    await page.getByTestId('survey-next').click()
    await page.getByTestId('survey-pick').click()
    await expect(page.getByTestId('survey-status')).toContainText('Выбрано 100 · ждут 100')
    await expect(page.getByTestId('survey-back')).toHaveCount(0)
    await page.getByTestId('survey-send').click()
    await expect(page.getByTestId('survey-status')).toContainText('ждут 75 · дошло 25')

    // Владелец закрыл конструктор посередине и вернулся позже.
    await page.getByRole('button', { name: 'Назад' }).click()
    await expect(page.getByTestId('admin-sections')).toBeVisible()
    await page.getByTestId('admin-section-survey').click()

    const left = page.getByTestId('survey-unfinished')
    await expect(left).toContainText(ifGone.text)
    await expect(left).toContainText('отправлено 25 из 100')
    await expect(left).not.toContainText('survey-2026')
    await expect(page.getByTestId('survey-preset-users')).toBeVisible()
    await fits(page)
    await shot(page, 'survey-resume-1-unfinished', true)
    await left.getByRole('button', { name: 'Продолжить' }).click()

    await expect(stepTitle(page)).toHaveText('Отправка')
    await expect(page.getByTestId('survey-preview')).toContainText(ifGone.text)
    await expect(page.getByTestId('survey-summary')).toContainText('Вопросов: 5')
    await expect(page.getByTestId('survey-status')).toContainText('Выбрано 100 · ждут 75 · дошло 25')
    await expect(page.getByTestId('survey-send')).toBeEnabled()
    await expect(page.getByTestId('survey-pick')).toBeDisabled()
    await fits(page)
    await shot(page, 'survey-resume-2-sending', true)

    for (const waiting of [50, 25, 0]) {
      await page.getByTestId('survey-send').click()
      await expect(page.getByTestId('survey-status')).toContainText(`ждут ${waiting} ·`)
    }
    await expect(page.getByTestId('survey-send')).toBeDisabled()
    await expect(page.getByTestId('survey-send-hint')).toContainText('Можно выбрать остальных')
    await fits(page)
    await shot(page, 'survey-resume-3-sample-done', true)

    // Пробная группа получила всё — из того же шага выбираются остальные, под тем же именем и с той же формой.
    await page.getByRole('button', { name: 'Выбрать всех остальных' }).click()
    await expect(page.getByTestId('survey-status')).toContainText('Выбрано 553 · ждут 453 · дошло 100')
    await expect(page.getByTestId('survey-send')).toBeEnabled()
    const rest = calls.prepared.at(-1)
    expect([rest.key, rest.audience, rest.sampleSize, rest.dryRun]).toEqual([NEW, 'accessEnded', null, false])
    expect(rest.survey.questions.map((q: any) => q.text)).toEqual(users.map(q => q.text))
    await fits(page)
    await shot(page, 'survey-resume-4-rest-picked', true)

    // И из «Отзывов» к недосланному опросу тоже есть дорога.
    await page.getByTestId('survey-open-results').click()
    await expect(page.getByTestId('feedback-survey-unfinished')).toContainText('Не дослано: отправлено 100 из 553')
    await fits(page)
    await shot(page, 'survey-resume-5-results', true)
    await page.getByTestId('feedback-survey-resume').click()
    await expect(stepTitle(page)).toHaveText('Отправка')
    await expect(page.getByTestId('survey-status')).toContainText('Выбрано 553 · ждут 453 · дошло 100')
  })

  test('«Отзывы»: a survey shows how far people got and every question; answers narrow to one option of the first question', async ({ page }) => {
    await setup(page, { me: owner })
    await openAdmin(page)
    await page.getByTestId('admin-section-feedback').click()

    const list = page.getByTestId('feedback-list')
    await expect(list.getByTestId(`feedback-open-survey-${KEY}`)).toContainText(ifGone.text)
    await expect(list.getByTestId(`feedback-open-survey-${KEY}`)).toContainText('8 октября · занимались за последние 30 дней · вопросов: 5')
    await expect(list.getByTestId(`feedback-open-survey-${KEY}`)).toContainText('получили 61 · ответили 34 · дошли до конца 15')
    await expect(list).not.toContainText('survey-2026')
    await fits(page)
    await shot(page, 'form-8-feedback-list', true)

    await list.getByTestId(`feedback-open-survey-${KEY}`).click()
    await expect(page.getByTestId('feedback-funnel')).toHaveText('получили61ответили на первый вопрос34 · 56%открыли форму в мини-аппе22 · 36%дошли до конца15 · 25%')
    await expect(page.getByTestId('feedback-headline')).toHaveText('47%«Очень расстроюсь» — 14 из 30 (без тех, кто ответил «Уже не пользуюсь»)')
    await expect(page.getByTestId('feedback-question-q2')).toContainText('Репетитор или курсы7 · 33%')
    await expect(page.getByTestId('feedback-question-q2')).toContainText('Разговариваю с соседями')
    await expect(page.getByTestId('feedback-question-q4')).toContainText('В аптеке: вспомнил')
    await expect(page.getByTestId('feedback-question-q4')).toContainText('Честно — не помню.')
    await fits(page)
    await shot(page, 'form-9-results', true)

    await page.getByTestId('feedback-segments').getByRole('button', { name: 'Очень расстроюсь' }).click()
    await expect(page.getByTestId('feedback-question-q2')).toContainText('Репетитор или курсы6 · 55%')
    await expect(page.getByTestId('feedback-question-q2')).not.toContainText('Разговариваю с соседями')
    await expect(page.getByTestId('feedback-question-q4')).not.toContainText('Честно — не помню.')
    await expect(page.getByTestId('feedback-funnel')).toContainText('получили61')
    await fits(page)
    await shot(page, 'form-9-results-segment', true)

    await page.getByRole('button', { name: 'Назад' }).click()
    await page.getByTestId('feedback-open-paywall').click()
    await expect(page.getByTestId('feedback-paywall')).toContainText('Спросили 41 · ответили 26')
    await expect(page.getByTestId('feedback-paywall')).toContainText('Месяц ещё ладно')
    await expect(page.getByTestId('feedback-paywall')).not.toContainText('expensive')
    await fits(page)
    await shot(page, 'survey-7-paywall-answers', true)

    await page.getByRole('button', { name: 'Назад' }).click()
    await page.getByTestId('feedback-open-messages').click()
    await expect(page.getByTestId('feedback-messages')).toContainText(`из опроса: ${ifGone.text}`)
    await expect(page.getByTestId('feedback-messages')).toContainText('Спасибо за глаголы')
    await fits(page)
    await shot(page, 'survey-8-messages', true)

    await page.getByRole('button', { name: 'Назад' }).click()
    await page.getByRole('button', { name: 'Назад' }).click()
    await expect(page.getByTestId('admin-sections')).toBeVisible()
  })
})
