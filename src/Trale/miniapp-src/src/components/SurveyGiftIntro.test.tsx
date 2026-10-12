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

  it('a subscription that runs longer is not called a gift: its own date, with the year when it is another one', () => {
    const words = giftWords(gift('subscriptionIsLonger', '2027-03-05T09:00:00Z'), NOW)!
    expect(words.title).toBe('Подписка действует до 5 марта 2027')
    expect(words.line).toContain('новые дни к ней не прибавились')
    expect(words.title + words.line).not.toContain('включён')
    expect(untilText('2026-12-31T09:00:00Z', NOW)).toBe('31 декабря')
  })

  it('lifetime access, longer free access and an ended offer each get their own honest words', () => {
    const lifetime = giftWords(gift('lifetime', null), NOW)!
    expect(lifetime.title).toBe('У тебя пожизненный доступ')
    expect(lifetime.line).toContain('прибавить к нему нечего')

    expect(giftWords(gift('freeAccessIsLonger', '2026-12-01T09:00:00Z'), NOW)).toEqual({
      title: 'Полный доступ открыт до 1 декабря', line: 'Это дольше подарка, поэтому новые дни не прибавились.'
    })
    const ended = giftWords(gift('offerEnded', '2026-10-10T09:00:00Z'), NOW)!
    expect(ended.title).toBe('Подарок можно было забрать до 10 октября')
    expect(ended.line).toContain('доступ не изменился')
    expect(giftWords(gift('notGiven', null), NOW)!.title).toBe('Подарок пока не включился')
  })

  it('a gift that ran out long ago is not announced again', () => {
    expect(giftWords(gift('given', '2026-09-01T09:00:00Z'), NOW)).toBeNull()
  })

  it('no wording depends on the reader’s gender and there are no emoji', () => {
    const all = (['given', 'lifetime', 'subscriptionIsLonger', 'freeAccessIsLonger', 'offerEnded', 'notGiven'] as const)
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

  it('does not say «доступ уже твой» to someone the days were not added to', () => {
    render(<SurveyGiftIntro gift={gift('lifetime', null)} questions={5} onStart={() => {}} onClose={() => {}} now={NOW} />)
    expect(screen.getByTestId('survey-gift').getAttribute('data-outcome')).toBe('lifetime')
    expect(screen.getByTestId('survey-gift-invite').textContent).toBe('Здесь 5 коротких вопросов. По ответам я решаю, что делать в боте дальше. Отвечать не обязательно.')
  })
})
