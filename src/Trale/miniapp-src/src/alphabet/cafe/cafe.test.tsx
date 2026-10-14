import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { PRODUCTS, availableProducts, isRealWord, orderText } from './products'
import { cafePlan } from './engine'
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

describe('Cafe', () => {
  const plan = {
    shelf: ['tea', 'bread', 'water', 'cheese'].map(id => PRODUCTS.find(p => p.id === id)!),
    orders: ['tea', 'water'].map(id => PRODUCTS.find(p => p.id === id)!)
  }

  it('guides the first order: one line what to do and a pointer on the right dish, then plays without hints', async () => {
    const onDone = vi.fn()
    render(<Cafe lesson={10} fraction={1} onExit={() => {}} onDone={onDone} plan={plan} />)
    expect(screen.getByTestId('cafe-howto').textContent).toBe('Гость заказывает по-грузински. Прочитай заказ и подай нужное')
    expect(screen.getByTestId('cafe-order').textContent).toBe('ჩაი')
    expect(screen.getByTestId('shelf-tea').dataset.hint).toBe('yes')
    expect(screen.getAllByTestId('cafe-pointer')).toHaveLength(1)

    // Не то блюдо — гость ждёт дальше, ничего не засчитано.
    fireEvent.click(screen.getByTestId('shelf-bread'))
    expect(screen.queryByText('следующий гость →')).toBeNull()

    await act(async () => { fireEvent.click(screen.getByTestId('shelf-tea')) })
    expect(screen.getByTestId('cafe-meaning').textContent).toBe('«чаи» — чай')
    fireEvent.click(screen.getByText('следующий гость →'))

    // Второй гость — без пальца и без подсветки.
    expect(screen.getByTestId('cafe-order').textContent).toBe('წყალი')
    expect(screen.queryByTestId('cafe-pointer')).toBeNull()
    expect(screen.getByTestId('shelf-water').dataset.hint).toBe('no')
    // Две ошибки — подсказываем.
    fireEvent.click(screen.getByTestId('shelf-bread'))
    fireEvent.click(screen.getByTestId('shelf-cheese'))
    expect(screen.getByTestId('shelf-water').dataset.hint).toBe('yes')

    await act(async () => { fireEvent.click(screen.getByTestId('shelf-water')) })
    fireEvent.click(screen.getByText('дальше →'))
    expect(screen.getByTestId('cafe-summary').textContent).toContain('ჩაი')
    expect(screen.getAllByTestId('cafe-read')).toHaveLength(2)
    fireEvent.click(screen.getByText('дальше →'))
    expect(onDone).toHaveBeenCalled()
  })

  it('writes the lesson 1 orders with ა, დ, რ inside Russian words and has no timer', () => {
    render(<Cafe lesson={1} fraction={1} onExit={() => {}} onDone={() => {}} rng={seeded(3)} />)
    const order = screen.getByTestId('cafe-order').textContent!
    expect([...order].filter(isGeorgian).every(ch => 'ადრ'.includes(ch))).toBe(true)
    expect(screen.getByTestId('cafe-sign').textContent).toBe('бомбоრა')
    expect(screen.queryByTestId('cafe-timer')).toBeNull()
  })
})
