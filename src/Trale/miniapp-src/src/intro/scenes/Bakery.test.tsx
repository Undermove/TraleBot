import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { seeded } from '../../verbs/testing/catalog'
import { setMuted } from '../../alphabet/games/fx'
import { introLesson, met } from '../story'
import Bakery from './Bakery'
import { judge, plan, replies } from './Bakery.logic'

describe('bakery logic', () => {
  it('three visits: greet by time of day, talk about how you are (sometimes you ask), say goodbye', () => {
    const v = plan(3, seeded(2))
    expect(v.map(x => x.part)).toEqual(['morning', 'day', 'evening'])
    for (const visit of v) {
      expect(visit.steps[visit.steps.length - 1].want).toBe('nakhvamdis')
      expect(visit.steps.some(s => s.bread)).toBe(true)
      for (const s of visit.steps) for (const id of [s.want, s.line, s.react].filter(Boolean) as string[]) expect(met(3, id)).toBe(true)
    }
    expect(v.some(x => x.steps.some(s => s.want === 'rogor'))).toBe(true)
    for (const id of replies(3)) expect(met(3, id)).toBe(true)
  })

  it('каждый визит — заказ с витрины и «пожалуйста»: в первые два дня хлеб и хачапури', () => {
    const v = plan(3, seeded(5))
    expect(v.map(x => x.item).slice(0, 2)).toEqual(['puri', 'khachapuri'])
    for (const visit of v) {
      const i = visit.steps.findIndex(s => s.order)
      expect(visit.steps[i].want).toBe(visit.item)
      expect(visit.steps[i + 1]).toMatchObject({ want: 'gtkhovt', bread: true })
      expect(judge(3, visit, visit.steps[i], visit.item === 'puri' ? 'khachapuri' : 'puri').hint).toMatch(/нужен/)
    }
  })

  it('a wrong line says why', () => {
    const [mon] = plan(3, seeded(1))
    expect(judge(3, mon, mon.steps[0], 'gamarjoba').res).toBe('soft')
    expect(judge(3, mon, mon.steps[0], 'saghamo').hint).toMatch(/утро/)
    expect(judge(3, mon, mon.steps[1], 'rogor').hint).toMatch(/уже спросили/)
  })
})

describe('Bakery', () => {
  beforeEach(() => setMuted(true))
  afterEach(() => { vi.useRealTimers(); setMuted(false) })

  it('three visits for bread → rule → onDone', async () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<Bakery lesson={introLesson(3)} step={{ kind: 'bakery', mode: 'howareyou' }} fraction={0.5} onExit={() => {}} onDone={onDone} rng={seeded(3)} />)
    fireEvent.click(screen.getByText('Начать'))
    let breads = 0
    for (let k = 0; k < 1500 && !screen.queryByTestId('game-end'); k++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(100) })
      const want = screen.queryByTestId('bakery-replies')?.getAttribute('data-want')
      const bread = (screen.queryAllByTestId('bakery-bread') as HTMLButtonElement[]).find(b => !b.disabled) ?? null
      if (bread && screen.getByTestId('bakery-cue').textContent!.includes('Забери')) { await act(async () => { fireEvent.click(bread) }); breads++; await act(async () => { await vi.advanceTimersByTimeAsync(800) }) }
      else if (want) await act(async () => { fireEvent.click(screen.getByTestId(`bakery-reply-${want}`)) })
    }
    expect(breads).toBe(3)
    expect(screen.getByTestId('rule-card')).toBeTruthy()
    fireEvent.click(screen.getByText('Дальше'))
    expect(onDone).toHaveBeenCalled()
  }, 60_000)
})
