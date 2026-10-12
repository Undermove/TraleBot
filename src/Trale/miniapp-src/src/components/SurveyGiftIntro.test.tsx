import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SurveyGiftIntro, { giftWords, untilText } from './SurveyGiftIntro'
import type { SurveyGiftDto } from '../api'

const NOW = new Date('2026-10-12T09:00:00Z')
const gift = (outcome: SurveyGiftDto['outcome'], untilUtc: string | null, days = 30): SurveyGiftDto => ({ outcome, days, untilUtc })

describe('giftWords — the first screen says what the person actually got', () => {
  it('the gift was given: a month is on, and until which day', () => {
    expect(giftWords(gift('given', '2026-11-11T09:00:00Z'), NOW)).toEqual({
      title: 'Месяц полного доступа включён',
      line: 'Действует до 11 ноября. Открыто всё: уроки, глаголы и словарь.'
    })
    expect(giftWords(gift('given', '2026-10-19T09:00:00Z', 7), NOW)!.title).toBe('Полный доступ на 7 дней включён')
    expect(giftWords(gift('given', '2026-11-02T09:00:00Z', 21), NOW)!.title).toBe('Полный доступ на 21 день включён')
  })

  it('a running subscription gets the month on top: «добавлен» and its new end, with the year when it is another one', () => {
    expect(giftWords(gift('addedToSubscription', '2027-07-15T09:00:00Z'), NOW)).toEqual({
      title: 'Месяц полного доступа добавлен', line: 'Подписка теперь действует до 15 июля 2027.'
    })
    expect(giftWords(gift('addedToSubscription', '2026-12-03T09:00:00Z'), NOW)!.line).toBe('Подписка теперь действует до 3 декабря.')
    expect(giftWords(gift('addedToSubscription', '2026-11-10T09:00:00Z', 7), NOW)!.title).toBe('Полный доступ продлён на 7 дней')
    expect(untilText('2026-12-31T09:00:00Z', NOW)).toBe('31 декабря')
  })

  it('a running trial gets the month on top too; lifetime access and an ended offer get their own honest words', () => {
    expect(giftWords(gift('addedToFreeAccess', '2026-12-01T09:00:00Z'), NOW)).toEqual({
      title: 'Месяц полного доступа добавлен', line: 'Бесплатный доступ теперь открыт до 1 декабря.'
    })
    const lifetime = giftWords(gift('lifetime', null), NOW)!
    expect(lifetime.title).toBe('У тебя пожизненный доступ')
    expect(lifetime.line).toContain('прибавить к нему нечего')
    expect(lifetime.title + lifetime.line).not.toMatch(/включён|добавлен/)

    const ended = giftWords(gift('offerEnded', '2026-10-10T09:00:00Z'), NOW)!
    expect(ended.title).toBe('Подарок можно было забрать до 10 октября')
    expect(ended.line).toContain('доступ не изменился')
    expect(giftWords(gift('notGiven', null), NOW)!.title).toBe('Подарок пока не включился')
  })

  it('a gift that ran out long ago is not announced again', () => {
    expect(giftWords(gift('given', '2026-09-01T09:00:00Z'), NOW)).toBeNull()
    expect(giftWords(gift('addedToSubscription', '2026-09-01T09:00:00Z'), NOW)).toBeNull()
  })

  it('no wording depends on the reader’s gender and there are no emoji', () => {
    const all = (['given', 'addedToSubscription', 'addedToFreeAccess', 'lifetime', 'offerEnded', 'notGiven'] as const)
      .map(o => giftWords(gift(o, '2026-11-11T09:00:00Z'), NOW)!).map(w => w.title + ' ' + w.line).join(' ')
    expect(all).not.toMatch(/\(а\)|\(ась\)|получил[аи]? |\p{Extended_Pictographic}/u)
  })
})

describe('SurveyGiftIntro', () => {
  it('confirms the month, invites to the questions and lets the person simply leave', async () => {
    const start = vi.fn(), close = vi.fn()
    render(<SurveyGiftIntro gift={gift('given', '2026-11-11T09:00:00Z')} questions={4} onStart={start} onClose={close} now={NOW} />)

    expect(screen.getByTestId('survey-gift-title').textContent).toBe('Месяц полного доступа включён')
    expect(screen.getByTestId('survey-gift-line').textContent).toContain('до 11 ноября')
    expect(screen.getByTestId('survey-gift-invite').textContent).toBe('Здесь 4 коротких вопроса. По ответам я решаю, что делать в боте дальше. Отвечать не обязательно — доступ уже твой.')
    expect(screen.getByTestId('survey-gift').querySelector('svg')).not.toBeNull()
    expect(screen.getByTestId('survey-gift').textContent).not.toMatch(/\p{Extended_Pictographic}/u)

    await userEvent.click(screen.getByRole('button', { name: 'Закрыть без ответов' }))
    expect(close).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Ответить на вопросы' }))
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('lifetime access: thanks, no «доступ уже твой», and it is not called a gift', () => {
    render(<SurveyGiftIntro gift={gift('lifetime', null)} questions={5} onStart={() => {}} onClose={() => {}} now={NOW} />)
    expect(screen.getByTestId('survey-gift').getAttribute('data-outcome')).toBe('lifetime')
    expect(screen.getByTestId('survey-gift-eyebrow').textContent).toBe('твой доступ')
    expect(screen.getByTestId('survey-gift-invite').textContent).toBe('Здесь 5 коротких вопросов. По ответам я решаю, что делать в боте дальше. Отвечать не обязательно.')
    expect(screen.queryByTestId('survey-gift-trial')).toBeNull()
  })

  it('the owner’s trial shows the same screen with a note that no days were given', () => {
    render(<SurveyGiftIntro gift={{ ...gift('addedToSubscription', '2026-12-03T09:00:00Z'), trial: true }} questions={4} onStart={() => {}} onClose={() => {}} now={NOW} />)
    expect(screen.getByTestId('survey-gift-title').textContent).toBe('Месяц полного доступа добавлен')
    expect(screen.getByTestId('survey-gift-eyebrow').textContent).toBe('подарок')
    expect(screen.getByTestId('survey-gift-trial').textContent).toContain('Пробная отправка: дни не начислены')
  })
})
