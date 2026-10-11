import type { Page } from '@playwright/test'
import { setup } from './verbs-section.setup'

// Профиль в e2e: общая заготовка мини-аппа плюс то, чего в ней для профиля нет, —
// теория уроков (виджет алфавита), ответ про приглашения, имя из Telegram.

const lesson = (id: number, title: string) => ({ id, title, short: '', theory: { title, goal: '', blocks: [] } })
const catalog = {
  botUsername: 'TraleBot', miniAppEnabled: true,
  modules: [
    { id: 'alphabet-progressive', title: 'Алфавит', emoji: '', description: '', lessons: [lesson(1, 'Первые буквы'), lesson(2, 'Ещё буквы')] },
    { id: 'my-vocabulary', title: 'Мой словарь', emoji: '', description: 'Личный словарь', lessons: [] }
  ]
}

export type OfferState = 'trial' | 'accessEnded' | 'pro' | 'lifetime'

// Тексты — как их отдаёт сервер (GetReferralInfoQuery) для каждого состояния.
const MINE: Record<OfferState, { label: string; line: string; rule: string }> = {
  trial: { label: '+7 дней к пробному', line: 'Позови друга — получишь +7 дней к пробному периоду', rule: 'Тебе — +7 дней к пробному периоду за каждого друга, который начал заниматься.' },
  accessEnded: { label: 'неделя доступа', line: 'Позови друга — получишь неделю доступа', rule: 'Тебе — неделя доступа за каждого друга, который начал заниматься. Неделя идёт с того дня, когда друг начал; позовёшь ещё одного — продлится на столько же.' },
  pro: { label: '+14 дней подписки', line: 'Позови друга — получишь +14 дней подписки', rule: 'Тебе — +14 дней подписки за каждого друга, который начал заниматься.' },
  lifetime: { label: '', line: '', rule: 'У тебя подписка навсегда, так что бонус тебе не нужен — но друг свои дни получит.' }
}

export function referralOffer(state: OfferState, counts: { invited?: number; activated?: number; earnedDays?: number } = {}) {
  const rules = ['Другу — 60 дней бесплатно вместо 30, если он раньше не пользовался TraleBot.', MINE[state].rule]
  if (state !== 'lifetime') {
    rules.push('«Начал заниматься» — прошёл первый урок, добавил 5 слов или купил подписку. Бонус приходит не раньше чем через час после того, как друг зашёл.')
    rules.push('Не больше 5 друзей в день и 6 в год.')
  }
  return {
    link: 'https://t.me/TraleBot?start=ref_123456',
    shareText: 'Учу грузинский в TraleBot 🇬🇪 Заходи по моей ссылке — тебе дадут 60 дней бесплатно вместо 30.',
    invitedCount: counts.invited ?? 0, activatedCount: counts.activated ?? 0, earnedDays: counts.earnedDays ?? 0,
    friendLine: 'Другу — 60 дней бесплатно', rules, state,
    bonusShortLabel: MINE[state].label, inviteLine: MINE[state].line, capReached: false
  }
}

export async function openProfileApp(page: Page, opts: { firstName?: string | null; offer?: object; shares?: string[] } = {}) {
  await setup(page)
  await page.route('**/api/miniapp/content', (route) => route.fulfill({ json: catalog }))
  await page.route('**/api/miniapp/referral', (route) => route.fulfill({ json: opts.offer ?? referralOffer('trial') }))
  // Настоящий скрипт Telegram заменил бы подставленного пользователя пустым.
  await page.route('https://telegram.org/**', (route) => route.abort())
  await page.addInitScript((name) => {
    const app = (window as any).Telegram.WebApp
    app.initDataUnsafe = { user: name ? { id: 123456, first_name: name } : { id: 123456 } }
    ;(window as any).__shares = []
    app.openTelegramLink = (url: string) => (window as any).__shares.push(url)
  }, opts.firstName ?? null)
  await page.goto('/?playwright=1')
  await openProfile(page)
}
export const openProfile = (page: Page) => page.getByRole('button', { name: 'Профиль', exact: true }).click()
export const backToDashboard = (page: Page) => page.getByRole('button', { name: 'Назад' }).click()
