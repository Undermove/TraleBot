import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { seeded } from '../../verbs/testing/catalog'
import { COUNTRIES, NAME_LIST, introLesson, knows } from '../story'
import Border from './Border'
import {
  SHIFT, fieldsOf, firstLine, judge, knownCountries, mismatch, planShift, queueSize, reply, reward, stars, type BorderMode
} from './Border.logic'

const CASES: [number, BorderMode][] = [[9, 'names'], [12, 'names'], [13, 'listen'], [15, 'ask'], [24, 'full']]

describe('border logic', () => {
  it.each(CASES)('lesson %i (%s): ten travellers, about a third lie, the first is honest, liars differ in exactly one field', (lessonId, mode) => {
    for (let seed = 1; seed < 30; seed++) {
      const plan = planShift(lessonId, mode, seeded(seed))
      expect(plan).toHaveLength(SHIFT)
      expect(plan[0].lie).toBeNull()
      const liars = plan.filter(t => t.lie)
      expect(liars.length).toBeGreaterThanOrEqual(3)
      expect(liars.length).toBeLessThanOrEqual(4)
      for (const t of plan) {
        expect(NAME_LIST).toContain(t.name)
        const diff = (['name', 'country', 'job'] as const).filter(f => (f === 'name' ? t.pass.name !== t.name : f === 'country' ? t.pass.country !== t.country : t.pass.job !== t.job))
        expect(diff).toEqual(t.lie ? [t.lie] : [])
        if (t.lie) expect(fieldsOf(mode)).toContain(t.lie)
        // Всё, что надо сверить, можно узнать: человек сказал сам или есть вопрос.
        for (const f of fieldsOf(mode)) {
          if (t.told.includes(f)) continue
          expect(t.asks.some(id => reply(t, id).field === f), `${mode} ${f}`).toBe(true)
        }
        // Только знакомые фразы.
        for (const id of t.asks) expect(knows(lessonId, id), id).toBe(true)
      }
    }
  })

  it('names: first half say their name, second half only greet and must be asked; rogor and nakhvamdis waste time', () => {
    const plan = planShift(9, 'names', seeded(4))
    expect(plan.slice(0, 5).every(t => t.told.includes('name'))).toBe(true)
    expect(plan.slice(5).every(t => t.told.length === 0)).toBe(true)
    expect([...plan[5].asks].sort()).toEqual(['nakhvamdis', 'ra_gkvia', 'rogor'])
    expect(firstLine(plan[5])).toEqual(['გამარჯობა!'])
    expect(reply(plan[5], 'ra_gkvia')).toEqual({ line: `მე მქვია ${plan[5].name}.`, field: 'name', waste: false })
    expect(reply(plan[5], 'rogor')).toMatchObject({ line: 'კარგად, მადლობა.', waste: true })
    expect(reply(plan[5], 'nakhvamdis')).toMatchObject({ line: null, waste: true })
  })

  it('listen: before lesson 14 only Georgia and Spain; everyone says name and country', () => {
    expect(knownCountries(13).map(c => c.flag)).toEqual(['ge', 'es'])
    expect(knownCountries(24)).toHaveLength(COUNTRIES.length)
    const plan = planShift(13, 'listen', seeded(7))
    for (const t of plan) {
      expect(t.country.flag).not.toBe('fr')
      expect(t.asks).toEqual([])
      expect(firstLine(t)).toEqual(['გამარჯობა!', `მე მქვია ${t.name}.`, `მე ვარ ${t.country.from}.`])
    }
  })

  it('ask: nobody tells anything, options are ra_gkvia, saidan and rogor', () => {
    for (const t of planShift(15, 'ask', seeded(2))) {
      expect(t.told).toEqual([])
      expect([...t.asks].sort()).toEqual(['ra_gkvia', 'rogor', 'saidan'])
    }
  })

  it('full: profession can be asked, a job lie reads as «მე ვარ …» against the passport', () => {
    const plan = planShift(24, 'full', seeded(11))
    expect(plan.some(t => t.asks.includes('ra_profesia'))).toBe(true)
    const t = { ...plan[0], lie: 'job' as const, pass: { ...plan[0].pass, job: { geo: 'ექიმი', ru: 'врач', src: 'x' } }, job: { geo: 'სტუდენტი', ru: 'студент', src: 'x' } }
    expect(mismatch(t)).toEqual({ field: 'job', pass: 'ექიმი', said: 'სტუდენტი' })
    expect(reply(t, 'ra_profesia').line).toBe('მე ვარ სტუდენტი.')
  })

  it('judge, coins, stars, queue', () => {
    const [honest] = planShift(9, 'names', seeded(1))
    expect(judge(honest, true)).toBe(true)
    expect(judge(honest, false)).toBe(false)
    expect(judge({ ...honest, lie: 'name' }, false)).toBe(true)
    expect(reward(1, 0.8)).toBe(2)
    expect(reward(3, 0.8)).toBe(3)
    expect(reward(3, 0.2)).toBe(4)
    expect([10, 9, 8, 7, 6, 5, 4].map(stars)).toEqual([3, 3, 2, 2, 1, 1, 0])
    expect(queueSize(8, 0)).toBe(3)
    expect(queueSize(8, 1)).toBe(6)
    expect(queueSize(0, 0)).toBe(0)
    expect(queueSize(0, 0.6)).toBe(2)
  })
})

describe('border scene', () => {
  afterEach(() => vi.useRealTimers())

  it.each(CASES)('lesson %i (%s): plays a whole shift to the end screen and calls onDone', async (lessonId, mode) => {
    vi.useFakeTimers()
    let t = 0
    const step = async (ms: number) => { await act(async () => { for (let i = 0; i < ms / 100; i++) { t += 100; await vi.advanceTimersByTimeAsync(100) } }) }
    const onDone = vi.fn()
    render(<Border lesson={introLesson(lessonId)} step={{ kind: 'border', mode }} fraction={0.5} onExit={() => {}} onDone={onDone} rng={seeded(lessonId)} now={() => t} />)
    expect(screen.getByTestId('border-scene')).toBeTruthy()
    fireEvent.click(screen.getByText('Начать'))
    for (let k = 0; k < SHIFT; k++) {
      // Спрашиваем всё, что можно, и решаем по-честному: штамп, если имя в паспорте то, что сказал человек.
      for (const id of ['ra_gkvia', 'saidan', 'ra_profesia']) {
        const b = screen.queryByTestId(`border-ask-${id}`)
        if (b) fireEvent.click(b)
      }
      if (k === 3) {
        // Один раз не успеваем — человека уводит начальник смены, и подходит следующий.
        const was = screen.getByTestId('border-count').textContent
        for (let w = 0; w < 120 && screen.getByTestId('border-count').textContent === was; w++) await step(500)
        expect(screen.getByTestId('border-count').textContent).not.toBe(was)
        continue
      }
      fireEvent.click(screen.getByTestId(k % 2 ? 'border-stamp' : 'border-check'))
      expect(screen.getByTestId('border-stamp-mark')).toBeTruthy()
      await step(3000)
    }
    expect(screen.getByTestId('game-end')).toBeTruthy()
    expect(screen.getByTestId('rule-card')).toBeTruthy()
    fireEvent.click(screen.getByText('Дальше'))
    expect(onDone).toHaveBeenCalled()
  })

  it('the queue grows while you hesitate', async () => {
    vi.useFakeTimers()
    let t = 0
    const step = async (ms: number) => { await act(async () => { for (let i = 0; i < ms / 100; i++) { t += 100; await vi.advanceTimersByTimeAsync(100) } }) }
    render(<Border lesson={introLesson(13)} step={{ kind: 'border', mode: 'listen' }} fraction={0.5} onExit={() => {}} onDone={() => {}} rng={seeded(1)} now={() => t} />)
    fireEvent.click(screen.getByText('Начать'))
    const before = Number(screen.getByTestId('border-queue').dataset.size)
    await step(8000)
    expect(Number(screen.getByTestId('border-queue').dataset.size)).toBeGreaterThan(before)
  })
})
