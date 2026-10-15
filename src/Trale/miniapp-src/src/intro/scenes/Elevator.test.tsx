import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { seeded } from '../../verbs/testing/catalog'
import { introLesson, knows } from '../story'
import Elevator from './Elevator'
import {
  BOARD_MS, FAST_TICK_MS, MY_FLOOR, RIDES, bestAnswer, currentEx, elevAnswer, elevStart, elevTick, floorAt, judgeEx, planRides,
  type ElevMode, type ElevState, type Ex
} from './Elevator.logic'

const LESSON: Record<ElevMode, number> = { howareyou: 3, echo: 4, polite: 5, mix: 6 }
const MODES = Object.keys(LESSON) as ElevMode[]

function play(mode: ElevMode, seed: number, choose: (s: ElevState, ex: Ex) => string | null) {
  const l = LESSON[mode]
  let s = elevStart(l, mode, planRides(l, mode, seeded(seed)))
  for (let t = 0; t < 400_000 && !s.over; t += 100) {
    s = elevTick(s, t)
    const ex = currentEx(s)
    if (ex) { const id = choose(s, ex); if (id) s = elevAnswer(s, id).s }
  }
  return s
}

describe('elevator logic', () => {
  it.each(MODES)('%s: 7 rides on different floors, 1–3 exchanges, only phrases already met', mode => {
    const l = LESSON[mode]
    for (let seed = 1; seed < 20; seed++) {
      const rides = planRides(l, mode, seeded(seed))
      expect(rides).toHaveLength(RIDES)
      expect(new Set(rides.map(r => r.floor)).size).toBe(RIDES)
      for (const r of rides) {
        expect(r.floor).toBeGreaterThan(2)
        expect(r.floor).toBeLessThan(MY_FLOOR)
        expect(r.ex.length).toBeGreaterThanOrEqual(1)
        expect(r.ex.length).toBeLessThanOrEqual(3)
        expect(r.tickMs).toBeGreaterThanOrEqual(800)
        for (const e of r.ex) {
          expect(e.options.length).toBeGreaterThanOrEqual(2)
          for (const id of [...e.options, ...(e.line ? [e.line] : [])]) expect(knows(l, id), `${mode} ${id}`).toBe(true)
          expect(e.options).toContain(bestAnswer(l, e))
          expect(judgeEx(l, mode, e, bestAnswer(l, e)).res).not.toBe('miss')
        }
      }
    }
  })

  it('modes: L3 greet + how are you; L4 asking back is the bonus; L5 polite situations with the button panel', () => {
    const hw = planRides(3, 'howareyou', seeded(1))
    expect(hw.every(r => r.ex.map(e => e.kind).join() === 'greet,rogor')).toBe(true)
    const rogor: Ex = { kind: 'rogor', line: 'rogor', options: [] }
    expect(judgeEx(3, 'howareyou', rogor, 'kargad_madloba').res).toBe('right')
    expect(judgeEx(4, 'echo', rogor, 'kargad_madloba')).toMatchObject({ res: 'soft', hint: expect.stringContaining('Сосед ждёт, что ты спросишь в ответ') })
    expect(judgeEx(4, 'echo', rogor, 'kargad_shen')).toMatchObject({ res: 'bonus', react: 'kargad_madloba' })
    const polite = planRides(5, 'polite', seeded(2)).flatMap(r => r.ex.map(e => e.kind))
    for (const k of ['door', 'foot', 'button']) expect(polite).toContain(k)
    expect(judgeEx(5, 'polite', { kind: 'button', pressed: true, options: [] }, 'ara').res).toBe('right')
    expect(judgeEx(5, 'polite', { kind: 'button', pressed: false, options: [] }, 'ki').res).toBe('right')
    expect(judgeEx(5, 'polite', { kind: 'foot', options: [] }, 'madloba').res).toBe('miss')
    expect(judgeEx(6, 'mix', { kind: 'greet', line: 'gamarjoba', options: [] }, 'gagimarjos').res).toBe('right')
    expect(judgeEx(6, 'mix', { kind: 'greet', line: 'gamarjoba', options: [] }, 'gamarjoba').res).toBe('soft')
    expect(judgeEx(3, 'howareyou', { kind: 'greet', line: 'gamarjoba', options: [] }, 'gamarjoba').res).toBe('right')
  })

  it('the floor ticks per tickMs and races once everything is said, never past the neighbour floor', () => {
    const r = { floor: 9, tickMs: 1000, ex: [], look: { coat: '', skin: '', hair: '' }, crowd: false }
    expect(floorAt(r, 0)).toBe(1)
    expect(floorAt(r, 2500)).toBe(3)
    expect(floorAt(r, 2500, 2000)).toBe(Math.floor(3 + 500 / FAST_TICK_MS))
    expect(floorAt(r, 60_000)).toBe(9)
  })

  it.each(MODES)('%s: answering everything fast — every floor remembers you', mode => {
    const s = play(mode, 3, (st, ex) => bestAnswer(st.lessonId, ex))
    expect(s.over).toBe(true)
    expect(s.remembered).toHaveLength(RIDES)
    expect(s.likes).toBe(s.max)
  })

  it('doing nothing still ends the game: doors open, nobody remembers', () => {
    const s = play('mix', 5, () => null)
    expect(s.over).toBe(true)
    expect(s.remembered).toEqual([])
    expect(s.likes).toBe(0)
  })

  it('a miss leaves the exchange open; two misses name the answer', () => {
    let s = elevStart(3, 'howareyou', planRides(3, 'howareyou', seeded(1)))
    s = elevTick(s, BOARD_MS)
    s = elevAnswer(s, 'nakhvamdis').s
    expect(s.exI).toBe(0)
    s = elevAnswer(s, 'nakhvamdis').s
    expect(s.tip).toMatch(/Нажми/)
    s = elevAnswer(s, bestAnswer(3, currentEx(s)!)).s
    expect(s.exI).toBe(1)
  })
})

describe('Elevator', () => {
  afterEach(() => vi.useRealTimers())

  it.each(MODES)('%s: intro → rides → building view → onDone', async mode => {
    vi.useFakeTimers()
    let t = 0
    const onDone = vi.fn()
    const l = LESSON[mode]
    const rides = planRides(l, mode, seeded(9))
    render(<Elevator lesson={introLesson(l)} step={{ kind: 'elevator', mode }} fraction={0.5} onExit={() => {}} onDone={onDone} rng={seeded(9)} now={() => t} />)
    expect(screen.getByTestId('elevator-scene')).toBeTruthy()
    fireEvent.click(screen.getByText('Начать'))
    const step = async (ms: number) => { await act(async () => { for (let i = 0; i < ms / 100; i++) { t += 100; await vi.advanceTimersByTimeAsync(100) } }) }
    // Первую поездку отвечаем верно (по плану того же зерна), остальные — пусть двери открываются сами.
    for (const e of rides[0].ex) {
      for (let k = 0; k < 30 && screen.getByTestId(`reply-${bestAnswer(l, e)}`).className.includes('opacity-40'); k++) await step(100)
      await act(async () => { fireEvent.click(screen.getByTestId(`reply-${bestAnswer(l, e)}`)) })
    }
    for (let k = 0; k < 400 && !screen.queryByTestId('game-end'); k++) await step(500)
    expect(screen.getByTestId('game-end').textContent).toMatch(/1 сосед запомнил тебя/)
    expect(screen.getAllByTestId('tower-warm')).toHaveLength(1)
    expect(screen.getByTestId('rule-card')).toBeTruthy()
    fireEvent.click(screen.getByText('Дальше'))
    expect(onDone).toHaveBeenCalled()
  })
})
