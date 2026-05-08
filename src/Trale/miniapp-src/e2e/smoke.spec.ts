import { test, expect } from '@playwright/test'

test('mini-app shell mounts on root', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/TraleBot/)

  const root = page.locator('#root')
  await expect(root).toBeAttached()
  await expect(root).not.toBeEmpty({ timeout: 10_000 })
})
