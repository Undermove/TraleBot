import { test, expect } from '@playwright/test'

// The bot's reply to a translated verb form carries a «Все формы» WebApp button
// (VerbReplyFormatter.Button on the backend): ?screen=verb&verbId=<id>&tense=…&person=…
// It must land on the dictionary with the verb card open on the parsed form's person.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as any).Telegram = {
      WebApp: {
        initData: 'user=%7B%22id%22%3A123456%7D',
        BackButton: { show: () => {}, hide: () => {}, onClick: () => {}, offClick: () => {} },
        MainButton: { show: () => {}, hide: () => {} },
        HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {} },
        openTelegramLink: () => {},
      },
    }
  })
})

const me = {
  authenticated: true,
  isPro: true,
  isTrialActive: false,
  trialDaysLeft: 0,
  hasAccess: true,
  level: 'intermediate',
  vocabularyCount: 0,
  progress: {
    xp: 200, streak: 0, lastPlayedAtUtc: null, completedLessons: {},
    xpSpent: 0, totalTreatsGiven: 0, lastFedAtUtc: null, lastTreatIndex: null,
  },
}

const catalog = {
  botUsername: 'TraleBot',
  miniAppEnabled: true,
  modules: [{ id: 'my-vocabulary', title: 'Мой словарь', emoji: '📒', description: 'Личный словарь', lessons: [] }],
}

// Forms are the catalog's (verbs.json): present and aorist of «писать».
const persons = (forms: string[]) => forms.map((f) => [f])
const verb = {
  id: 'წერს', title: 'წერა', ru: 'писать', kind: 'pattern', present: ['ვწერ'],
  masdarWithPreverb: ['დაწერა'], reason: 'Будущее и аорист = приставка და- + основа настоящего.',
  root: 'წერ', oddTenses: [], model: null,
  tenses: {
    present: persons(['ვწერ', 'წერ', 'წერს', 'ვწერთ', 'წერთ', 'წერენ']),
    aorist: persons(['დავწერე', 'დაწერე', 'დაწერა', 'დავწერეთ', 'დაწერეთ', 'დაწერეს']),
  },
  sentences: [], source: 'https://en.wiktionary.org/wiki/x', status: 'verified',
}

async function setupApi(page: any, card: object, meResponse: object = me) {
  let verbRequests: string[] = []
  await page.route('**/api/miniapp/content', (route: any) => route.fulfill({ json: catalog }))
  await page.route('**/api/miniapp/me', (route: any) => route.fulfill({ json: meResponse }))
  await page.route('**/api/miniapp/plans', (route: any) =>
    route.fulfill({ json: { plans: [{ id: 'Month', payloadId: 'Stars_Pro_Month', stars: 100, durationDays: 30, title: '1 месяц', description: '30 дней' }] } })
  )
  await page.route('**/api/miniapp/activity-days*', (route: any) => route.fulfill({ json: { dates: [] } }))
  await page.route('**/api/miniapp/vocabulary', (route: any) => route.fulfill({ json: { items: [], starterItems: [] } }))
  // The card itself, and the parts of the sheet that ask the API on their own (ladder entry, comics).
  await page.route('**/api/miniapp/verbs/**', (route: any) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname)
    if (path.endsWith('/progress')) return route.fulfill({ json: { verbId: 'წერს', canLearn: true, total: 0, forms: [] } })
    if (path.endsWith('/stories')) return route.fulfill({ json: { stories: [] } })
    if (path.endsWith('/verbs/summary')) return route.fulfill({ json: { dictionaryVerbs: 0 } })
    verbRequests.push(path)
    return route.fulfill({ json: card })
  })
  return () => verbRequests
}

test('bot link opens the verb card on the parsed form, over the dictionary', async ({ page }) => {
  const requests = await setupApi(page, verb)

  await page.goto(`/?playwright=1&screen=verb&verbId=${encodeURIComponent('წერს')}&tense=aorist&person=3`)

  const sheet = page.getByTestId('verb-sheet')
  await expect(sheet).toBeVisible()
  // person=3 is «мы»: the table opens on that person and shows its aorist.
  await expect(page.getByTestId('verb-tense-aorist')).toContainText('დავწერეთ')
  await expect(page.getByTestId('verb-tense-present')).toContainText('ვწერთ')
  expect(requests()).toEqual(['/api/miniapp/verbs/წერს'])
  await expect(page.getByTestId('verb-unverified')).toHaveCount(0)

  // Closing the card leaves the user in the dictionary, and the link is consumed.
  await page.mouse.click(195, 20)
  await expect(sheet).toBeHidden()
  await expect(page.getByText('Твои слова здесь ещё не появились')).toBeVisible()
  expect(new URL(page.url()).search).toBe('')
})

test('card of a verb whose forms a model produced says so', async ({ page }) => {
  await setupApi(page, { ...verb, status: 'generated', source: null })

  await page.goto(`/?playwright=1&screen=verb&verbId=${encodeURIComponent('წერს')}`)

  await expect(page.getByTestId('verb-unverified')).toBeVisible()
  await expect(page.getByTestId('verb-unverified')).toContainText('Не проверено')
  // No form in the link: the card opens on «я».
  await expect(page.getByTestId('verb-tense-present')).toContainText('ვწერ')
})

test('without trial or Pro the link lands on the paywall instead of a card that cannot load', async ({ page }) => {
  const requests = await setupApi(page, verb, { ...me, isPro: false, isTrialActive: false, hasAccess: false })

  await page.goto(`/?playwright=1&screen=verb&verbId=${encodeURIComponent('წერს')}&tense=aorist&person=3`)

  await expect(page.getByRole('dialog', { name: 'Про-доступ' })).toBeVisible()
  await expect(page.getByTestId('verb-sheet')).toHaveCount(0)
  expect(requests()).toEqual([])
})
