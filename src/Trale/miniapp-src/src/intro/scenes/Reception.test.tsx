import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { seeded } from '../../verbs/testing/catalog'
import { setMuted } from '../../alphabet/games/fx'
import { introLesson, knows } from '../story'
import Reception from './Reception'
import { GUESTS, askField, fieldsOf, judge, planShift, type ReceptionMode } from './Reception.logic'

const LESSON: Record<ReceptionMode, number> = { names: 9, listen: 13, ask: 15, full: 24 }

describe('reception logic', () => {
  it.each(Object.keys(LESSON) as ReceptionMode[])('%s: every guest has a booking and look-alikes that differ in exactly one field', mode => {
    for (const seed of [1, 2, 3]) {
      const shift = planShift(LESSON[mode], mode, seeded(seed))
      expect(shift).toHaveLength(GUESTS)
      const rooms = shift.flatMap(g => g.desk.map(d => d.room))
      expect(new Set(rooms).size).toBe(rooms.length)
      for (const g of shift) {
        expect(g.desk).toContain(g.booking)
        for (const d of g.desk.filter(d => d !== g.booking)) {
          const diff = (['name', 'country', 'job'] as const).filter(f => d[f] !== g.booking[f])
          expect(diff).toHaveLength(1)
          expect(fieldsOf(mode)).toContain(diff[0])
        }
        // Чего гость не сказал — то можно спросить, и вопрос уже знаком.
        for (const f of fieldsOf(mode).filter(f => !g.told.includes(f))) expect(g.asks.some(id => askField(id) === f)).toBe(true)
        for (const id of g.asks) expect(knows(LESSON[mode], id)).toBe(true)
      }
    }
  })

  it('a wrong card is never a refusal: it says what differs, or what to find out first', () => {
    const [g] = planShift(13, 'listen', seeded(4))
    const other = g.desk.find(d => d !== g.booking && d.country !== g.booking.country)!
    expect(judge(g, g.booking, ['name']).ok).toBe(true)
    const v = judge(g, other, ['name', 'country'])
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.hint).toMatch(/гость сказал/)
    const early = judge(g, other, ['name'])
    if (!early.ok) expect(early.hint).toMatch(/Узнай, откуда/)
  })
})

describe('Reception', () => {
  beforeEach(() => setMuted(true))
  afterEach(() => { vi.useRealTimers(); setMuted(false) })

  it.each(Object.keys(LESSON) as ReceptionMode[])('%s: guests introduce themselves, you ask what is missing and hand the key → reviews → onDone', async mode => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<Reception lesson={introLesson(LESSON[mode])} step={{ kind: 'reception', mode }} fraction={0.5} onExit={() => {}} onDone={onDone} rng={seeded(2)} />)
    fireEvent.click(screen.getByText('Начать'))
    const step = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }
    let keys = 0
    for (let k = 0; k < 2000 && !screen.queryByTestId('game-end'); k++) {
      await step(100)
      const desk = screen.queryByTestId('reception-desk')
      if (!desk) continue
      const ask = screen.queryAllByTestId(/^ask-/).find(b => !(b as HTMLButtonElement).disabled && !b.dataset.testid!.endsWith('rogor'))
      if (ask) { await act(async () => { fireEvent.click(ask) }); continue }
      const card = screen.getByTestId(`booking-${desk.getAttribute('data-want')}`) as HTMLButtonElement
      if (!card.disabled && !screen.queryByTestId('reception-asks')) { await act(async () => { fireEvent.click(card) }); keys++; await step(3000) }
    }
    expect(keys).toBe(GUESTS)
    expect(screen.getByTestId('game-end').textContent).toMatch(/5\.0 из 5/)
    fireEvent.click(screen.getByText('Дальше'))
    expect(onDone).toHaveBeenCalled()
  }, 60_000)
})
