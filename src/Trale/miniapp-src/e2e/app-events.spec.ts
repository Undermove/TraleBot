import { test, expect } from '@playwright/test'
import { playWelcome } from './welcome'

// A newcomer's first minute leaves a trail in /api/miniapp/app-events: the app opened (with how long the page took
// and from which client), loaded, the screens in order, and on hiding — the screen it was left on.

const catalog = {
  botUsername: 'TraleBot',
  miniAppEnabled: true,
  modules: [{
    id: 'alphabet-progressive', title: 'Алфавит', emoji: '🔤', description: 'Грузинский алфавит',
    lessons: [{ id: 1, title: 'Первые буквы', short: 'L1', theory: { title: 'Первые буквы', goal: 'g', blocks: [] } }],
  }],
}

const progress = { xp: 0, streak: 0, lastPlayedAtUtc: null, completedLessons: {}, xpSpent: 0, totalTreatsGiven: 0, lastFedAtUtc: null, lastTreatIndex: null }
const freshMe = { authenticated: true, level: 'beginner', isPro: false, isTrialActive: false, trialDaysLeft: 0, vocabularyCount: 0, progress }

test('the first minute is tracked: open, load, screens, and where the app was left', async ({ page }) => {
  // Telegram SDK на странице вне Telegram оставляет initData пустым — трекер включаем явно, как __lessonEventsOn.
  await page.addInitScript(() => {
    ;(window as any).__appEventsOn = true
    try { localStorage.setItem('bombora_kani_reveal_shown', '1') } catch {}
  })
  const events: any[] = []
  await page.route('**/api/miniapp/app-events', (route: any) => { events.push(...route.request().postDataJSON().events); return route.fulfill({ status: 204 }) })
  await page.route('**/api/miniapp/events', (route: any) => route.fulfill({ status: 204 }))
  await page.route('**/api/miniapp/content', (route: any) => route.fulfill({ json: catalog }))
  await page.route('**/api/miniapp/me', (route: any) => route.fulfill({ json: freshMe }))
  await page.route('**/api/miniapp/activity-days*', (route: any) => route.fulfill({ json: { dates: [] } }))
  await page.route('**/api/miniapp/progress/lesson-complete', (route: any) =>
    route.fulfill({ json: { xpEarned: 15, progress: { ...progress, xp: 15, completedLessons: { welcome: [1] } } } }))

  await page.goto('/?playwright=1')
  await expect.poll(() => events.map(e => e.event)).toEqual(expect.arrayContaining(['app_open', 'app_ready']))
  const open = events.find(e => e.event === 'app_open')
  // Клиент — как его называет SDK (вне Telegram — unknown); метку ссылки вне Telegram взять неоткуда.
  expect(open.platform).toBeTruthy()
  expect(open.value).toBeGreaterThan(0)
  expect(events.find(e => e.event === 'app_ready').target).toBeUndefined()

  await playWelcome(page)
  await page.getByRole('button', { name: 'продолжить алфавит →' }).click()
  await expect(page.getByTestId('lesson-opener')).toBeVisible()

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(() => events.some(e => e.event === 'app_hide')).toBe(true)
  const screens = events.filter(e => e.event === 'screen').map(e => e.target)
  const hide = events.find(e => e.event === 'app_hide')
  expect(screens[0]).toBe('welcome')
  expect(hide.target).toBe(screens[screens.length - 1])
  expect(hide.value).toBeGreaterThanOrEqual(0)
  console.log('screens', screens.join(' → '), '| hide on', hide.target, hide.value, 's | open', open.value, 'ms')
})
