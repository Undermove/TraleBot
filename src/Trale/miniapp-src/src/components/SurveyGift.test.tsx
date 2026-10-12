import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GiftPromiseLine, GiftResultCard, giftPromise, giftWords, questionsText, untilText } from './SurveyGift'
import type { SurveyGiftDto } from '../api'

const NOW = new Date('2026-10-12T09:00:00Z')
const gift = (outcome: SurveyGiftDto['outcome'], untilUtc: string | null = null, days = 30): SurveyGiftDto => ({ outcome, days, untilUtc })
const OUTCOMES = ['promised', 'needsAnswer', 'given', 'addedToSubscription', 'addedToFreeAccess', 'lifetime', 'offerEnded', 'notGiven'] as const

describe('giftPromise — the line above the questions', () => {
  it('promises the month for the questions, in words', () => {
    expect(giftPromise(gift('promised'), 4, NOW)).toBe('Четыре коротких вопроса — и месяц полного доступа твой')
    expect(giftPromise(gift('needsAnswer'), 4, NOW)).toBe('Четыре коротких вопроса — и месяц полного доступа твой')
    expect(giftPromise(gift('promised', null, 7), 5, NOW)).toBe('Пять коротких вопросов — и полный доступ на 7 дней твой')
    expect(questionsText(1)).toBe('Один короткий вопрос')
    expect(questionsText(2)).toBe('Два коротких вопроса')
    expect(questionsText(6)).toBe('Шесть коротких вопросов')
  })

  it('does not promise a month to lifetime access — thanks instead', () => {
    expect(giftPromise(gift('lifetime'), 4, NOW)).toBe('Спасибо за поддержку! Четыре коротких вопроса помогут мне решить, что делать дальше')
    expect(giftPromise(gift('lifetime'), 1, NOW)).toBe('Спасибо за поддержку! Один короткий вопрос поможет мне решить, что делать дальше')
  })

  it('says so when the offer is over, and nothing once the gift is given', () => {
    expect(giftPromise(gift('offerEnded', '2026-10-10T09:00:00Z'), 4, NOW)).toBe('Подарок можно было получить до 10 октября. На вопросы по-прежнему можно ответить.')
    for (const given of ['given', 'addedToSubscription', 'addedToFreeAccess'] as const) expect(giftPromise(gift(given, '2026-11-11T09:00:00Z'), 4, NOW)).toBeNull()
  })
})

describe('giftWords — the last screen says what the person actually got', () => {
  it('there was no access: a month is on, and until which day', () => {
    expect(giftWords(gift('given', '2026-11-11T09:00:00Z'), NOW)).toEqual({
      title: 'Месяц полного доступа включён',
      line: 'Действует до 11 ноября. Открыто всё: уроки, глаголы и словарь.'
    })
    expect(giftWords(gift('given', '2026-10-19T09:00:00Z', 7), NOW)!.title).toBe('Полный доступ на 7 дней включён')
    expect(giftWords(gift('given', '2026-11-02T09:00:00Z', 21), NOW)!.title).toBe('Полный доступ на 21 день включён')
  })

  it('a running subscription or trial gets the month on top: «добавлен» and the new end, with the year when it is another one', () => {
    expect(giftWords(gift('addedToSubscription', '2027-07-15T09:00:00Z'), NOW)).toEqual({
      title: 'Месяц полного доступа добавлен', line: 'Подписка теперь действует до 15 июля 2027.'
    })
    expect(giftWords(gift('addedToSubscription', '2026-12-03T09:00:00Z'), NOW)!.line).toBe('Подписка теперь действует до 3 декабря.')
    expect(giftWords(gift('addedToSubscription', '2026-11-10T09:00:00Z', 7), NOW)!.title).toBe('Полный доступ продлён на 7 дней')
    expect(giftWords(gift('addedToFreeAccess', '2026-12-01T09:00:00Z'), NOW)!.line).toBe('Бесплатный доступ теперь открыт до 1 декабря.')
    expect(untilText('2026-12-31T09:00:00Z', NOW)).toBe('31 декабря')
  })

  it('nothing answered: one answer, and the month is theirs', () => {
    expect(giftWords(gift('needsAnswer'), NOW)!.title).toBe('Ответь хотя бы на один вопрос, и месяц твой')
    expect(giftWords(gift('needsAnswer', null, 7), NOW)!.title).toBe('Ответь хотя бы на один вопрос, и полный доступ на 7 дней твой')
  })

  it('lifetime access and an ended offer get their own honest words; a promise is not a result', () => {
    const lifetime = giftWords(gift('lifetime'), NOW)!
    expect(lifetime.title).toBe('У тебя пожизненный доступ')
    expect(lifetime.title + lifetime.line).not.toMatch(/включён|добавлен/)
    const ended = giftWords(gift('offerEnded', '2026-10-10T09:00:00Z'), NOW)!
    expect(ended.title).toBe('Подарок можно было получить до 10 октября')
    expect(ended.line).toContain('доступ не изменился')
    expect(giftWords(gift('notGiven'), NOW)!.title).toBe('Подарок пока не включился')
    expect(giftWords(gift('promised'), NOW)).toBeNull()
    expect(giftWords(gift('given', '2026-09-01T09:00:00Z'), NOW)).toBeNull()
  })

  it('no wording depends on the reader’s gender and there are no emoji', () => {
    const all = OUTCOMES.flatMap(o => {
      const g = gift(o, '2026-11-11T09:00:00Z')
      const words = giftWords(g, NOW)
      return [giftPromise(g, 4, NOW) ?? '', words ? `${words.title} ${words.line}` : '']
    }).join(' ')
    expect(all).not.toMatch(/\(а\)|\(ась\)|получил[аи]? |ответил[аи]? |\p{Extended_Pictographic}/u)
  })
})

describe('the two parts of the form', () => {
  it('the line above the questions has an icon drawn in SVG; a trial is marked', () => {
    const { rerender } = render(<GiftPromiseLine gift={gift('promised')} questions={4} now={NOW} />)
    expect(screen.getByTestId('survey-gift-promise').textContent).toBe('Четыре коротких вопроса — и месяц полного доступа твой')
    expect(screen.getByTestId('survey-gift-promise').querySelector('svg')).not.toBeNull()
    expect(screen.queryByTestId('survey-gift-trial')).toBeNull()

    rerender(<GiftPromiseLine gift={{ ...gift('promised'), trial: true }} questions={4} now={NOW} />)
    expect(screen.getByTestId('survey-gift-trial').textContent).toContain('Пробная отправка: дни не начисляются')
    rerender(<GiftPromiseLine gift={gift('given', '2026-11-11T09:00:00Z')} questions={4} now={NOW} />)
    expect(screen.queryByTestId('survey-gift-promise')).toBeNull()
  })

  it('the result card: «подарок» for a gift, «твой доступ» for lifetime, a note on the owner’s trial', () => {
    const { rerender } = render(<GiftResultCard gift={gift('addedToSubscription', '2026-12-03T09:00:00Z')} now={NOW} />)
    expect(screen.getByTestId('survey-gift-eyebrow').textContent).toBe('подарок')
    expect(screen.getByTestId('survey-gift-title').textContent).toBe('Месяц полного доступа добавлен')
    expect(screen.queryByTestId('survey-gift-trial')).toBeNull()

    rerender(<GiftResultCard gift={{ ...gift('addedToSubscription', '2026-12-03T09:00:00Z'), trial: true }} now={NOW} />)
    expect(screen.getByTestId('survey-gift-trial').textContent).toContain('Пробная отправка: дни не начислены')
    rerender(<GiftResultCard gift={gift('lifetime')} now={NOW} />)
    expect(screen.getByTestId('survey-gift-eyebrow').textContent).toBe('твой доступ')
  })
})
