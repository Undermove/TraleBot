import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import HaveSort from './HaveSort'
import { DECK_SIZE, GAME_MS, TRICKY, fallMs, fell, haveDeck, hintFor, isOver, send, sentence, startState } from './HaveSort.logic'
import { ALIVE, THINGS, introLesson } from '../story'
import { seeded } from '../../verbs/testing/catalog'

afterEach(() => { vi.useRealTimers() })

describe('HaveSort logic', () => {
  it('builds a 20-card deck: people mode mostly alive, full mode balanced with the tricky words', () => {
    for (let seed = 1; seed < 30; seed++) {
      const p = haveDeck('people', seeded(seed))
      expect(p).toHaveLength(DECK_SIZE)
      expect(p.filter(c => c.alive).length).toBe(14)
      const f = haveDeck('full', seeded(seed))
      expect(f.filter(c => c.alive).length).toBe(10)
      for (const w of TRICKY) expect(f.some(c => c.geo === w), w).toBe(true)
      for (const d of [p, f]) for (let i = 1; i < d.length; i++) expect(d[i].geo).not.toBe(d[i - 1].geo)
      for (const c of [...p, ...f]) expect((c.alive ? ALIVE : THINGS).some(w => w.geo === c.geo)).toBe(true)
    }
  })

  it('speeds up, and full mode is faster than people', () => {
    expect(fallMs('people', 10)).toBeLessThan(fallMs('people', 0))
    expect(fallMs('full', 0)).toBeLessThan(fallMs('people', 0))
    expect(fallMs('full', 19)).toBeGreaterThanOrEqual(2600)
  })

  it('scores with combo, bounces a wrong card back without points, and lets a fallen card go', () => {
    const dog = { geo: 'ძაღლი', ru: 'собака', src: 'x', alive: true }
    const money = { geo: 'ფული', ru: 'деньги', src: 'x', alive: false }
    let s = startState()
    for (let k = 0; k < 3; k++) s = send(s, dog, 'alive').state
    expect(s).toMatchObject({ i: 3, combo: 3, right: 3, score: 10 + 10 + 15 })
    const b = send(s, money, 'alive')
    expect(b.outcome).toBe('bounce')
    expect(b.state).toMatchObject({ i: 3, combo: 0, misses: 1, bounced: true })
    const late = send(b.state, money, 'thing')
    expect(late).toMatchObject({ outcome: 'late-catch', points: 0 })
    expect(late.state.i).toBe(4)
    expect(fell(late.state)).toMatchObject({ i: 5, misses: 2 })
    expect(sentence(dog)).toBe('მე მყავს ძაღლი')
    expect(sentence(money)).toBe('მე მაქვს ფული')
    expect(hintFor(dog)).toContain('живой, значит მყავს')
    expect(isOver(startState(), haveDeck('full', seeded(1)), GAME_MS)).toBe(true)
  })
})

describe('HaveSort scene', () => {
  it.each(['people', 'full'] as const)('%s: plays through all cards to the result and calls onDone', mode => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<HaveSort lesson={introLesson(mode === 'people' ? 27 : 28)} step={{ kind: 'havesort', mode }} fraction={0.5} onExit={() => {}} onDone={onDone} rng={seeded(3)} />)
    fireEvent.click(screen.getByText('Начать'))
    expect(screen.getByTestId('havesort-scene')).toBeTruthy()
    // Первая карточка — промах: отскакивает, видна подсказка.
    const first = screen.getByTestId('have-card')
    fireEvent.click(screen.getByTestId(first.dataset.alive === 'yes' ? 'basket-thing' : 'basket-alive'))
    expect(screen.getByText(/значит/)).toBeTruthy()
    for (let k = 0; k < 40 && screen.queryByTestId('have-card'); k++) {
      const c = screen.getByTestId('have-card')
      fireEvent.click(screen.getByTestId(c.dataset.alive === 'yes' ? 'basket-alive' : 'basket-thing'))
      act(() => { vi.advanceTimersByTime(50) })
    }
    act(() => { vi.advanceTimersByTime(100) })
    expect(screen.getByTestId('game-end')).toBeTruthy()
    expect(screen.getByTestId('rule-card')).toBeTruthy()
    fireEvent.click(screen.getByText('Дальше'))
    expect(onDone).toHaveBeenCalled()
  })

  it('ends by the clock even if nobody taps', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<HaveSort lesson={introLesson(28)} step={{ kind: 'havesort', mode: 'full' }} fraction={0.5} onExit={() => {}} onDone={onDone} rng={seeded(5)} />)
    fireEvent.click(screen.getByText('Начать'))
    act(() => { vi.advanceTimersByTime(GAME_MS + 500) })
    expect(screen.getByTestId('game-end')).toBeTruthy()
    fireEvent.click(screen.getByText('Дальше'))
    expect(onDone).toHaveBeenCalled()
  })
})
