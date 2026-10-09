import { test, expect, type Page } from '@playwright/test'
import { mkdirSync, readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

// Админка глазами владельца на телефоне (375 px): обзор, каждый раздел на своём экране и по своему
// адресу, «Назад» на уровень выше — и в шапке, и системная кнопка Telegram. API подменяется; глаголы
// для экрана проверки берутся из каталога проекта. Конструктор опроса и переписка подробно пройдены
// в feedback.spec.ts — здесь они открываются как разделы.
// ADMIN_SHOTS=<папка> — дополнительно сохранить снимок каждого экрана.

test.use({ viewport: { width: 375, height: 812 } })

const shotsDir = process.env.ADMIN_SHOTS
async function shot(page: Page, name: string) {
  if (!shotsDir) return
  mkdirSync(shotsDir, { recursive: true })
  await page.waitForTimeout(350)
  // Прокручивается body, поэтому на время снимка окно вытягивается на всю высоту содержимого.
  const size = page.viewportSize()!
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.setViewportSize({ width: size.width, height: await page.evaluate(() => Math.max(document.body.scrollHeight, window.innerHeight)) })
  await page.screenshot({ path: resolve(shotsDir, `${name}.png`) })
  await page.setViewportSize(size)
}

/** На экране ничего не вылезает за ширину телефона. */
async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
}

const here = dirname(fileURLToPath(import.meta.url))
type Entry = { lemma: string; title: string; ru: string; tenses: Record<string, string[][]>; meanings: Record<string, string[]> }
const catalogVerbs: Entry[] = JSON.parse(readFileSync(resolve(here, '../../Verbs/verbs.json'), 'utf8')).verbs
/** Глагол «от нейросети» из настоящего каталога: грузинское здесь не пишется от руки. */
function modelMade(ru: string, unverified: string[], approved = false) {
  const v = catalogVerbs.find(x => x.ru === ru)!
  const tenses = ['present', 'imperfect', 'future', 'aorist']
  const row = (tense: string) => ({
    tense, cells: v.tenses[tense].map(c => c[0] ?? null), inTexts: v.tenses[tense].map((_, i) => i < 2), phrases: v.meanings[tense],
    unverified: unverified.includes(tense), completed: false,
  })
  return {
    lemma: v.lemma, title: v.title, translation: v.ru, askedText: v.ru, approvedAtUtc: '2026-10-07T10:00:00Z', learners: 2,
    mainTenses: tenses.length, verifiedMainTenses: tenses.length - unverified.length, completedTenses: [], missingTenses: [],
    reviewerReasons: [], generatorModel: 'gen', reviewerModel: 'rev',
    unverifiedTenses: unverified.map(t => ({ ...row(t), removedBefore: false })), tenses: tenses.map(row),
    ownerApprovedAtUtc: approved ? '2026-10-08T09:00:00Z' : null,
  }
}

const NOW = Date.now()
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()
const at = (day: number, time: string) => `2026-10-0${day}T${time}:00Z`

const me = {
  authenticated: true, telegramId: 309149393, isPro: true, isTrialActive: false, trialDaysLeft: 0, hasAccess: true, isOwner: true,
  level: 'intermediate', vocabularyCount: 12, notificationsEnabled: true,
  progress: { xp: 200, streak: 2, lastPlayedAtUtc: null, completedLessons: { 'alphabet-progressive': [1] }, xpSpent: 0, totalTreatsGiven: 0, lastFedAtUtc: null, lastTreatIndex: null },
}
const lesson = { id: 1, title: 'L1', short: 'L1', theory: { title: 'L1', goal: 'g', blocks: [] } }
const catalog = { botUsername: 'TraleBot', miniAppEnabled: true, modules: [{ id: 'alphabet-progressive', title: 'Алфавит', emoji: '', description: '', lessons: [lesson] }] }

const overview = {
  totalUsers: 848, newUsers7d: 21, studiedToday: 9, studied7d: 61, payments30d: 2, stars30d: 700, activeSubscriptions: 2, onTrial: 17,
  unansweredMessages: 2, unfinishedSurveys: 1, unfinishedBroadcasts: 1, verbsToReview: 2,
}
const person = (i: number, over: object = {}) => ({
  telegramId: 5000000100 + i, access: 'ended', isActive: true, registeredAtUtc: daysAgo(200 - i), lastActivityUtc: daysAgo(i * 2 + 1),
  acquisitionSource: null as string | null, vocabularyCount: (i * 7) % 40, ...over,
})
const people = [
  person(0, { access: 'paying', lastActivityUtc: daysAgo(0.2), acquisitionSource: 'ref_309149393', vocabularyCount: 86 }),
  person(1, { access: 'trial', registeredAtUtc: daysAgo(4), lastActivityUtc: daysAgo(1), acquisitionSource: 'seo_grammar_cases' }),
  person(2, { access: 'lapsed', acquisitionSource: 'verbs_oct' }),
  person(3, { isActive: false, lastActivityUtc: null }),
  ...Array.from({ length: 36 }, (_, i) => person(i + 4)),
]
const counts = { all: 848, paying: 2, trial: 17, accessEnded: 829, blocked: 40 }

const userCard = {
  telegramId: 5000000100, userId: 'u', isPro: true, isActive: true, subscriptionPlan: 'Month', subscribedUntilUtc: '2026-10-30T10:00:00Z', proPurchasedAtUtc: at(1, '10:00'),
  registeredAtUtc: '2026-03-01T10:00:00Z', currentLanguage: 'Georgian', vocabularyCount: 86, xp: 1310, streak: 4, level: 'beginner', lastActivityUtc: null,
  payments: [
    { chargeId: 'c2', plan: 'Month', amount: 100, currency: 'XTR', purchasedAtUtc: at(1, '10:00'), refundedAtUtc: null },
    { chargeId: 'c1', plan: 'Month', amount: 100, currency: 'XTR', purchasedAtUtc: '2026-08-01T10:00:00Z', refundedAtUtc: '2026-08-01T12:00:00Z' },
  ],
  acquisitionSource: 'ref_309149393', access: 'Paying', accessUntilUtc: '2026-10-30T10:00:00Z', notificationsEnabled: true, lastStudiedAtUtc: daysAgo(0.2),
  lessonsCompleted: 34, quizzesStarted: 6, verbSessionsStarted: 12, verbSessionsFinished: 9, writtenTexts: 2,
  surveyAnswers: [
    { campaignKey: 'survey-2026-10-users', question: 'Насколько TraleBot тебе нужен?', option: 'Без него никак', text: null, atUtc: at(8, '11:00') },
    { campaignKey: 'survey-2026-10-users', question: 'А что в последний раз было неудобно или сбивало с толку?', option: null, text: 'Нет озвучки у слов, которые я добавляю в словарь, — приходится гадать, как они звучат.', atUtc: at(8, '11:05') },
  ],
}

const paymentRow = (i: number) => ({ telegramId: 5000000100 + i, purchasedAtUtc: daysAgo(i * 9 + 1), plan: i % 3 === 0 ? 'Year' : 'Month', amount: i % 3 === 0 ? 600 : 100, currency: 'XTR', refundedAtUtc: i === 2 ? daysAgo(i * 9) : null })
const payments = {
  total: 6, starsTotal: 1500, refunds: 1, payments: Array.from({ length: 6 }, (_, i) => paymentRow(i)),
  endingSoon: [{ telegramId: 5000000100, plan: 'Month', untilUtc: '2026-10-30T10:00:00Z' }],
  endedLately: [{ telegramId: 5000000102, plan: 'Quarter', untilUtc: daysAgo(6) }, { telegramId: 5000000107, plan: 'Month', untilUtc: daysAgo(19) }],
}

const BROADCAST = 'broadcast-2026-10'
const campaignList = [
  { key: BROADCAST, isSurvey: false, message: 'В мини-аппе появились уроки про падежи — с короткими объяснениями и практикой.\n\nЗагляни, первые три дня — в подарок.', audience: 'accessEnded', createdAtUtc: at(8, '08:00'), buttonText: 'Открыть уроки', giftDays: 3, picked: 100, pending: 25, sent: 73, opened: 21, gifted: 14, state: 'running' },
  { key: 'referral-2026-09', isSurvey: false, message: 'Позови друга — получи неделю доступа', audience: 'onTrial', createdAtUtc: '2026-09-12T08:00:00Z', buttonText: 'Позвать', giftDays: 0, picked: 17, pending: 0, sent: 17, opened: 6, gifted: 0, state: 'done' },
  { key: 'news-2026-08', isSurvey: false, message: 'Мы обновили словарь: теперь слова можно повторять короткими сессиями.', audience: 'inactiveLong', createdAtUtc: '2026-08-02T08:00:00Z', buttonText: null, giftDays: 0, picked: 0, pending: 0, sent: 0, opened: 0, gifted: 0, state: 'draft' },
]
const campaignStatus = {
  key: BROADCAST, audience: 'accessEnded', message: campaignList[0].message, buttonText: 'Открыть уроки', buttonQuery: 'moduleId=cases', total: 100, sample: 100,
  pending: 25, sent: 73, blocked: 2, rejected: 0, unknown: 0, opened: 21, giftDays: 3, giftOfferEndsAtUtc: null, gifted: 14,
  playedVerbSession: 0, finishedVerbSession: 0, paidAfterOpen: 0, surveyAnswers: [], survey: null,
}

const SURVEY = 'survey-2026-10-users'
const survey = {
  key: SURVEY, title: 'Насколько TraleBot тебе нужен?', questions: 2, createdAtUtc: at(8, '08:00'), audience: 'activeLately', picked: 61, pending: 0,
  funnel: { sent: 61, answeredFirst: 34, openedForm: 22, finished: 15 },
}
const unfinishedSurvey = { ...survey, key: 'survey-2026-10-left', title: 'Ты сейчас учишь грузинский?', audience: 'inactiveLong', picked: 100, pending: 75, funnel: { sent: 25, answeredFirst: 4, openedForm: 1, finished: 0 } }
const feedbackOverview = {
  recent: [{ id: 'p1', kind: 'paywall', campaignKey: null, option: 'expensive', text: 'Месяц ещё ладно, но год сразу — много.', atUtc: at(8, '09:40'), telegramId: 5000000102 }],
  paywall: { shown: 41, options: [{ option: 'expensive', count: 11 }, { option: 'not_now', count: 9 }, { option: 'unclear', count: 4 }, { option: 'other', count: 2 }] },
  messages: 2, unanswered: 2, surveys: [survey, unfinishedSurvey],
}
const surveyResults = {
  summary: survey, segment: null,
  questions: [
    { id: 'q1', text: survey.title, kind: 'choice', answered: 34, headline: { option: 'Без него никак', without: 'Уже не пользуюсь', chose: 14, of: 30 }, texts: [],
      options: [{ option: 'Без него никак', count: 14 }, { option: 'Полезен, но обойдусь', count: 11 }, { option: 'Могу и без него', count: 5 }, { option: 'Уже не пользуюсь', count: 4 }] },
    { id: 'q2', text: 'А что в последний раз было неудобно или сбивало с толку?', kind: 'text', answered: 1, headline: null, options: [],
      texts: [{ id: 's1', kind: 'survey', campaignKey: SURVEY, questionId: 'q2', option: null, text: 'Нет озвучки у слов, которые я добавляю сам.', atUtc: at(8, '11:05'), telegramId: 5000000100 }] },
  ],
  written: [],
}
const threads = {
  unanswered: 2,
  threads: [
    { telegramId: 5000000100, lastKind: 'message', lastText: 'Хочу слышать, как звучит слово, которое я добавил в словарь.', lastAtUtc: at(8, '10:12'), texts: 2, status: 'new' },
    { telegramId: 5000000102, lastKind: 'paywall', lastText: 'Месяц ещё ладно, но год сразу — много.', lastAtUtc: at(8, '09:40'), texts: 1, status: 'repliedBack' },
    { telegramId: 5000000104, lastKind: 'survey', lastText: 'Долгие уроки по падежам.', lastAtUtc: at(7, '12:30'), texts: 1, status: 'answered' },
  ],
}
const thread = {
  telegramId: 5000000100, reachable: true, status: 'new', maxReplyLength: 3500, signature: 'Дима, автор TraleBot',
  items: [
    { id: 't1', fromOwner: false, text: 'Нет озвучки у слов, которые я добавляю сам.', atUtc: at(8, '11:05'), kind: 'survey', question: surveyResults.questions[1].text, option: null, delivery: null, quote: null },
    { id: 't2', fromOwner: false, text: 'Хочу слышать, как звучит слово, которое я добавил в словарь.', atUtc: at(8, '10:12'), kind: 'message', question: null, option: null, delivery: null, quote: null },
  ],
}
const kit = {
  presets: [{ id: 'users', title: 'Тем, кто пользуется', about: 'Насколько TraleBot нужен', form: { intro: 'Привет! Это Дима, я делаю TraleBot.', questions: [
    { text: 'Насколько TraleBot тебе нужен?', kind: 'choice', options: ['Без него никак', 'Полезен, но обойдусь', 'Могу и без него', 'Уже не пользуюсь'], allowOther: false },
    { text: 'А что в последний раз было неудобно или сбивало с толку?', kind: 'text', options: [], allowOther: false },
  ] } }],
  bank: [], suggestions: ['Нет времени', 'Дорого'], intro: 'Привет! Это Дима, я делаю TraleBot.', otherLabel: 'Другое',
  limits: { questions: 6, options: 6, botOptions: 4, optionLength: 64, questionLength: 300 },
}

interface Calls { prepared: any[]; sent: string[]; userQueries: URLSearchParams[]; back: number }

async function setup(page: Page, opts: { owner?: boolean; fail?: string } = {}): Promise<Calls> {
  const calls: Calls = { prepared: [], sent: [], userQueries: [], back: 0 }
  const owner = opts.owner ?? true
  await page.addInitScript(() => {
    ;(window as any).Telegram = {
      WebApp: {
        initData: 'user=%7B%22id%22%3A309149393%7D', initDataUnsafe: { user: { id: 309149393 } },
        // Системная кнопка «Назад»: тест нажимает её, вызывая то, что приложение на неё повесило.
        BackButton: { show: () => {}, hide: () => {}, onClick: (h: () => void) => { (window as any).__tgBack = h }, offClick: () => {} },
        MainButton: { show: () => {}, hide: () => {} },
        HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {} },
        openTelegramLink: () => {}, onEvent: () => {}, offEvent: () => {},
      },
    }
    try { localStorage.clear() } catch {}
  })
  // Настоящий telegram-web-app.js подменил бы window.Telegram — тогда системную кнопку «Назад» было бы не нажать.
  await page.route('https://telegram.org/**', route => route.abort())
  const json = (body: object) => (route: any) => route.fulfill({ json: body })
  await page.route('**/api/miniapp/content', json(catalog))
  await page.route('**/api/miniapp/me', json({ ...me, isOwner: owner }))
  await page.route('**/api/miniapp/activity-days*', json({ dates: [] }))
  await page.route('**/api/miniapp/referral', json({ link: '', shareText: '', invitedCount: 0, activatedCount: 0, rules: [], state: 'pro', bonusShortLabel: '', inviteLine: '', capReached: false }))

  // Всё, что под /api/admin: не владельцу сервер отвечает 404 на любой запрос.
  await page.route(/\/api\/admin\//, (route) => {
    if (!owner) return route.fulfill({ status: 404, body: '' })
    const url = new URL(route.request().url())
    const path = url.pathname.replace('/api/admin/', '')
    if (opts.fail && path.startsWith(opts.fail)) return route.fulfill({ status: 500, body: '' })
    const ok = (body: object) => route.fulfill({ json: body })

    if (path === 'overview') return ok(overview)
    if (path === 'users') {
      calls.userQueries.push(url.searchParams)
      const filter = url.searchParams.get('filter') ?? 'all'
      const search = url.searchParams.get('search')
      const skip = Number(url.searchParams.get('skip') ?? 0)
      const match = people.filter(p => (filter === 'all' || (filter === 'paying' && p.access === 'paying') || (filter === 'trial' && p.access === 'trial')
        || (filter === 'accessEnded' && ['ended', 'lapsed'].includes(p.access)) || (filter === 'blocked' && !p.isActive)) && (!search || String(p.telegramId).includes(search)))
      return ok({ total: match.length, counts, users: match.slice(skip, skip + 30) })
    }
    if (/^users\/\d+$/.test(path)) return ok({ ...userCard, telegramId: Number(path.split('/')[1]) })
    if (path === 'payments') return ok(payments)
    if (path === 'campaigns') return ok({ campaigns: campaignList })
    if (path === 'campaigns/audiences') return ok({ accessEnded: 553, onTrial: 17, paying: 3, proLapsed: 0, owner: 1, activeLately: 61, inactiveLong: 512 })
    if (path === 'campaigns/prepare') {
      const body = route.request().postDataJSON()
      calls.prepared.push(body)
      const key = body.key || (body.newBroadcastSuffix ? `${BROADCAST}-${body.newBroadcastSuffix}` : `${BROADCAST}-2`)
      return ok({ key, dryRun: body.dryRun, audienceTotal: 61, alreadyInCampaign: body.anotherAudience ? 21 : 0, picked: body.audience === 'owner' ? 1 : 40, leftForLater: 0 })
    }
    if (path.endsWith('/send')) { calls.sent.push(path.replace('campaigns/', '').replace('/send', '')); return ok({ sent: 1, blocked: 0, rejected: 0, unknown: 0, retryAfterSeconds: 0, status: campaignStatus }) }
    if (path.startsWith('campaigns/')) return ok(campaignStatus)
    if (path === 'surveys/presets') return ok(kit)
    if (path.startsWith('feedback/surveys/')) return ok(surveyResults)
    if (path === 'feedback/threads') return ok(url.searchParams.get('unanswered') === 'true' ? { ...threads, threads: threads.threads.filter(t => t.status !== 'answered') } : threads)
    if (path.startsWith('feedback/threads/')) return ok({ ...thread, telegramId: Number(path.split('/')[2]) })
    if (path === 'feedback') return ok(feedbackOverview)
    if (path === 'verbs/model-made') return ok({ count: 3, verbs: [modelMade('жить', [], true), modelMade('писать', []), modelMade('танцевать', ['future', 'aorist'])] })
    if (path === 'stats') return ok({ totalUsers: 848, activeUsers: 808, proUsers: 6, trialUsers: 17, freeUsers: 825, newUsersToday: 3, newUsersWeek: 21, newUsersMonth: 64,
      totalRevenueStars: 1500, revenueWeekStars: 100, totalPurchases: 6, totalRefunds: 1, totalVocabularyEntries: 9100, averageVocabularyPerUser: 10.7, conversionPostTrialPct: 0.7 })
    if (path === 'signups') return ok({ days: 30, points: Array.from({ length: 30 }, (_, i) => ({ date: daysAgo(29 - i).slice(0, 10), count: (i * 5) % 7 })) })
    if (path === 'jobs') return ok({ queue: { enqueued: 0, scheduled: 2, processing: 1, succeeded: 4210, failed: 3, servers: 2 }, translationsLast24h: { pending: 1, done: 37, failed: 2 } })
    if (path === 'broadcast/preview') return ok({ totalRecipients: 120, sample: [] })
    return route.fulfill({ status: 404, body: '' })
  })
  return calls
}

const title = (page: Page) => page.locator('.sticky .font-extrabold').first()
const backInHeader = (page: Page) => page.getByRole('button', { name: 'Назад' }).first()
/** Нажать системную кнопку «Назад» Telegram. */
const telegramBack = (page: Page) => page.evaluate(() => (window as any).__tgBack())
const address = (page: Page) => new URL(page.url()).search

test('the overview shows the main numbers and every section with what waits in it', async ({ page }) => {
  await setup(page)
  await page.goto('/?playwright=1')
  await page.getByRole('button', { name: 'Профиль' }).first().click()
  const entry = page.getByRole('button', { name: /Админка/ })
  await entry.scrollIntoViewIfNeeded()
  await expect(entry).toContainText('Люди, обратная связь, рассылки, оплаты')
  await expect(entry.locator('svg')).toHaveCount(1)
  await shot(page, 'admin-00-profile-entry')
  await entry.click()

  await expect(page.getByTestId('admin-figures')).toContainText('21новых за 7 дней')
  await expect(page.getByTestId('admin-figures')).toContainText('61занимались за 7 дней')
  await expect(page.getByTestId('admin-figures')).toContainText('2оплат за 30 днейзвёзд 700')
  await expect(page.getByTestId('admin-figures')).toContainText('2действующих подписок')
  await expect(page.getByTestId('admin-feedback-waits')).toHaveText('без ответа: 2 · не дослано: 1')
  await expect(page.getByTestId('admin-broadcasts-waits')).toHaveText('не дослано: 1')
  await expect(page.getByTestId('admin-verbs-waits')).toHaveText('ждут: 2')
  await expect(page.getByTestId('admin-sections').getByRole('button')).toHaveCount(6)
  for (const tile of await page.getByTestId('admin-sections').getByRole('button').all()) expect((await tile.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  expect(address(page)).toBe('?screen=admin')
  await fits(page)
  await shot(page, 'admin-01-overview')
})

test('every section opens by its own address, and «Назад» — in the header and in Telegram — goes one level up', async ({ page }) => {
  await setup(page)
  // Адрес → заголовок экрана → адрес уровнем выше.
  const levels: [string, string, string][] = [
    ['?screen=admin-users', 'Пользователи', '?screen=admin'],
    ['?screen=admin-user&id=5000000100', 'Пользователь 5000000100', '?screen=admin-users'],
    ['?screen=admin-feedback', 'Обратная связь', '?screen=admin'],
    ['?screen=admin-messages', 'Сообщения', '?screen=admin-feedback'],
    ['?screen=admin-messages&id=5000000100', 'Переписка', '?screen=admin-messages'],
    ['?screen=admin-surveys', 'Опросы', '?screen=admin-feedback'],
    [`?screen=admin-surveys&key=${SURVEY}`, 'Опрос', '?screen=admin-surveys'],
    ['?screen=admin-paywall', 'Экран покупки', '?screen=admin-feedback'],
    ['?screen=admin-survey', 'Опрос', '?screen=admin-surveys'],
    ['?screen=admin-broadcasts', 'Рассылки', '?screen=admin'],
    ['?screen=admin-broadcast', 'Новая рассылка', '?screen=admin-broadcasts'],
    [`?screen=admin-broadcast&key=${BROADCAST}`, 'Рассылка', '?screen=admin-broadcasts'],
    ['?screen=admin-verbs', 'Проверка глаголов', '?screen=admin'],
    ['?screen=admin-payments', 'Оплаты', '?screen=admin'],
    ['?screen=admin-system', 'Система', '?screen=admin'],
  ]
  for (const [link, name, parent] of levels) {
    await page.goto(`/?playwright=1&${link.slice(1)}`)
    await expect(title(page), link).toHaveText(name)
    await expect(page.getByTestId('admin-loading')).toHaveCount(0)
    await fits(page)

    await backInHeader(page).click()
    await expect.poll(() => address(page), { message: `${link}: «Назад» в шапке` }).toBe(parent)

    await page.goto(`/?playwright=1&${link.slice(1)}`)
    await expect(title(page), link).toHaveText(name)
    await telegramBack(page)
    await expect.poll(() => address(page), { message: `${link}: «Назад» Telegram` }).toBe(parent)
  }
  // С обзора «Назад» ведёт в профиль, и адрес админки из строки уходит.
  await page.goto('/?playwright=1&screen=admin')
  await expect(page.getByTestId('admin-sections')).toBeVisible()
  await telegramBack(page)
  await expect(page.getByRole('button', { name: /Админка/ })).toBeVisible()
  expect(address(page)).toBe('')
})

test("users: search, filters, pages — and a person's card with a way to write", async ({ page }) => {
  const calls = await setup(page)
  await page.goto('/?playwright=1&screen=admin')
  await page.getByTestId('admin-section-users').click()

  await expect(page.getByTestId('users-total')).toHaveText('Найдено: 40')
  await expect(page.locator('[data-testid^="user-5"]')).toHaveCount(30)
  await expect(page.getByTestId('user-5000000100')).toContainText('платит')
  await expect(page.getByTestId('user-5000000100')).toContainText('откуда: по приглашению (309149393)')
  await expect(page.getByTestId('user-5000000103')).toContainText('заблокировал бота')
  await expect(page.getByTestId('users-filters').getByRole('radio')).toHaveText(['все · 848', 'платят · 2', 'пробный период · 17', 'доступ закончился · 829', 'заблокировали бота · 40'])
  await fits(page)
  await shot(page, 'admin-02-users')

  await page.getByTestId('admin-more').click()
  await expect(page.locator('[data-testid^="user-5"]')).toHaveCount(40)
  await expect(page.getByTestId('admin-more')).toHaveCount(0)

  await page.getByRole('radio', { name: 'пробный период · 17' }).click()
  await expect(page.locator('[data-testid^="user-5"]')).toHaveCount(1)
  await page.getByRole('radio', { name: 'больше слов' }).click()
  await expect.poll(() => calls.userQueries.at(-1)?.get('sort')).toBe('words')
  await page.getByRole('radio', { name: 'все · 848' }).click()
  await page.getByLabel('Поиск по Telegram id').fill('999999')
  await expect(page.getByTestId('admin-empty')).toContainText('Никого не нашлось')
  await fits(page)
  await shot(page, 'admin-03-users-empty')
  await page.getByLabel('Поиск по Telegram id').fill('5000000100')
  await page.getByTestId('user-5000000100').click()

  await expect(page.getByTestId('user-summary')).toContainText('откудапо приглашению (309149393)')
  await expect(page.getByTestId('user-summary')).toContainText('доступплатит, до 30 окт. 2026 г. · 1 месяц')
  await expect(page.getByTestId('user-activity')).toContainText('34уроков пройдено')
  await expect(page.getByTestId('user-payments')).toContainText('возврат')
  await expect(page.getByTestId('user-answers')).toContainText('Без него никак')
  expect(address(page)).toBe('?screen=admin-user&id=5000000100')
  await fits(page)
  await shot(page, 'admin-04-user')

  await page.getByTestId('user-write').click()
  await expect(page.getByTestId('feedback-thread')).toBeVisible()
  await expect(page.getByTestId('thread-user')).toHaveText('Пользователь 5000000100')
  expect(address(page)).toBe('?screen=admin-messages&id=5000000100')
  await fits(page)
  await shot(page, 'admin-07-conversation')
})

test('feedback: three sections — messages, surveys, the paywall question', async ({ page }) => {
  await setup(page)
  await page.goto('/?playwright=1&screen=admin')
  await page.getByTestId('admin-section-feedback').click()

  await expect(page.getByTestId('feedback-list').getByRole('button')).toHaveCount(3)
  await expect(page.getByTestId('feedback-unanswered')).toHaveText('без ответа: 2')
  await expect(page.getByTestId('feedback-unfinished')).toHaveText('не дослано: 1')
  await fits(page)
  await shot(page, 'admin-05-feedback')

  await page.getByTestId('feedback-open-threads').click()
  await expect(page.getByTestId('feedback-thread-5000000102')).toContainText('человек ответил')
  await expect(page.getByRole('radio', { name: 'Без ответа · 2' })).toHaveAttribute('aria-checked', 'true')
  await fits(page)
  await shot(page, 'admin-06-messages')
  await backInHeader(page).click()

  await page.getByTestId('feedback-open-surveys').click()
  await expect(page.getByTestId('survey-new')).toBeVisible()
  await expect(page.getByTestId('feedback-open-survey-survey-2026-10-left')).toContainText('не дослано: отправлено 25 из 100')
  await fits(page)
  await shot(page, 'admin-08-surveys')
  await page.getByTestId(`feedback-open-survey-${SURVEY}`).click()
  await expect(page.getByTestId('feedback-funnel')).toContainText('получили61')
  await expect(page.getByTestId('feedback-headline')).toContainText('47%')
  await fits(page)
  await shot(page, 'admin-09-survey-results')
  await backInHeader(page).click()
  await page.getByTestId('survey-new').click()
  await expect(page.getByTestId('survey-step-title')).toHaveText('Выбери опрос')
  await expect(page.getByTestId('survey-unfinished')).toContainText('Ты сейчас учишь грузинский?')
  await fits(page)
  await shot(page, 'admin-10-survey-builder')
  // Шаг назад внутри конструктора — системной кнопкой Telegram, а не выход из него.
  await page.getByTestId('survey-preset-users').click()
  await expect(page.getByTestId('survey-step-title')).toHaveText('Вопросы')
  await telegramBack(page)
  await expect(page.getByTestId('survey-step-title')).toHaveText('Выбери опрос')
  await telegramBack(page)
  await expect(page.getByTestId('feedback-surveys')).toBeVisible()
  await backInHeader(page).click()

  await page.getByTestId('feedback-open-paywall').click()
  await expect(page.getByTestId('feedback-paywall')).toContainText('Спросили 41 · ответили 26')
  await expect(page.getByTestId('feedback-paywall').getByRole('button', { name: 'Ответить' })).toHaveCount(1)
  await fits(page)
  await shot(page, 'admin-11-paywall')
})

test('broadcasts: the list, a new one step by step with a trial to oneself, and one more group for a running one', async ({ page }) => {
  const calls = await setup(page)
  await page.goto('/?playwright=1&screen=admin')
  await page.getByTestId('admin-section-broadcasts').click()

  await expect(page.getByTestId(`broadcast-${BROADCAST}`)).toContainText('идёт')
  await expect(page.getByTestId(`broadcast-${BROADCAST}`)).toContainText('доступ закончился · отправлено 75 из 100')
  await expect(page.getByTestId(`broadcast-${BROADCAST}`)).toContainText('открыли по кнопке 21 · подарков выдано 14 (3 дн.)')
  await expect(page.getByTestId('broadcast-referral-2026-09')).toContainText('завершена')
  await expect(page.getByTestId('broadcast-news-2026-08')).toContainText('черновик')
  await fits(page)
  await shot(page, 'admin-12-broadcasts')
  await page.getByTestId('broadcast-new').click()

  const step = page.getByTestId('broadcast-step-title')
  await expect(step).toHaveText('Текст')
  await expect(page.getByTestId('broadcast-next')).toBeDisabled()
  await page.getByLabel('Текст сообщения').fill('В мини-аппе появились уроки про падежи.\n\nЗагляни — первые три дня в подарок.')
  await fits(page)
  await shot(page, 'admin-13-broadcast-text')
  await page.getByTestId('broadcast-next').click()

  await expect(step).toHaveText('Кнопка')
  await page.getByLabel('Текст кнопки').fill('Открыть глаголы')
  await page.getByRole('radio', { name: 'Раздел «Глаголы»' }).click()
  for (const choice of await page.getByTestId('broadcast-destinations').getByRole('radio').all()) expect((await choice.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await fits(page)
  await shot(page, 'admin-14-broadcast-button')
  await page.getByTestId('broadcast-next').click()

  await expect(step).toHaveText('Подарок')
  await page.getByRole('radio', { name: '3 дн. полного доступа' }).click()
  await fits(page)
  await shot(page, 'admin-15-broadcast-gift')
  await page.getByTestId('broadcast-next').click()

  await expect(step).toHaveText('Кому')
  await expect(page.getByTestId('broadcast-audience-activeLately')).toContainText('61')
  await page.getByTestId('broadcast-audience-activeLately').click()
  await fits(page)
  await shot(page, 'admin-16-broadcast-audience')
  // Системное «Назад» — на шаг раньше; данные шага на месте.
  await telegramBack(page)
  await expect(step).toHaveText('Подарок')
  await page.getByTestId('broadcast-next').click()
  await page.getByTestId('broadcast-next').click()

  await expect(step).toHaveText('Отправка')
  await expect(page.getByTestId('broadcast-summary')).toHaveText('Кнопка ведёт: Раздел «Глаголы». Подарок: 3 дн. доступа. Кому: занимались за последние 30 дней — 61 чел., сначала пробной группе из 61')
  await expect(page.getByTestId('broadcast-send')).toBeDisabled()
  await page.getByTestId('broadcast-send-me').click()
  await expect(page.getByTestId('broadcast-note')).toContainText('Отправил тебе в чат с ботом')
  expect(calls.prepared).toHaveLength(1)
  expect(calls.prepared[0]).toMatchObject({
    key: '', newBroadcast: true, newBroadcastSuffix: 'test', audience: 'owner', buttonText: 'Открыть глаголы', buttonQuery: 'screen=verbs', giftDays: 3, dryRun: false,
  })
  expect(calls.sent).toEqual([`${BROADCAST}-test`])
  await expect(page.getByTestId('broadcast-send')).toBeDisabled()
  await fits(page)
  await shot(page, 'admin-17-broadcast-send')

  // Идущая рассылка: дослать выбранным, а потом добавить ещё одну группу в ту же кампанию.
  await page.goto(`/?playwright=1&screen=admin-broadcast&key=${BROADCAST}`)
  await expect(step).toHaveText('Отправка')
  await expect(page.getByTestId('broadcast-status')).toContainText('Выбрано 100 · ждут 25 · дошло 73 · заблокировали 2')
  await expect(page.getByTestId('broadcast-status')).toContainText('открыли по кнопке 21 · подарков выдано 14')
  await expect(page.getByTestId('broadcast-summary')).toContainText('Кнопка ведёт: /?moduleId=cases')
  await expect(page.getByTestId('broadcast-send')).toBeEnabled()
  await expect(page.getByTestId('broadcast-another')).toContainText('Это будет та же рассылка: кто уже получил сообщение, второй раз его не получит, и подарок достаётся человеку один раз')
  await page.getByTestId('broadcast-another').getByRole('radio', { name: /занимались за последние 30 дней/ }).click()
  await expect(page.getByTestId('broadcast-pick-another')).toBeDisabled()
  await expect(page.getByTestId('broadcast-another')).toContainText('Сначала отправь тем, кто уже выбран.')
  await fits(page)
  await shot(page, 'admin-18-broadcast-running')
  expect(calls.sent).toHaveLength(1)
})

test('verbs, payments and system each have their screen', async ({ page }) => {
  await setup(page)
  await page.goto('/?playwright=1&screen=admin')
  await page.getByTestId('admin-section-verbs').click()
  await expect(title(page)).toHaveText('Проверка глаголов')
  await expect(page.getByText('танцевать')).toBeVisible()
  await fits(page)
  await shot(page, 'admin-19-verbs')
  await backInHeader(page).click()

  await page.getByTestId('admin-section-payments').click()
  await expect(page.getByTestId('payments-ending')).toContainText('5000000100до 30 окт. 2026 г. · 1 месяц')
  await expect(page.getByTestId('payments-ended')).toContainText('3 месяца')
  await expect(page.getByTestId('payments-list')).toContainText('возврат')
  await fits(page)
  await shot(page, 'admin-20-payments')
  await page.getByTestId('payments-ending').getByRole('button').click()
  await expect(title(page)).toHaveText('Пользователь 5000000100')
  await page.goto('/?playwright=1&screen=admin')

  await page.getByTestId('admin-section-system').click()
  await expect(page.getByTestId('system-jobs')).toContainText('выполняются 1 · упали 3')
  await expect(page.getByTestId('system-jobs')).toContainText('Переводы за сутки: ждут 1 · готово 37 · не вышло 2')
  await expect(page.getByTestId('system-pushes').getByRole('button')).toHaveCount(9)
  for (const button of await page.getByTestId('system-pushes').getByRole('button').all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await fits(page)
  await shot(page, 'admin-21-system')
})

test('someone who is not the owner sees «Нет доступа.» on every admin address and nothing else', async ({ page }) => {
  await setup(page, { owner: false })
  for (const link of ['admin', 'admin-users', 'admin-user&id=5000000100', 'admin-feedback', 'admin-messages', 'admin-messages&id=5000000100', 'admin-surveys',
    `admin-surveys&key=${SURVEY}`, 'admin-paywall', 'admin-survey', 'admin-broadcasts', `admin-broadcast&key=${BROADCAST}`, 'admin-verbs', 'admin-payments', 'admin-system']) {
    await page.goto(`/?playwright=1&screen=${link}`)
    await expect(page.getByText(/^Нет доступа/), link).toBeVisible()
    await expect(page.locator('[data-testid^="user-5"], [data-testid="admin-sections"], [data-testid="payments-list"], [data-testid="thread-send"], [data-testid="broadcast-send"]'), link).toHaveCount(0)
  }
  await shot(page, 'admin-22-denied')
})

test('a failed load says so and offers to try again', async ({ page }) => {
  await setup(page, { fail: 'payments' })
  await page.goto('/?playwright=1&screen=admin-payments')
  await expect(page.getByTestId('admin-error')).toContainText('Не получилось загрузить')
  await expect(page.getByRole('button', { name: 'Попробовать ещё раз' })).toBeVisible()
  await fits(page)
  await shot(page, 'admin-23-error')
})
