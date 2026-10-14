import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { PRODUCTS, availableProducts, cafeLevel, isRealWord, nextLessonNews, orderText, shelfFor } from './products'
import { isOver, newDay, serve, tick, waiting, type Day, type UpgradeId } from './engine'
import { EMPTY, buy, closeDay, loadSave } from './save'
import CafeScreen from './CafeScreen'
import { learnedLetters, isGeorgian } from '../games/logic'
import { seeded } from '../../verbs/testing/catalog'

beforeEach(() => localStorage.clear())

describe('cafe products', () => {
  it.each(Array.from({ length: 11 }, (_, i) => i + 1))('level %i: every order is written only with learned Georgian letters', level => {
    const known = new Set(learnedLetters(level))
    const shelf = availableProducts(level)
    expect(shelf.length).toBeGreaterThanOrEqual(3)
    for (const p of shelf) {
      const t = orderText(p, level)!
      for (const ch of t) if (isGeorgian(ch)) expect(known.has(ch), `${t} at ${level}`).toBe(true)
      expect([...t].filter(isGeorgian).length).toBeGreaterThanOrEqual(2)
    }
  })

  it('switches an order to the real Georgian word as soon as all its letters are learned', () => {
    const water = PRODUCTS.find(p => p.id === 'water')!
    expect(orderText(water, 1)).toBe('воდა')
    expect(orderText(water, 10)).toBe('წყალი')
    const tea = PRODUCTS.find(p => p.id === 'tea')!
    expect(orderText(tea, 3)).toBeNull()
    expect(isRealWord(tea, 4)).toBe(true)
    expect(orderText(PRODUCTS.find(p => p.id === 'khachapuri')!, 9)).toBeNull()
  })

  it('puts real words on the shelf first and tells what the next lesson brings', () => {
    const shelf = shelfFor(10, 6, seeded(1))
    expect(shelf).toHaveLength(6)
    expect(shelf.filter(p => isRealWord(p, 10)).length).toBeGreaterThanOrEqual(5)
    const news = nextLessonNews(3)!
    expect(news.lesson).toBe(4)
    expect(news.added.map(p => p.id)).toContain('tea')
    expect(nextLessonNews(8)!.becameReal.map(p => p.id)).toContain('bread')
    expect(nextLessonNews(11)).toBeNull()
  })

  it('takes the level from lessons passed in a row from the first', () => {
    expect(cafeLevel(undefined)).toBe(0)
    expect(cafeLevel([1, 2, 4])).toBe(2)
    expect(cafeLevel([2, 3])).toBe(0)
  })
})

const product = (id: string) => PRODUCTS.find(p => p.id === id)!
function dayWith(ids: string[], owned: UpgradeId[] = []): Day {
  return newDay({ level: 10, shelf: ids.map(product), owned: new Set(owned) })
}

describe('cafe day', () => {
  it('brings guests over time up to the number of seats', () => {
    let d = dayWith(['tea', 'bread', 'cheese'])
    for (let t = 0; t <= 20_000; t += 100) d = tick(d, t, seeded(2))
    expect(waiting(d).length).toBeLessThanOrEqual(3)
    expect(d.guests.length).toBeGreaterThan(0)
  })

  it('pays for the right dish, grows the streak, and breaks it on a wrong one', () => {
    let d = tick(dayWith(['tea', 'bread']), 1000, () => 0) // заказ: первый товар — tea
    const g = waiting(d)[0]
    expect(g.items).toEqual(['tea'])
    const ok = serve(d, 'tea', 2000)
    expect(ok.result.kind).toBe('done')
    expect(ok.day.coins).toBeGreaterThan(0)
    expect(ok.day.combo).toBe(1)
    expect(ok.day.read).toEqual(['ჩაი'])

    d = tick(ok.day, 6000, () => 0)
    const miss = serve({ ...d, combo: 3 }, 'bread', 6100)
    expect(miss.result.kind).toBe('wrong')
    expect(miss.day.combo).toBe(0)
  })

  it('lets a guest leave when the patience runs out, and ends the day when time is up and nobody waits', () => {
    let d = tick(dayWith(['tea']), 1000, () => 0)
    const g = waiting(d)[0]
    d = tick(d, 1000 + g.patience + 1, () => 0)
    expect(d.lost).toBe(1)
    expect(d.guests.find(x => x.id === g.id)?.mood).toBe('sad')
    let t = d.length
    d = { ...d, guests: [] }
    expect(isOver(tick(d, t, () => 0), t)).toBe(true)
  })

  it('serves two-dish orders in parts with «Меню на двоих»', () => {
    let d = tick(dayWith(['tea', 'bread'], ['pair']), 1000, () => 0)
    const g = waiting(d)[0]
    expect(g.items).toHaveLength(2)
    const part = serve(d, g.items[0], 1500)
    expect(part.result.kind).toBe('part')
    const done = serve(part.day, g.items[1], 1800)
    expect(done.result.kind).toBe('done')
  })

  it('gives more seats and a longer day with upgrades', () => {
    expect(dayWith(['tea'], ['tables']).seats).toBe(4)
    expect(dayWith(['tea'], ['garland']).length).toBeGreaterThan(dayWith(['tea']).length)
  })
})

describe('cafe save', () => {
  it('buys an upgrade only with enough coins and only once', () => {
    expect(buy({ ...EMPTY, coins: 10 }, 'sign')).toBeNull()
    const s = buy({ ...EMPTY, coins: 40 }, 'sign')!
    expect(s.coins).toBe(10)
    expect(buy({ ...s, coins: 100 }, 'sign')).toBeNull()
  })

  it('adds the day to the piggy bank and marks a record', () => {
    const { save, record } = closeDay({ ...EMPTY, best: 10 }, 25)
    expect(record).toBe(true)
    expect(save).toMatchObject({ coins: 25, best: 25, days: 1 })
    expect(closeDay(save, 5).record).toBe(false)
  })

  it('survives broken storage', () => {
    localStorage.setItem('alphabet_cafe_v1', '{oops')
    expect(loadSave()).toEqual(EMPTY)
  })
})

describe('CafeScreen', () => {
  it('opens the cafe, a guest orders in learned letters, the right dish earns coins', async () => {
    vi.useFakeTimers()
    let t = 0
    render(<CafeScreen level={4} onExit={() => {}} now={() => t} rng={seeded(5)} />)
    expect(screen.getByTestId('cafe-howto')).toBeTruthy()
    expect(screen.getByTestId('cafe-sign').textContent).toBe('боმбоრა')
    fireEvent.click(screen.getByText('открыть кафе'))

    await act(async () => { for (let i = 0; i < 20; i++) { t += 100; await vi.advanceTimersByTimeAsync(100) } })
    const guest = screen.getAllByTestId('cafe-guest')[0]
    const order = guest.dataset.order!
    const want = PRODUCTS.find(p => orderText(p, 4) === order)!
    fireEvent.click(screen.getByTestId(`shelf-${want.id}`))
    await act(async () => { t += 100; await vi.advanceTimersByTimeAsync(100) })
    expect(Number(screen.getByTestId('cafe-day-coins').textContent)).toBeGreaterThan(0)

    // Закрыть день раньше — монеты в копилку.
    fireEvent.click(screen.getAllByLabelText('Назад')[0])
    expect(screen.getByTestId('cafe-summary')).toBeTruthy()
    expect(loadSave().coins).toBeGreaterThan(0)
    vi.useRealTimers()
  })
})
