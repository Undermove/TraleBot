import { test, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'fs'
import { resolve } from 'path'
import { backToDashboard, openProfile, openProfileApp } from './profile.setup'
import { DAILY_PHRASES, dayKey, phraseOfDay } from '../src/bomboraSays'

// Профиль глазами человека на телефоне (375 px): разделов «Фраза дня» и «Моё имя по-грузински» нет,
// фразу и имя говорит Бомбора в первом блоке. API подменяется; грузинское — из данных приложения.
// PROFILE_SHOTS=<папка> — дополнительно сохранить снимки для проверки глазами.

test.use({ viewport: { width: 375, height: 812 } })

// День, на который выпадает самая длинная фраза: на ней вёрстка проверяется строже всего.
const longest = DAILY_PHRASES.reduce((a, b) => (b.ge.length > a.ge.length ? b : a))
const DAY = new Date(2026, 9, 11, 12, 0)
while (phraseOfDay(dayKey(DAY)) !== longest) DAY.setDate(DAY.getDate() + 1)

const shotsDir = process.env.PROFILE_SHOTS
async function shot(page: Page, name: string) {
  if (!shotsDir) return
  mkdirSync(shotsDir, { recursive: true })
  await page.waitForTimeout(700) // реплика проявляется плавно
  await page.screenshot({ path: resolve(shotsDir, `${name}.png`) })
}

async function openApp(page: Page, firstName: string | null) {
  await page.clock.setFixedTime(DAY)
  await openProfileApp(page, { firstName })
}

const says = (page: Page) => page.getByTestId('bombora-says')
const reply = (page: Page, kind: string) => page.getByTestId(`bombora-says-${kind}`)
const noSidewaysScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
const height = async (page: Page) => (await says(page).boundingBox())!.height

test('фразу дня и имя говорит Бомбора, отдельных разделов в профиле нет', async ({ page }) => {
  await openApp(page, 'Александр')

  await expect(page.getByText('фраза дня', { exact: true })).toHaveCount(0)
  await expect(page.getByText('моё имя по-грузински')).toHaveCount(0)

  // Самый первый заход: Бомбора называет имя.
  await expect(says(page)).toHaveAttribute('data-say', 'name')
  await expect(reply(page, 'name')).toContainText('Кстати, по-грузински ты —')
  await expect(reply(page, 'name')).toBeVisible()
  await expect(reply(page, 'phrase')).toBeHidden()
  const tall = await height(page)
  expect(tall).toBeGreaterThanOrEqual(44)
  await noSidewaysScroll(page)
  await shot(page, 'after-name')

  // Нажатие листает по кругу; блок при этом не меняет высоту.
  await says(page).click()
  await expect(says(page)).toHaveAttribute('data-say', 'cheer')
  await expect(reply(page, 'cheer')).toBeVisible()
  expect(await height(page)).toBeCloseTo(tall, 1)
  await noSidewaysScroll(page)
  await shot(page, 'after-cheer')

  await says(page).click()
  await expect(says(page)).toHaveAttribute('data-say', 'phrase')
  await expect(reply(page, 'phrase')).toContainText('Фраза на сегодня:')
  await expect(reply(page, 'phrase')).toContainText(longest.ge)
  await expect(reply(page, 'phrase')).toContainText(longest.ru)
  expect(await height(page)).toBeCloseTo(tall, 1)
  await noSidewaysScroll(page)
  await shot(page, 'after-phrase')

  await says(page).click()
  await expect(says(page)).toHaveAttribute('data-say', 'name')
})

test('имя — в первый заход, фраза дня — в следующий, дальше подбадривание', async ({ page }) => {
  await openApp(page, 'Нина')
  await expect(says(page)).toHaveAttribute('data-say', 'name')

  await backToDashboard(page)
  await openProfile(page)
  await expect(says(page)).toHaveAttribute('data-say', 'phrase')

  await backToDashboard(page)
  await openProfile(page)
  await expect(says(page)).toHaveAttribute('data-say', 'cheer')

  // На другой день фраза дня снова первая.
  const tomorrow = new Date(DAY)
  tomorrow.setDate(tomorrow.getDate() + 1)
  await page.clock.setFixedTime(tomorrow)
  await backToDashboard(page)
  await openProfile(page)
  await expect(says(page)).toHaveAttribute('data-say', 'phrase')
})

test('без имени в Telegram Бомбора про имя не говорит', async ({ page }) => {
  await openApp(page, null)
  await expect(says(page)).toHaveAttribute('data-say', 'phrase')
  await expect(reply(page, 'name')).toHaveCount(0)
  await says(page).click()
  await expect(says(page)).toHaveAttribute('data-say', 'cheer')
  await says(page).click()
  await expect(says(page)).toHaveAttribute('data-say', 'phrase')
})

test('очень длинное имя не ломает вёрстку', async ({ page }) => {
  await openApp(page, 'Константинопольскийвеликолепный')
  await expect(says(page)).toHaveAttribute('data-say', 'name')
  await noSidewaysScroll(page)
  const tile = (await says(page).boundingBox())!
  const text = (await reply(page, 'name').boundingBox())!
  expect(text.x + text.width).toBeLessThanOrEqual(tile.x + tile.width)
  await shot(page, 'after-long-name')
})
