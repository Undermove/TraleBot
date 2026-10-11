import { test, expect } from '@playwright/test'

// Перевод слова в словаре: глагол базы приходит карточкой (verbCard в POST /api/miniapp/translate) —
// название действия и главные формы для русского инфинитива, значение и «что это за форма» для
// грузинской формы. Формы ниже — из каталога (verbs.json): «ходить» и «быть».

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
  authenticated: true, isPro: true, isTrialActive: false, trialDaysLeft: 0, hasAccess: true, level: 'intermediate', vocabularyCount: 1,
  progress: { xp: 200, streak: 0, lastPlayedAtUtc: null, completedLessons: {}, xpSpent: 0, totalTreatsGiven: 0, lastFedAtUtc: null, lastTreatIndex: null },
  uiHints: ['ui:verbs_own_verb'],
}

const catalog = {
  botUsername: 'TraleBot', miniAppEnabled: true,
  modules: [{ id: 'my-vocabulary', title: 'Мой словарь', emoji: '📒', description: 'Личный словарь', lessons: [] }],
}

const persons = (forms: string[]) => forms.map((f) => [f])
const walk = {
  id: 'დადის', title: 'სვლა', ru: 'ходить', kind: 'special', present: ['დავდივარ'], masdarWithPreverb: [], reason: '', root: '',
  oddTenses: [], model: null, sentences: [], source: 'https://en.wiktionary.org/wiki/x', status: 'verified',
  tenses: { present: persons(['დავდივარ', 'დადიხარ', 'დადის', 'დავდივართ', 'დადიხართ', 'დადიან']) },
  meanings: { present: ['я хожу', 'ты ходишь', 'он ходит', 'мы ходим', 'вы ходите', 'они ходят'] },
}

const line = (form: string, transcription: string, tense: string, person: number, meaning: string, caption: string) =>
  ({ forms: [{ form, transcription }], tense, person, meaning, note: null, caption })

const walkCard = {
  kind: 'infinitive', text: 'ходить', transcription: null, moreVerbs: 0, related: [],
  verbs: [{
    verbId: 'დადის', lemma: 'დადის', lemmaTranscription: 'дадис', actionName: 'სვლა', actionNameTranscription: 'свла', ru: 'ходить',
    lines: [
      line('დავდივარ', 'давдивар', 'present', 0, 'я хожу', 'я, настоящее время'),
      line('დადის', 'дадис', 'present', 2, 'он ходит', 'он/она, настоящее время'),
      line('დავდიოდი', 'давдиоди', 'imperfect', 0, 'я ходил(а)', 'я, прошедшее время: делал долго или часто'),
    ],
  }],
}

const wasCard = {
  kind: 'form', text: 'იყო', transcription: 'икъо', moreVerbs: 0, related: [],
  verbs: [{
    verbId: 'არის', lemma: 'არის', lemmaTranscription: 'арис', actionName: null, actionNameTranscription: null, ru: 'быть',
    lines: [
      line('იყო', 'икъо', 'aorist', 2, 'он был', 'он/она, прошедшее время: сделал один раз'),
      line('იყო', 'икъо', 'optative', 1, 'тебе надо быть', '«чтобы ты…» — так говорят после «надо», «хочу»'),
    ],
  }],
}

const entry = {
  id: '1', word: 'стол', definition: 'მაგიდა', additionalInfo: '', example: '', dateAddedUtc: '2026-10-01T00:00:00Z',
  successCount: 0, successReverseCount: 0, failedCount: 0, mastery: 'new', isStarter: false, verb: null,
}

async function setupApi(page: any, answers: Record<string, object>) {
  const opened: string[] = []
  await page.route('**/api/miniapp/content', (route: any) => route.fulfill({ json: catalog }))
  await page.route('**/api/miniapp/me', (route: any) => route.fulfill({ json: me }))
  await page.route('**/api/miniapp/plans', (route: any) => route.fulfill({ json: { plans: [] } }))
  await page.route('**/api/miniapp/activity-days*', (route: any) => route.fulfill({ json: { dates: [] } }))
  await page.route('**/api/miniapp/vocabulary', (route: any) => route.fulfill({ json: { items: [entry], verbs: [], starterItems: [] } }))
  await page.route('**/api/miniapp/translate', (route: any) => route.fulfill({ json: answers[route.request().postDataJSON().word] ?? { status: 'failure' } }))
  await page.route('**/api/miniapp/verbs/**', (route: any) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname)
    if (path.endsWith('/progress')) return route.fulfill({ json: { verbId: 'დადის', canLearn: true, total: 0, forms: [] } })
    if (path.endsWith('/stories')) return route.fulfill({ json: { stories: [] } })
    if (path.endsWith('/learning')) {
      return route.fulfill({
        json: {
          progress: { verbId: 'დადის', canLearn: true, total: 0, forms: [] }, level: 'new', session: null,
          memory: { sessionsPlayed: 0, recentScenes: [], storyCompleted: false, examPassed: false },
          learner: { level: 'beginner', canType: false, dictionarySize: 0, dictionaryVerbs: 0, verbsLearned: 0 },
        },
      })
    }
    if (path.endsWith('/verbs/section')) return route.fulfill({ status: 404, json: {} })
    opened.push(path)
    return route.fulfill({ json: walk })
  })
  return () => opened
}

/** The dictionary screen: the verb deep link lands on it; the card it opened is closed first. */
async function openDictionary(page: any) {
  await page.goto(`/?playwright=1&screen=verb&verbId=${encodeURIComponent('დადის')}`)
  await expect(page.getByTestId('verb-sheet')).toBeVisible()
  await page.mouse.click(195, 20)
  await expect(page.getByTestId('verb-sheet')).toBeHidden()
}

async function translate(page: any, word: string) {
  await page.getByPlaceholder('слово на русском или грузинском').fill(word)
  await page.getByPlaceholder('слово на русском или грузинском').press('Enter')
}

test('a Russian infinitive is answered with the verb card, and «Открыть в глаголах» opens that verb', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  const opened = await setupApi(page, { ходить: { status: 'success', word: 'ходить', definition: 'სვლა', verb: null, verbCard: walkCard } })
  await openDictionary(page)

  await translate(page, 'ходить')

  const card = page.getByTestId('verb-translation-card')
  await expect(card).toBeVisible()
  await expect(card.getByTestId('verb-card-action-name')).toContainText('სვლა')
  await expect(card.getByTestId('verb-card-action-name')).toContainText('свла')
  const lines = card.getByTestId('verb-card-line')
  await expect(lines).toHaveCount(3)
  await expect(lines.nth(0)).toContainText('я хожу')
  await expect(lines.nth(0)).toContainText('დავდივარ')
  await expect(lines.nth(0)).toContainText('давдивар')
  await expect(lines.nth(1)).toContainText('он ходит')
  await expect(card.getByTestId('verb-card-saved')).toContainText('В словарь записано: ходить — სვლა')

  // Fits a 375px screen, and the button is a full-size tap target.
  const box = (await card.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(375)
  const button = card.getByTestId('verb-card-open')
  expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)

  const before = opened().length
  await button.click()
  await expect(page.getByTestId('verb-sheet')).toBeVisible()
  expect(opened().slice(before)).toEqual(['/api/miniapp/verbs/დადის'])
})

test('a Georgian form with two readings shows both in plain words', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await setupApi(page, { 'იყო': { status: 'success', word: 'იყო', definition: 'он был', verb: null, verbCard: wasCard } })
  await openDictionary(page)

  await translate(page, 'იყო')

  const card = page.getByTestId('verb-translation-card')
  await expect(card.getByTestId('verb-card-head')).toContainText('икъо')
  await expect(card.getByTestId('verb-card-head')).toContainText('у этого слова несколько значений')
  const readings = card.getByTestId('verb-card-reading')
  await expect(readings).toHaveCount(2)
  await expect(readings.nth(0)).toContainText('«он был»')
  await expect(readings.nth(0)).toContainText('он/она, прошедшее время: сделал один раз')
  await expect(readings.nth(1)).toContainText('«чтобы ты…» — так говорят после «надо», «хочу»')
  await expect(card.getByTestId('verb-card-verb')).toContainText('«быть»')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
})
