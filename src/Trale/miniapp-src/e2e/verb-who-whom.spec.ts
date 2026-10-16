import { test, expect } from '@playwright/test'
import { byLemma } from './verbs-section.setup'

// «Кто кого»: строка под таблицей карточки и правило шторкой. Карточки — настоящие (verbs.json).
// VERBS_SHOTS=<папка> — сохранить снимки для проверки глазами.

const shots = process.env.VERBS_SHOTS

const card = (lemma: string) => {
  const v = byLemma.get(lemma)
  return { ...v, id: v.lemma, present: v.tenses.present[0].map((f: string[]) => f), status: 'verified' }
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.addInitScript(() => {
    ;(window as any).Telegram = { WebApp: {
      initData: 'user=%7B%22id%22%3A123456%7D',
      BackButton: { show: () => {}, hide: () => {}, onClick: () => {}, offClick: () => {} },
      MainButton: { show: () => {}, hide: () => {} },
      HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {} },
      openTelegramLink: () => {},
    } }
  })
  const me = { authenticated: true, isPro: true, isTrialActive: false, trialDaysLeft: 0, hasAccess: true, level: 'intermediate', vocabularyCount: 0,
    progress: { xp: 200, streak: 0, lastPlayedAtUtc: null, completedLessons: {}, xpSpent: 0, totalTreatsGiven: 0, lastFedAtUtc: null, lastTreatIndex: null } }
  await page.route('**/api/miniapp/content', r => r.fulfill({ json: { botUsername: 'TraleBot', miniAppEnabled: true, modules: [{ id: 'my-vocabulary', title: 'Мой словарь', emoji: '📒', description: '', lessons: [] }] } }))
  await page.route('**/api/miniapp/me', r => r.fulfill({ json: me }))
  await page.route('**/api/miniapp/plans', r => r.fulfill({ json: { plans: [] } }))
  await page.route('**/api/miniapp/activity-days*', r => r.fulfill({ json: { dates: [] } }))
  await page.route('**/api/miniapp/vocabulary', r => r.fulfill({ json: { items: [], starterItems: [] } }))
  await page.route('**/api/miniapp/verbs/**', r => {
    const path = decodeURIComponent(new URL(r.request().url()).pathname)
    const id = path.split('/')[4]
    if (path.endsWith('/progress')) return r.fulfill({ json: { verbId: id, canLearn: true, total: 0, forms: [] } })
    if (path.endsWith('/stories')) return r.fulfill({ json: { stories: [] } })
    if (path.endsWith('/learning')) return r.fulfill({ status: 404, json: {} })
    if (path.endsWith('/verbs/section')) return r.fulfill({ status: 404, json: {} })
    return byLemma.has(id) ? r.fulfill({ json: card(id) }) : r.fulfill({ status: 404, json: {} })
  })
})

test('badge under the title opens «кто кого», and the rule flips the sides', async ({ page }) => {
  await page.goto(`/?playwright=1&screen=verb&verbId=${encodeURIComponent('ხედავს')}`)
  // Значок у заголовка видно сразу, без прокрутки.
  const badge = page.getByTestId('verb-who-whom-badge')
  await expect(badge).toBeInViewport()
  if (shots) { await page.waitForTimeout(400); await page.screenshot({ path: `${shots}/ww-top.png` }) }
  await badge.click()
  const sheet = page.getByTestId('who-whom-sheet')
  await expect(sheet).toBeVisible()
  await expect(page.getByTestId('who-whom-ru')).toHaveText('я вижу тебя')
  await page.waitForTimeout(500)
  if (shots) await page.screenshot({ path: `${shots}/ww-rule.png` })

  await page.getByTestId('who-whom-flip').click()
  await expect(page.getByTestId('who-whom-ru')).toHaveText('ты видишь меня')
  await expect(page.getByTestId('who-whom-aorist')).toContainText('დამინახე')

  // Я — меня нельзя: кнопка «меня» гаснет, когда «кто» — я.
  await page.getByTestId('who-0').click()
  await expect(page.getByTestId('whom-0')).toBeDisabled()

  await page.getByTestId('whom-4').click()
  await expect(page.getByTestId('who-whom-same')).toContainText('мы → тебя')
  await expect(page.getByTestId('whom-tail').first()).toHaveText('თ')
  await page.waitForTimeout(500)
  if (shots) await page.screenshot({ path: `${shots}/ww-vas.png`, fullPage: false })
  await sheet.evaluate(el => (el.firstElementChild as HTMLElement).scrollTo(0, 9999))
  if (shots) await page.screenshot({ path: `${shots}/ww-bottom.png` })
})

test('the badge under the title opens the rule', async ({ page }) => {
  await page.goto(`/?playwright=1&screen=verb&verbId=${encodeURIComponent('აღვიძებს')}`)
  await page.getByTestId('verb-who-whom-badge').click()
  await expect(page.getByTestId('who-whom-sheet')).toBeVisible()
  await expect(page.getByTestId('who-whom-ru')).toHaveText('я бужу тебя')
})

test('kind badge opens the explanation right under it', async ({ page }) => {
  await page.goto(`/?playwright=1&screen=verb&verbId=${encodeURIComponent('აღვიძებს')}`)
  await page.getByTestId('verb-why').click()
  await expect(page.getByTestId('verb-why-panel')).toBeInViewport()
  if (shots) { await page.waitForTimeout(400); await page.screenshot({ path: `${shots}/ww-why.png` }) }
})

test('verbs without a second person get no line', async ({ page }) => {
  await page.goto(`/?playwright=1&screen=verb&verbId=${encodeURIComponent('წერს')}`)
  await expect(page.getByTestId('verb-tense-present')).toBeVisible()
  await expect(page.getByTestId('verb-who-whom')).toHaveCount(0)
  await expect(page.getByTestId('verb-who-whom-badge')).toHaveCount(0)
})
