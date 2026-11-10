import { test, expect, type Page } from '@playwright/test'

// Платный модуль открывают не только плиткой на главной: ссылкой из пуша или рассылки
// (?moduleId=…&lessonId=…), карточкой «следующий урок», «любимым разделом» в профиле.
// Без доступа каждый такой путь должен кончаться экраном покупки, а не уроком (paidGate.ts).

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
    try { localStorage.removeItem('bombora_collapsed') } catch {}
  })
})

const noAccess = {
  authenticated: true,
  isPro: false,
  isTrialActive: false,
  trialDaysLeft: 0,
  hasAccess: false,
  level: 'intermediate',
  vocabularyCount: 0,
  progress: {
    xp: 200, streak: 0, lastPlayedAtUtc: null, completedLessons: {} as Record<string, number[]>,
    xpSpent: 0, totalTreatsGiven: 0, lastFedAtUtc: null, lastTreatIndex: null,
  },
}
const onTrial = { ...noAccess, isTrialActive: true, trialDaysLeft: 12, hasAccess: true }
const paid = { ...noAccess, isPro: true, hasAccess: true }

const lesson = (id: number) => ({ id, title: `Урок ${id}`, short: `Урок ${id}`, theory: { title: `Урок ${id}`, goal: 'g', blocks: [] } })
const catalog = {
  botUsername: 'TraleBot',
  miniAppEnabled: true,
  modules: [
    { id: 'alphabet-progressive', title: 'Алфавит', emoji: '🔤', description: 'Грузинский алфавит', lessons: [lesson(1)] },
    { id: 'cases', title: 'Падежи', emoji: '🧩', description: 'Падежи грузинского', lessons: [lesson(1), lesson(2)] },
  ],
}

type Me = typeof noAccess

async function setupApi(page: Page, me: Me | (() => Me)) {
  await page.route('**/api/miniapp/content', (route) => route.fulfill({ json: catalog }))
  await page.route('**/api/miniapp/me', (route) => route.fulfill({ json: typeof me === 'function' ? me() : me }))
  await page.route('**/api/miniapp/activity-days*', (route) => route.fulfill({ json: { dates: [] } }))
  await page.route('**/api/miniapp/plans', (route) =>
    route.fulfill({ json: { plans: [{ id: 'Month', payloadId: 'Stars_Pro_Month', stars: 100, durationDays: 30, title: '1 месяц', description: '30 дней' }] } })
  )
}

const purchaseScreen = (page: Page) => page.getByRole('dialog', { name: 'Про-доступ' })
/** Экран модуля: список его уроков. */
const moduleLessons = (page: Page) => page.getByTestId('lesson-btn-1')

test('no access: a link to a paid module opens the purchase screen, not the module', async ({ page }) => {
  await setupApi(page, noAccess)
  await page.goto('/?playwright=1&moduleId=cases')

  await expect(purchaseScreen(page)).toBeVisible()
  await expect(purchaseScreen(page).getByRole('button', { name: /Купить за 100/ })).toBeVisible()
  await expect(moduleLessons(page)).toHaveCount(0)
  // Под экраном покупки — обычная главная, а адрес ссылки израсходован: перезагрузка не откроет покупку снова.
  await expect(page.getByTestId('module-tile-cases')).toBeAttached()
  expect(new URL(page.url()).searchParams.get('moduleId')).toBeNull()
  // Снимок — только по просьбе: GATE_SHOTS=<папка>.
  if (process.env.GATE_SHOTS) {
    await page.waitForTimeout(400) // шторка доезжает
    await page.screenshot({ path: `${process.env.GATE_SHOTS}/paid-link-purchase-screen.png` })
  }
})

test('no access: a push link straight into a paid lesson opens the purchase screen', async ({ page }) => {
  await setupApi(page, noAccess)
  await page.goto('/?playwright=1&screen=practice&moduleId=cases&lessonId=1&src=push_return_a')

  await expect(purchaseScreen(page)).toBeVisible()
  await expect(page.getByTestId('module-tile-cases')).toBeAttached()
})

test('free period: the same link opens the module', async ({ page }) => {
  await setupApi(page, onTrial)
  await page.goto('/?playwright=1&moduleId=cases')

  await expect(moduleLessons(page)).toBeVisible()
  await expect(purchaseScreen(page)).toBeHidden()
})

test('subscription: the same link opens the module', async ({ page }) => {
  await setupApi(page, paid)
  await page.goto('/?playwright=1&moduleId=cases')

  await expect(moduleLessons(page)).toBeVisible()
  await expect(purchaseScreen(page)).toBeHidden()
})

test('no access: a link to a free module opens the module', async ({ page }) => {
  await setupApi(page, noAccess)
  await page.goto('/?playwright=1&moduleId=alphabet-progressive')

  await expect(moduleLessons(page)).toBeVisible()
  await expect(purchaseScreen(page)).toBeHidden()
})

test('no access: the «next lesson» card on the main screen opens the purchase screen', async ({ page }) => {
  // Алфавит пройден — следующим уроком главная предлагает платный модуль.
  await setupApi(page, { ...noAccess, progress: { ...noAccess.progress, completedLessons: { 'alphabet-progressive': [1] } } })
  await page.goto('/?playwright=1')

  await expect(page.getByTestId('dashboard-suggestion')).toContainText('Падежи')
  await page.getByTestId('dashboard-suggestion').click()

  await expect(purchaseScreen(page)).toBeVisible()
  await expect(page.getByTestId('dashboard-suggestion')).toBeAttached() // остались на главной
})

test('no access: «favourite module» in the profile opens the purchase screen', async ({ page }) => {
  // Уроки платного модуля человек проходил, пока доступ был.
  await setupApi(page, { ...noAccess, progress: { ...noAccess.progress, completedLessons: { cases: [1] } } })
  await page.route('**/api/miniapp/referral*', (route) => route.fulfill({ json: {} }))
  await page.goto('/?playwright=1')

  await page.getByRole('button', { name: /Профиль/ }).last().click()
  await page.getByRole('button', { name: /Падежи/ }).click()

  await expect(purchaseScreen(page)).toBeVisible()
  await expect(moduleLessons(page)).toHaveCount(0)
})

test('closing the purchase screen leaves the person on the main screen with the module locked', async ({ page }) => {
  await setupApi(page, noAccess)
  await page.route('**/api/miniapp/feedback/**', (route) => route.fulfill({ json: { due: false, show: false } }))
  await page.goto('/?playwright=1&moduleId=cases')

  await expect(purchaseScreen(page)).toBeVisible()
  await page.mouse.click(195, 40) // тап мимо шторки
  await expect(purchaseScreen(page)).toBeHidden()
  await expect(page.getByTestId('module-tile-cases').locator('span[aria-label="Про-доступ"]')).toBeVisible()
})

test('after the purchase the person lands where the link was heading and can go on to a lesson', async ({ page }) => {
  let bought = false
  await setupApi(page, () => (bought ? paid : noAccess))
  await page.route('**/api/miniapp/purchase', (route) => { bought = true; return route.fulfill({ json: { ok: true, alreadyPro: true } }) })
  await page.goto('/?playwright=1&moduleId=cases')

  await purchaseScreen(page).getByRole('button', { name: /Купить за 100/ }).click()

  await expect(purchaseScreen(page)).toBeHidden()
  await expect(moduleLessons(page)).toBeVisible()
  // Дальше — в урок: покупка больше не встаёт на пути.
  await moduleLessons(page).click()
  await expect(purchaseScreen(page)).toBeHidden()
  await expect(page.getByTestId('lesson-btn-1')).toHaveCount(0)
})

test.describe('gift from a broadcast', () => {
  // Кнопка рассылки открывает ?moduleId=…&c=<кампания>: сервер в ответ на отметку об открытии дарит дни доступа.
  const giftLink = '/?playwright=1&moduleId=cases&c=myday-back'
  const gift = { ok: true, gift: { days: 7, accessUntilUtc: '2026-11-17T12:00:00Z' } }

  test('the gifted person lands in the module, not on the purchase screen', async ({ page }) => {
    let gifted = false
    await setupApi(page, () => (gifted ? onTrial : noAccess))
    await page.route('**/api/miniapp/campaign-open', (route) => { gifted = true; return route.fulfill({ json: gift }) })
    await page.goto(giftLink)

    await expect(moduleLessons(page)).toBeVisible()
    await expect(purchaseScreen(page)).toBeHidden()
  })

  test('the gift arrives late (slow network): still the module, not the purchase screen', async ({ page }) => {
    let gifted = false
    await setupApi(page, () => (gifted ? onTrial : noAccess))
    // Дольше, чем запуск ждёт отметку (2,5 с): профиль успевает загрузиться без подарка.
    await page.route('**/api/miniapp/campaign-open', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3200))
      gifted = true
      return route.fulfill({ json: gift })
    })
    await page.goto(giftLink)

    await expect(moduleLessons(page)).toBeVisible({ timeout: 10_000 })
    await expect(purchaseScreen(page)).toBeHidden()
  })

  test('a broadcast without a gift: no access means the purchase screen', async ({ page }) => {
    await setupApi(page, noAccess)
    await page.route('**/api/miniapp/campaign-open', (route) => route.fulfill({ json: { ok: true, gift: null } }))
    await page.goto(giftLink)

    await expect(purchaseScreen(page)).toBeVisible()
    await expect(moduleLessons(page)).toHaveCount(0)
  })
})
