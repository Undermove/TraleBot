import { test, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'fs'
import { resolve } from 'path'
import { openProfileApp, referralOffer } from './profile.setup'

// «Позови друга» в профиле на телефоне (375 px): карточка стоит сразу под Бомборой, компактная,
// с рядом мест-лапок; «Сменить уровень» из профиля убран. Ответ сервера подменяется.
// PROFILE_SHOTS=<папка> — дополнительно сохранить снимки для проверки глазами.

test.use({ viewport: { width: 375, height: 812 } })

// Высота прежнего блока «позови друга» (заголовок раздела + плитка) на 375 px при тех же ответах
// сервера, измерено на main до переделки: от 262 px (подписка навсегда) до 396 px.
const OLD_MIN_HEIGHT = 262

const shotsDir = process.env.PROFILE_SHOTS
async function shot(page: Page, name: string) {
  if (!shotsDir) return
  mkdirSync(shotsDir, { recursive: true })
  await page.waitForTimeout(600)
  await card(page).screenshot({ path: resolve(shotsDir, `ref-after-card-${name}.png`) })
}

const card = (page: Page) => page.getByTestId('referral-card')
const seats = (page: Page) => card(page).getByTestId('referral-seat').evaluateAll((all) => all.map((s) => s.getAttribute('data-seat')))
const top = async (page: Page, testId: string) => (await page.getByTestId(testId).boundingBox())!.y
const noSidewaysScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)

test('карточка стоит сразу под Бомборой, ниже прежней и без прокрутки вбок', async ({ page }) => {
  await openProfileApp(page, { offer: referralOffer('accessEnded', { invited: 3, activated: 2, earnedDays: 14 }) })
  await expect(card(page)).toBeVisible()

  // Порядок блоков: Бомбора → позови друга → активность.
  const bombora = await top(page, 'bombora-says')
  const referral = await top(page, 'referral-card')
  const activity = (await page.getByText('активность · 35 дней').boundingBox())!.y
  expect(bombora).toBeLessThan(referral)
  expect(referral).toBeLessThan(activity)

  const box = (await card(page).boundingBox())!
  expect(box.height).toBeLessThan(OLD_MIN_HEIGHT)
  expect(box.height).toBeLessThanOrEqual(200)
  await noSidewaysScroll(page)

  await expect(card(page).getByTestId('referral-reward')).toHaveText('тебе неделя доступа')
  await expect(card(page).getByTestId('referral-friend-line')).toHaveText('Другу — 60 дней бесплатно')
  expect(await seats(page)).toEqual(['started', 'started', 'waiting', 'free', 'free', 'free'])
  await expect(card(page).getByTestId('referral-caption')).toHaveText('Пришли: 3 · начали: 2 · тебе +14 дней')
  await shot(page, 'friends')

  // Кнопки — не меньше 44 px по высоте.
  for (const name of ['Позвать друга', 'как это работает']) {
    expect((await card(page).getByRole('button', { name }).boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
})

test('«Позвать друга» открывает пересылку в Telegram и благодарит на месте, карточка не растёт', async ({ page }) => {
  const offer = referralOffer('trial')
  await openProfileApp(page, { offer })
  await expect(card(page).getByTestId('referral-caption')).toHaveText('Пока никого — первое место ждёт друга')
  const before = (await card(page).boundingBox())!.height
  await shot(page, 'none')

  await card(page).getByRole('button', { name: 'Позвать друга' }).click()

  const shares: string[] = await page.evaluate(() => (window as any).__shares)
  expect(shares).toHaveLength(1)
  const url = new URL(shares[0])
  expect(url.searchParams.get('url')).toBe(offer.link)
  expect(url.searchParams.get('text')).toBe(offer.shareText)

  await expect(card(page).getByTestId('referral-caption')).toHaveText('Спасибо! Жду друга — тут появится его лапка.')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect((await card(page).boundingBox())!.height).toBeCloseTo(before, 1)
  await noSidewaysScroll(page)
  await shot(page, 'none-shared')
})

test('условия раскрываются на месте по «как это работает»', async ({ page }) => {
  const offer = referralOffer('pro', { invited: 1, activated: 1, earnedDays: 14 })
  await openProfileApp(page, { offer })
  await expect(card(page).getByTestId('referral-reward')).toHaveText('тебе +14 дней подписки')
  await expect(card(page).getByTestId('referral-rules')).toHaveCount(0)
  await shot(page, 'pro')

  await card(page).getByRole('button', { name: 'как это работает' }).click()
  for (const rule of offer.rules) await expect(card(page).getByTestId('referral-rules')).toContainText(rule)
  await expect(card(page).getByRole('button', { name: 'Скопировать ссылку' })).toBeVisible()
  await noSidewaysScroll(page)
  await shot(page, 'pro-rules')
})

test('подписка навсегда: себе ничего не обещано, ряд мест идёт дальше', async ({ page }) => {
  await openProfileApp(page, { offer: referralOffer('lifetime', { invited: 7, activated: 7 }) })
  await expect(card(page).getByTestId('referral-reward')).toHaveText('подарок другу')
  await expect(card(page).getByTestId('referral-row')).toHaveText('ряд 2')
  expect(await seats(page)).toEqual(['started', 'free', 'free', 'free', 'free', 'free'])
  await expect(card(page).getByTestId('referral-caption')).toHaveText('Пришли: 7 · начали: 7')
  await shot(page, 'lifetime')
})

test('годовой лимит исчерпан — карточки нет; «Сменить уровень» в профиле нет', async ({ page }) => {
  await openProfileApp(page, { offer: { ...referralOffer('trial', { invited: 6, activated: 6, earnedDays: 42 }), capReached: true } })
  await expect(page.getByTestId('bombora-says')).toBeVisible()
  await expect(page.getByText('настройки')).toBeVisible()
  await expect(card(page)).toHaveCount(0)
  await expect(page.getByText('Сменить уровень')).toHaveCount(0)
})
