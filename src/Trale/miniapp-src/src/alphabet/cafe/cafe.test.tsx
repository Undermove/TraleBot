import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { PRODUCTS, availableProducts, isRealWord, orderText } from './products'
import { FAST_MS, cafePlan, isFast, orderAt } from './engine'
import { loadRecord, saveRecord } from './record'
import Cafe from './Cafe'
import { learnedLetters, isGeorgian, lessonLetters } from '../games/logic'
import { seeded } from '../../verbs/testing/catalog'

beforeEach(() => localStorage.clear())

const LESSONS = Array.from({ length: 11 }, (_, i) => i + 1)

describe('cafe products', () => {
  it.each(LESSONS)('lesson %i: every order is written only with learned Georgian letters', level => {
    const known = new Set(learnedLetters(level))
    const shelf = availableProducts(level)
    expect(shelf.length).toBeGreaterThanOrEqual(4)
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
})

describe('cafe plan', () => {
  it.each(LESSONS)('lesson %i: 3–4 different orders from the shelf, one dish more on the shelf, the shortest first', lesson => {
    const { shelf, orders } = cafePlan(lesson, seeded(lesson))
    expect(orders.length).toBeGreaterThanOrEqual(3)
    expect(orders.length).toBeLessThanOrEqual(4)
    expect(new Set(orders.map(o => o.id)).size).toBe(orders.length)
    expect(shelf.length).toBeGreaterThan(orders.length)
    for (const o of orders) expect(shelf).toContain(o)
    const len = (p: typeof orders[number]) => [...orderText(p, lesson)!].filter(isGeorgian).length
    expect(len(orders[0])).toBe(Math.min(...orders.map(len)))
  })

  it('prefers orders with the letters of this lesson', () => {
    for (const lesson of LESSONS) {
      const { orders } = cafePlan(lesson, seeded(lesson * 7))
      const own = lessonLetters(lesson)
      // В одиннадцатом уроке (ჟ ჯ ჰ) блюд с этими буквами нет — там все заказы из прошлых уроков.
      if (!availableProducts(lesson).some(p => own.some(l => orderText(p, lesson)!.includes(l)))) continue
      expect(orders.some(o => own.some(l => orderText(o, lesson)!.includes(l))), `lesson ${lesson}`).toBe(true)
    }
  })
})

describe('cafe shift', () => {
  it('calls a serve fast only when it is quick', () => {
    expect(isFast(0)).toBe(true)
    expect(isFast(FAST_MS - 1)).toBe(true)
    expect(isFast(FAST_MS)).toBe(false)
  })

  it('keeps a record per lesson and survives broken storage', () => {
    expect(saveRecord(3, 4)).toEqual({ best: 4, isNew: true })
    expect(saveRecord(3, 2)).toEqual({ best: 4, isNew: false })
    expect(loadRecord(4)).toBe(0)
    localStorage.setItem('alphabet_cafe_best_5', 'oops')
    expect(loadRecord(5)).toBe(0)
  })

  it('after the planned orders keeps bringing guests from the shelf, never the same dish twice in a row', () => {
    const plan = cafePlan(10, seeded(4))
    let prev = null as (typeof plan.shelf)[number] | null
    for (let n = 0; n < 30; n++) {
      const o = orderAt(plan, n, prev, seeded(n))
      if (n < plan.orders.length) expect(o).toBe(plan.orders[n])
      else { expect(plan.shelf).toContain(o); expect(o.id).not.toBe(prev?.id) }
      prev = o
    }
  })
})

describe('Cafe', () => {
  const plan = {
    shelf: ['tea', 'bread', 'water', 'cheese'].map(id => PRODUCTS.find(p => p.id === id)!),
    orders: ['tea', 'water'].map(id => PRODUCTS.find(p => p.id === id)!)
  }
  afterEach(() => vi.useRealTimers())

  it('guides the first guest without a timer, then runs a timed shift with automatic guests and tips', async () => {
    vi.useFakeTimers()
    let t = 0
    const step = async (ms: number) => { await act(async () => { for (let i = 0; i < ms / 100; i++) { t += 100; await vi.advanceTimersByTimeAsync(100) } }) }
    const onDone = vi.fn()
    render(<Cafe lesson={10} fraction={1} onExit={() => {}} onDone={onDone} plan={plan} now={() => t} rng={seeded(2)} />)

    // Первый гость: строка, что делать, стрелка у верного блюда, таймера нет — и он не идёт.
    expect(screen.getByTestId('cafe-howto').textContent).toBe('Гость заказывает по-грузински. Прочитай заказ и подай нужное')
    expect(screen.getByTestId('cafe-order').textContent).toBe('ჩაი')
    expect(screen.getByTestId('shelf-tea').dataset.hint).toBe('yes')
    expect(screen.getAllByTestId('cafe-pointer')).toHaveLength(1)
    expect(screen.queryByTestId('cafe-timer')).toBeNull()
    await step(60_000)
    expect(screen.getByTestId('cafe-order').textContent).toBe('ჩაი')

    // Не то блюдо — гость ждёт дальше.
    fireEvent.click(screen.getByTestId('shelf-bread'))
    expect(screen.queryByTestId('cafe-meaning')).toBeNull()
    await act(async () => { fireEvent.click(screen.getByTestId('shelf-tea')) })
    expect(screen.getByTestId('cafe-meaning').textContent).toBe('«чаи» — чай')
    expect(screen.queryByText(/следующий гость/)).toBeNull()

    // Через секунду сам заходит следующий гость, и пошла смена.
    await step(1100)
    expect(screen.getByTestId('cafe-order').textContent).toBe('წყალი')
    expect(screen.getByTestId('cafe-timer')).toBeTruthy()
    expect(screen.queryByTestId('cafe-pointer')).toBeNull()
    // Две ошибки — подсказываем.
    fireEvent.click(screen.getByTestId('shelf-bread'))
    fireEvent.click(screen.getByTestId('shelf-cheese'))
    expect(screen.getByTestId('shelf-water').dataset.hint).toBe('yes')
    // Подал быстро — «Быстро!», счётчик растёт.
    await act(async () => { fireEvent.click(screen.getByTestId('shelf-water')) })
    expect(screen.getByTestId('cafe-fast').textContent).toBe('Быстро!')
    expect(screen.getByTestId('cafe-served').textContent).toBe('Обслужено: 2')
    await step(1100)
    expect(screen.getByTestId('cafe-guest')).toBeTruthy()

    // Время смены вышло — итог: что прочитал.
    await step(46_000)
    expect(screen.getByTestId('cafe-summary').textContent).toContain('ჩაი')
    expect(screen.getAllByTestId('cafe-read')).toHaveLength(2)
    expect(screen.getByTestId('cafe-served-total').textContent).toBe('Обслужено: 2')
    expect(screen.getByTestId('cafe-record-new').textContent).toBe('Новый рекорд!')
    expect(screen.queryByText(/монет|чаев/)).toBeNull()
    fireEvent.click(screen.getByText('дальше →'))
    expect(onDone).toHaveBeenCalled()
  })

  it('writes the lesson 1 orders with ა, დ, რ inside Russian words and the sign in plain Cyrillic', () => {
    render(<Cafe lesson={1} fraction={1} onExit={() => {}} onDone={() => {}} rng={seeded(3)} />)
    const order = screen.getByTestId('cafe-order').textContent!
    expect([...order].filter(isGeorgian).every(ch => 'ადრ'.includes(ch))).toBe(true)
    expect(screen.getByTestId('cafe-sign').textContent).toBe('Бомбора')
    expect(screen.getByTestId('cafe-sign').className).not.toContain('font-geo')
    // Русские буквы заказа — обычным шрифтом, грузинские — грузинским.
    for (const span of screen.getByTestId('cafe-order').querySelectorAll('span.font-geo')) expect([...span.textContent!].every(isGeorgian)).toBe(true)
    for (const span of screen.getByTestId('cafe-order').querySelectorAll('span.font-sans')) expect([...span.textContent!].some(isGeorgian)).toBe(false)
  })
})
