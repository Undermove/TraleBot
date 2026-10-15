import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { seeded } from '../../verbs/testing/catalog'
import { introLesson, knows } from '../story'
import Yard from './Yard'
import {
  HINTS_OFF_AFTER, REACT_MS, WALK_MS, expectedFor, judge, newVisitor, panelFor, partAt, yardAnswer, yardStart, yardTick,
  type Visitor, type YardMode, type YardState
} from './Yard.logic'

const LESSON: Record<YardMode, number> = { hello: 1, day: 2, full: 6 }
const vis = (dir: Visitor['dir'], part: Visitor['part'], needs: Visitor['needs'] = ['greet']): Visitor =>
  ({ n: 1, dir, part, needs, look: { coat: '#000', skin: '#fff', hair: '#000' } })

/** Прогнать день: каждый сосед получает верный ответ, как только ждёт. */
function playDay(mode: YardMode, seed: number, answer: (s: YardState) => string | null = s => expectedFor(s.lessonId, s.active!.v, s.active!.v.needs[s.active!.need])) {
  const rng = seeded(seed)
  let s = yardStart(LESSON[mode], mode)
  const seen: Visitor[] = []
  for (let t = 0; t < 120_000 && !s.over; t += 100) {
    s = yardTick(s, t, rng)
    if (s.active && !seen.includes(s.active.v)) seen.push(s.active.v)
    if (s.active?.stage === 'wait') { const id = answer(s); if (id) s = yardAnswer(s, id).s }
  }
  return { s, seen }
}

describe('yard logic', () => {
  it('lesson 1 only has daytime and two buttons; lesson 2 has morning and evening', () => {
    expect([0, 0.2, 0.5, 0.9].map(p => partAt('hello', p))).toEqual(['day', 'day', 'day', 'day'])
    expect([0.1, 0.5, 0.9].map(p => partAt('day', p))).toEqual(['morning', 'day', 'evening'])
    expect(panelFor(1, 'hello', 'greet')).toEqual(['gamarjoba', 'nakhvamdis'])
    expect(panelFor(2, 'day', 'greet')).toEqual(['dila', 'gamarjoba', 'saghamo', 'nakhvamdis'])
  })

  it('every button and every expected answer is a phrase the learner already met', () => {
    for (const mode of ['hello', 'day', 'full'] as YardMode[]) {
      const l = LESSON[mode]
      for (const need of ['greet', 'first', 'ask'] as const) for (const id of panelFor(l, mode, need)) expect(knows(l, id), `${mode} ${id}`).toBe(true)
      const { seen } = playDay(mode, 3)
      for (const v of seen) for (const need of v.needs) {
        const want = expectedFor(l, v, need)
        expect(panelFor(l, mode, need)).toContain(want)
      }
    }
  })

  it('judges by time of day; გამარჯობა always goes but with a hint', () => {
    expect(judge(2, vis('in', 'morning'), 'greet', 'dila').res).toBe('right')
    const soft = judge(2, vis('in', 'evening'), 'greet', 'gamarjoba')
    expect(soft.res).toBe('soft')
    expect(soft.hint).toContain('вечером соседям приятнее')
    expect(judge(2, vis('in', 'evening'), 'greet', 'dila').res).toBe('miss')
    expect(judge(2, vis('out', 'day'), 'greet', 'nakhvamdis').res).toBe('right')
    expect(judge(1, vis('in', 'day'), 'greet', 'nakhvamdis').hint).toContain('прощаешься')
    expect(judge(6, vis('in', 'day', ['first']), 'first', 'gagimarjos').res).toBe('right')
    expect(judge(6, vis('in', 'day', ['first']), 'first', 'gamarjoba').res).toBe('miss')
    expect(judge(6, vis('in', 'day', ['greet', 'ask']), 'ask', 'kargad_shen')).toMatchObject({ res: 'bonus', react: 'kargad_madloba' })
    expect(judge(6, vis('in', 'day', ['greet', 'ask']), 'ask', 'kargad_madloba').res).toBe('right')
  })

  it('full mode brings neighbours who greet first and ask how you are; hello mode never does', () => {
    const r1 = seeded(11), r2 = seeded(12)
    const full = Array.from({ length: 40 }, (_, i) => newVisitor({ lessonId: 6, mode: 'full', dayMs: 54_000, seq: i }, 20_000, r1))
    expect(full.some(v => v.needs[0] === 'first')).toBe(true)
    expect(full.some(v => v.needs.includes('ask'))).toBe(true)
    const hello = Array.from({ length: 40 }, (_, i) => newVisitor({ lessonId: 1, mode: 'hello', dayMs: 40_000, seq: i }, 20_000, r2))
    expect(hello.every(v => v.needs.length === 1 && v.needs[0] === 'greet' && v.part === 'day')).toBe(true)
  })

  it('a perfect day: smiles grow with combo, the yard loves you, hints go away after six', () => {
    for (const mode of ['hello', 'day', 'full'] as YardMode[]) {
      const { s, seen } = playDay(mode, 7)
      expect(s.over).toBe(true)
      expect(seen.length).toBeGreaterThanOrEqual(6)
      expect(s.misses + s.timeouts).toBe(0)
      expect(s.smiles).toBeGreaterThan(s.correct)
      expect(s.mood).toBeGreaterThanOrEqual(0.75)
      expect(s.hints).toBe(s.correct < HINTS_OFF_AFTER)
    }
  })

  it('an idle day still ends: neighbours run out of patience and leave sad', () => {
    const { s } = playDay('day', 5, () => null)
    expect(s.over).toBe(true)
    expect(s.timeouts).toBeGreaterThan(3)
    expect(s.smiles).toBe(0)
    expect(s.mood).toBeLessThan(0.45)
  })

  it('a miss keeps the neighbour waiting and after two misses names the answer', () => {
    let s = yardStart(1, 'hello')
    s = yardTick(s, 600, () => 0.9) // сосед пришёл с улицы
    expect(s.active?.v.dir).toBe('in')
    s = yardTick(s, 600 + WALK_MS, () => 0.9)
    expect(s.active?.stage).toBe('wait')
    s = yardAnswer(s, 'nakhvamdis').s
    s = yardAnswer(s, 'nakhvamdis').s
    expect(s.active?.stage).toBe('wait')
    expect(s.tip).toContain('გამარჯობა')
    s = yardAnswer(s, 'gamarjoba').s
    expect(s.active?.stage).toBe('react')
    s = yardTick(s, 600 + WALK_MS + REACT_MS + 10, () => 0.9)
    expect(s.active?.stage).toBe('gone')
  })
})

describe('Yard', () => {
  afterEach(() => vi.useRealTimers())

  it.each(['hello', 'day', 'full'] as YardMode[])('%s: intro → a day in the yard → end with smiles and a rule → onDone', async mode => {
    vi.useFakeTimers()
    let t = 0
    const onDone = vi.fn()
    const lesson = introLesson(LESSON[mode])
    render(<Yard lesson={lesson} step={{ kind: 'yard', mode }} fraction={0.5} onExit={() => {}} onDone={onDone} rng={seeded(4)} now={() => t} />)
    expect(screen.getByTestId('yard-scene')).toBeTruthy()
    fireEvent.click(screen.getByText('Начать'))
    const step = async (ms: number) => { await act(async () => { for (let i = 0; i < ms / 100; i++) { t += 100; await vi.advanceTimersByTimeAsync(100) } }) }
    let answered = 0
    for (let k = 0; k < 700 && !screen.queryByTestId('game-end'); k++) {
      await step(100)
      const nb = screen.queryByTestId('yard-patience') && screen.queryByTestId('yard-neighbour')
      if (nb) {
        const part = nb.getAttribute('data-part')!, dir = nb.getAttribute('data-dir')!
        const line = nb.textContent ?? ''
        const id = line.includes('როგორ') ? 'kargad_shen' : line.includes('გამარჯობა') ? 'gagimarjos'
          : dir === 'out' ? 'nakhvamdis' : mode === 'hello' ? 'gamarjoba' : part === 'morning' ? 'dila' : part === 'evening' ? 'saghamo' : 'gamarjoba'
        await act(async () => { fireEvent.click(screen.getByTestId(`reply-${id}`)) })
        answered++
      }
    }
    expect(answered).toBeGreaterThan(4)
    expect(screen.getByTestId('game-end').textContent).toMatch(/улыб/)
    expect(screen.getByTestId('rule-card')).toBeTruthy()
    fireEvent.click(screen.getByText('Дальше'))
    expect(onDone).toHaveBeenCalled()
  })
})
