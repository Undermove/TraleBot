import { test, expect, type Page } from '@playwright/test'

// Кружок профиля на главной показывает фото из Telegram: ссылку photo_url из initData, иначе фото через сервер
// (Bot API), иначе прежний значок человечка.

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

async function setup(page: Page, { photoUrl, server }: { photoUrl?: string; server: 'photo' | 'none' }) {
  const calls: string[] = []
  await page.addInitScript((url) => {
    (window as any).Telegram = { WebApp: {
      initData: 'user=%7B%22id%22%3A123456%7D', initDataUnsafe: { user: { id: 123456, first_name: 'Дима', ...(url ? { photo_url: url } : {}) } },
      isVersionAtLeast: () => true, BackButton: { show() {}, hide() {}, onClick() {}, offClick() {} }, MainButton: { show() {}, hide() {} },
      HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} }, onEvent() {}, offEvent() {}
    } }
  }, photoUrl ?? null)
  await page.route('https://telegram.org/**', r => r.fulfill({ body: '', contentType: 'text/javascript' }))
  await page.route('https://t.me/i/userpic/**', r => { calls.push('tg'); return r.fulfill({ body: PNG, contentType: 'image/png' }) })
  await page.route('**/api/miniapp/**', r => {
    const p = new URL(r.request().url()).pathname.replace('/api/miniapp/', '')
    if (p === 'content') return r.fulfill({ json: { botUsername: 'T', miniAppEnabled: true, modules: [{ id: 'cases', title: 'Падежи', emoji: '', description: '', lessons: [{ id: 1, title: 'У1', short: '' }, { id: 2, title: 'У2', short: '' }] }] } })
    if (p === 'me') return r.fulfill({ json: { authenticated: true, isPro: true, hasAccess: true, level: 'beginner', vocabularyCount: 1, uiHintsSeen: [], progress: { xp: 100, streak: 2, lastPlayedAtUtc: null, completedLessons: { cases: [1] }, xpSpent: 0, totalTreatsGiven: 0 } } })
    if (p === 'me/photo') {
      calls.push('server:' + (r.request().headers()['x-telegram-init-data'] ? 'auth' : 'noauth'))
      return server === 'photo' ? r.fulfill({ body: PNG, contentType: 'image/jpeg' }) : r.fulfill({ status: 404, body: '' })
    }
    return r.fulfill({ status: 404, json: {} })
  })
  return calls
}

test('фото из Telegram (photo_url) — сразу в кружке, сервер не дёргаем', async ({ page }) => {
  const calls = await setup(page, { photoUrl: 'https://t.me/i/userpic/320/abc.svg', server: 'none' })
  await page.goto('/?playwright=1')
  const img = page.getByTestId('dashboard-profile').getByTestId('tg-avatar')
  await expect(img).toHaveAttribute('src', 'https://t.me/i/userpic/320/abc.svg')
  await expect.poll(() => img.evaluate(e => (e as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  expect(calls).not.toContain('server:auth')
})

test('без photo_url — фото через сервер, с подписью initData', async ({ page }) => {
  const calls = await setup(page, { server: 'photo' })
  await page.goto('/?playwright=1')
  const img = page.getByTestId('dashboard-profile').getByTestId('tg-avatar')
  await expect(img).toHaveAttribute('src', /^blob:/)
  expect(calls).toContain('server:auth')
})

test('фото нет нигде — прежний значок человечка', async ({ page }) => {
  await setup(page, { server: 'none' })
  await page.goto('/?playwright=1')
  await expect(page.getByTestId('dashboard-profile').locator('svg')).toBeVisible()
  await expect(page.getByTestId('tg-avatar')).toHaveCount(0)
})
