import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { seeded } from '../../verbs/testing/catalog'
import { introLesson, knows } from '../story'
import { setMuted } from '../../alphabet/games/fx'
import Walk from './Walk'
import { MEETINGS, judge, partAt, replies, route, routeLength, type WalkMode } from './Walk.logic'

const LESSON: Record<WalkMode, number> = { hello: 1, day: 2, full: 6 }

describe('walk logic', () => {
  it('lesson 1 is all day long with two buttons; lesson 2 goes from morning to evening', () => {
    const len = routeLength('day')
    expect([0, len / 2, len].map(m => partAt('hello', m))).toEqual(['day', 'day', 'day'])
    expect([0.1, 0.5, 0.9].map(k => partAt('day', k * len))).toEqual(['morning', 'day', 'evening'])
    expect(replies(1, 'hello')).toEqual(['gamarjoba', 'nakhvamdis'])
    expect(replies(2, 'day')).toEqual(['dila', 'gamarjoba', 'saghamo', 'nakhvamdis'])
    const day = route(2, 'day', seeded(3))
    expect(new Set(day.map(m => m.part))).toEqual(new Set(['morning', 'day', 'evening']))
  })

  it('every meeting says hello first and goodbye last, with phrases the learner already met', () => {
    for (const mode of ['hello', 'day', 'full'] as WalkMode[]) {
      const l = LESSON[mode]
      const r = route(l, mode, seeded(5))
      expect(r).toHaveLength(MEETINGS[mode])
      for (const m of r) {
        expect(m.beats[m.beats.length - 1].want).toBe('nakhvamdis')
        for (const b of m.beats) for (const id of [b.want, b.line, b.react, b.bonus].filter(Boolean) as string[]) expect(knows(l, id), `${mode} ${id}`).toBe(true)
      }
    }
  })

  it('judges the greeting by time of day; გამარჯობა always goes, but with a hint', () => {
    const [morning] = route(2, 'day', seeded(1))
    const hello = morning.beats[0]
    expect(judge(2, morning, hello, 'dila').res).toBe('right')
    expect(judge(2, morning, hello, 'gamarjoba').res).toBe('soft')
    expect(judge(2, morning, hello, 'saghamo').res).toBe('miss')
    expect(judge(2, morning, hello, 'nakhvamdis').hint).toMatch(/прощаешься/)
    const bye = morning.beats[morning.beats.length - 1]
    expect(judge(2, morning, bye, 'gamarjoba').hint).toMatch(/прощаетесь/)
  })
})

describe('Walk', () => {
  // Без звука реплика держится столько, сколько её читать: в jsdom записи не играют.
  beforeEach(() => setMuted(true))
  afterEach(() => { vi.useRealTimers(); setMuted(false) })

  it.each(['hello', 'day', 'full'] as WalkMode[])('%s: hold to walk, talk to everyone on the way, arrive → rule → onDone', async mode => {
    vi.useFakeTimers()
    let t = 0
    const onDone = vi.fn()
    render(<Walk lesson={introLesson(LESSON[mode])} step={{ kind: 'walk', mode }} fraction={0.5} onExit={() => {}} onDone={onDone} rng={seeded(4)} now={() => t} />)
    fireEvent.click(screen.getByText('Начать'))
    const step = async (ms: number) => { await act(async () => { for (let i = 0; i < ms / 50; i++) { t += 50; await vi.advanceTimersByTimeAsync(50) } }) }
    const street = screen.getByTestId('walk-street')
    expect(screen.getByTestId('walk-hold-hint')).toBeTruthy()
    let answered = 0
    for (let k = 0; k < 2000 && !screen.queryByTestId('game-end'); k++) {
      const want = screen.getByTestId('walk-replies').getAttribute('data-want')
      if (want) {
        fireEvent.pointerUp(street)
        await act(async () => { fireEvent.click(screen.getByTestId(`walk-reply-${want}`)) })
        answered++
      } else fireEvent.pointerDown(street)
      await step(100)
    }
    expect(answered).toBeGreaterThanOrEqual(MEETINGS[mode] * 2)
    expect(screen.getByTestId('game-end').textContent).toMatch(/у моря/)
    expect(screen.getByTestId('rule-card')).toBeTruthy()
    fireEvent.click(screen.getByText('Дальше'))
    expect(onDone).toHaveBeenCalled()
  }, 60_000)

  it('a wrong answer is not counted: the same turn waits, with a hint why', async () => {
    vi.useFakeTimers()
    let t = 0
    render(<Walk lesson={introLesson(1)} step={{ kind: 'walk', mode: 'hello' }} fraction={0.5} onExit={() => {}} onDone={() => {}} rng={seeded(4)} now={() => t} />)
    fireEvent.click(screen.getByText('Начать'))
    const street = screen.getByTestId('walk-street')
    fireEvent.pointerDown(street)
    for (let k = 0; k < 300 && !screen.getByTestId('walk-replies').getAttribute('data-want'); k++) {
      await act(async () => { t += 50; await vi.advanceTimersByTimeAsync(50) })
    }
    expect(screen.getByTestId('walk-replies').getAttribute('data-want')).toBe('gamarjoba')
    await act(async () => { fireEvent.click(screen.getByTestId('walk-reply-nakhvamdis')) })
    for (let k = 0; k < 60; k++) await act(async () => { t += 50; await vi.advanceTimersByTimeAsync(50) })
    expect(screen.getByTestId('walk-cue').textContent).toMatch(/прощаешься/)
    expect(screen.getByTestId('walk-replies').getAttribute('data-want')).toBe('gamarjoba')
  })
})
