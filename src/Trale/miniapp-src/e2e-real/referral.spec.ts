import { expect, test } from '@playwright/test'
import { createHmac } from 'node:crypto'
import { api, createLearner, installTelegram, shot, sql, type Learner } from './support'

// Приглашение друга, настоящий сквозной путь: человек, у которого пробный период давно закончился,
// зовёт друга; друг приходит по ссылке через бота и начинает заниматься; первому возвращается
// доступ на неделю — и мини-апп это показывает.
//
// Что здесь настоящее: сервер, база, вебхук бота (друг регистрируется командой /start ref_…, как из
// Telegram), фоновая обработка приглашений (PendingReferralsWorker, раз в минуту), мини-апп в браузере.
// Что подстроено: «прошёл час после регистрации друга» — время записи о приглашении сдвигается
// в базе (ждать час тест не может); первый урок друг «проходит» тем же запросом, которым мини-апп
// сообщает о пройденном уроке, без игры в браузере. Telegram недоступен (токен выдуманный), так что
// сообщения бота не уходят — заодно проверяется, что бонус от этого не зависит.

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:1411'

/** Вход друга: тот же подписанный initData, что и в support.ts (ключ — выдуманный токен сервера). */
function initDataFor(telegramId: number) {
  const fields: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'e2e',
    user: JSON.stringify({ id: telegramId, first_name: 'Friend' })
  }
  const check = Object.keys(fields).sort().map(k => `${k}=${fields[k]}`).join('\n')
  const secret = createHmac('sha256', 'WebAppData').update('local-dev-token').digest()
  fields.hash = createHmac('sha256', secret).update(check).digest('hex')
  return new URLSearchParams(fields).toString()
}

/** Сообщение боту от человека — как его прислал бы Telegram на вебхук. */
function botMessage(telegramId: number, text: string) {
  return fetch(`${BASE}/telegram/local`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      update_id: Math.floor(Math.random() * 1e9),
      message: {
        message_id: 1, date: Math.floor(Date.now() / 1000), text,
        chat: { id: telegramId, type: 'private', first_name: 'Friend' },
        from: { id: telegramId, is_bot: false, first_name: 'Friend' }
      }
    })
  })
}

test.beforeEach(async ({ context }) => { await installTelegram(context) })

test('пробный период давно закончился → позвал друга → друг начал заниматься → доступ вернулся на неделю', async ({ page }) => {
  const referrer = await createLearner()
  sql(`update "Users" set "RegisteredAtUtc" = now() - interval '200 days' where "Id" = '${referrer.id}'`)

  // 1. Доступа нет, и мини-апп честно говорит, что даст приглашение.
  const before = await api(referrer, 'me')
  expect(before.hasAccess).toBe(false)
  const offer = await api(referrer, 'referral')
  expect(offer.state).toBe('accessEnded')
  expect(offer.bonusShortLabel).toBe('неделя доступа')
  expect(offer.shareText).not.toMatch(/триал/i)

  await page.goto(referrer.url)
  await expect(page.getByTestId('trial-expired-banner')).toBeVisible()
  const cta = page.getByTestId('referral-extension-cta')
  await expect(cta).toContainText('Неделя доступа — бесплатно')
  await expect(cta).toContainText('Позови друга — получишь неделю доступа')
  await shot(page, 'referral-1-access-ended')

  // 2. Друг приходит по ссылке — через бота, командой /start с кодом из ссылки.
  const friendTelegramId = 6_000_000_000 + Math.floor(Math.random() * 900_000_000)
  expect(new URL(offer.link).searchParams.get('start')).toBe(`ref_${referrer.telegramId}`)
  await botMessage(friendTelegramId, `/start ref_${referrer.telegramId}`)

  const friendId = sql(`select "Id" from "Users" where "TelegramId" = ${friendTelegramId}`)
  expect(friendId, 'бот зарегистрировал друга').not.toBe('')
  expect(sql(`select "TrialBonusDays" from "Users" where "Id" = '${friendId}'`)).toBe('30')
  const friend: Learner = { id: friendId, telegramId: friendTelegramId, initData: initDataFor(friendTelegramId), url: '' }
  const friendMe = await api(friend, 'me')
  expect(friendMe.trialDaysLeft).toBe(60)
  expect(sql(`select count(*) from "Referrals" where "ReferrerUserId" = '${referrer.id}' and "RefereeUserId" = '${friendId}' and "ActivatedAtUtc" is null`)).toBe('1')

  // Пока друг ничего не сделал, первому ничего не начислено.
  expect((await api(referrer, 'me')).hasAccess).toBe(false)

  // 3. Друг проходит первый урок.
  await api(friend, 'progress/lesson-complete', { moduleId: 'alphabet-progressive', lessonId: 1, correct: 5, total: 5 })
  // Бонус начисляется не раньше чем через час после прихода друга — этот час «проходит» в базе.
  sql(`update "Referrals" set "CreatedAtUtc" = now() - interval '2 hours' where "RefereeUserId" = '${friendId}'`)

  // 4. Фоновая обработка приглашений срабатывает сама (раз в минуту).
  await expect.poll(
    () => sql(`select count(*) from "Referrals" where "RefereeUserId" = '${friendId}' and "ActivatedAtUtc" is not null`),
    { timeout: 90_000, intervals: [2_000] }
  ).toBe('1')

  // 5. Доступ вернулся: неделя с момента начисления, а не от регистрации.
  expect(sql(`select "ActivationTrigger" || ':' || "BonusReferrerDays" from "Referrals" where "RefereeUserId" = '${friendId}'`)).toBe('first_lesson:7')
  const untilDays = Number(sql(`select extract(epoch from ("BonusAccessUntilUtc" - now())) / 86400 from "Users" where "Id" = '${referrer.id}'`))
  expect(untilDays).toBeGreaterThan(6.9)
  expect(untilDays).toBeLessThanOrEqual(7)
  expect(sql(`select "TrialBonusDays" from "Users" where "Id" = '${referrer.id}'`)).toBe('0')

  const after = await api(referrer, 'me')
  expect(after).toMatchObject({ hasAccess: true, isTrialActive: true, isPro: false, trialDaysLeft: 7 })
  const offerAfter = await api(referrer, 'referral')
  expect(offerAfter).toMatchObject({ state: 'trial', bonusShortLabel: '+7 дней к пробному', invitedCount: 1, activatedCount: 1 })

  await page.reload()
  await expect(page.getByText('Бесплатный период — 7 дней осталось')).toBeVisible()
  await expect(page.getByTestId('trial-expired-banner')).toHaveCount(0)
  await shot(page, 'referral-2-access-back')
})
