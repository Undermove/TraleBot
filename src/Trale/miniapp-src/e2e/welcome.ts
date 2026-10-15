import { expect, type Page } from '@playwright/test'

/** Проходит знакомство с приложением целиком (буква ა → «Поймай букву» → подарок დ → слово და → три карточки) до праздника. */
export async function playWelcome(page: Page, shot?: (name: string) => Promise<void>) {
  await expect(page.getByTestId('welcome-hello')).toBeVisible()
  await shot?.('hello')
  await page.getByRole('button', { name: 'поехали →' }).click()
  await expect(page.getByTestId('intro-skip')).toBeVisible()
  await page.waitForTimeout(500)
  await shot?.('letter')
  await page.getByTestId('intro-skip').click()
  await page.getByRole('button', { name: 'дальше →' }).click()
  await expect(page.getByTestId('catch')).toBeVisible()
  await page.waitForTimeout(600)
  await shot?.('catch')
  const targets = page.locator('[data-testid="catch-bubble"][data-target="yes"]:not([disabled])')
  while (await targets.count()) { await targets.first().dispatchEvent('pointerdown'); await page.waitForTimeout(120) }
  await expect(page.getByTestId('welcome-gift')).toBeVisible({ timeout: 5000 })
  await page.getByTestId('welcome-gift-card').click()
  await page.waitForTimeout(500)
  await shot?.('gift')
  await page.getByRole('button', { name: 'читать слово →' }).click()
  const tiles = page.getByTestId('word-tile')
  await expect(tiles).toHaveCount(2)
  for (let i = 0; i < 2; i++) await tiles.nth(i).click()
  await expect(page.getByRole('button', { name: 'дальше →' })).toBeVisible({ timeout: 4000 })
  await shot?.('word')
  await page.getByRole('button', { name: 'дальше →' }).click()
  for (let i = 0; i < 3; i++) {
    await expect(page.getByTestId('welcome-tour')).toHaveAttribute('data-card', String(i))
    await page.waitForTimeout(550)
    if (i === 1) await shot?.('tour')
    await page.getByRole('button', { name: /дальше →|понятно →/ }).click()
  }
  await expect(page.getByTestId('welcome-win')).toHaveText(/Ты уже знаешь 1.букву и 1.слово/)
  await page.waitForTimeout(400)
  await shot?.('win')
}
