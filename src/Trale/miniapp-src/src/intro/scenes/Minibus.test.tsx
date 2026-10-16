import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { setMuted } from '../../alphabet/games/fx'
import { introLesson, met } from '../story'
import Minibus from './Minibus'
import { MY_STOP, heardBy, judge, replies, ride } from './Minibus.logic'

describe('minibus logic', () => {
  it('thanks for help, sorry for bumping, yes only at your stop, goodbye at the end', () => {
    const r = ride()
    for (const e of r) {
      if (e.kind === 'change' || e.kind === 'glove') expect(e.want).toBe('madloba')
      if (e.kind === 'lurch' || e.kind === 'brake') expect(e.want).toBe('bodishi')
      if (e.kind === 'stop') expect(e.want).toBe(e.stop === MY_STOP ? 'ki' : 'ara')
    }
    // У своей остановки сначала кричишь «остановите!» — и только потом «да».
    const call = r.findIndex(e => e.kind === 'call')
    expect(r[call]).toMatchObject({ want: 'gamicheret', stop: MY_STOP })
    expect(r[call + 1]).toMatchObject({ want: 'ki', stop: MY_STOP })
    // «გამიჩერეთ!» сначала слышишь от другого пассажира — кнопка появляется после этого.
    const heardAt = r.findIndex(e => e.lines?.some(l => l.id === 'gamicheret'))
    expect(heardAt).toBeGreaterThan(-1)
    expect(heardAt).toBeLessThan(call)
    expect(replies(5, heardBy(r, heardAt - 1))).not.toContain('gamicheret')
    r.forEach((e, i) => expect(replies(5, heardBy(r, i)), `${i}`).toContain(e.want))
    expect(r[r.length - 1].want).toBe('nakhvamdis')
    const lurch = r.find(e => e.kind === 'lurch')!
    expect(judge(lurch, 'madloba').hint).toMatch(/не благодарят/)
    for (const e of r) for (const id of [e.want, e.react, ...(e.lines ?? []).map(l => l.id)].filter(Boolean) as string[]) expect(met(5, id), id).toBe(true)
  })
})

describe('Minibus', () => {
  beforeEach(() => setMuted(true))
  afterEach(() => { vi.useRealTimers(); setMuted(false) })

  it('the ride to the university → rule → onDone', async () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<Minibus lesson={introLesson(5)} step={{ kind: 'minibus', mode: 'polite' }} fraction={0.5} onExit={() => {}} onDone={onDone} />)
    fireEvent.click(screen.getByText('Начать'))
    let answered = 0, sawWord = false
    for (let k = 0; k < 2000 && !screen.queryByTestId('game-end'); k++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(100) })
      if (screen.queryAllByTestId('minibus-new-word').length) sawWord = true
      const want = screen.queryByTestId('minibus-replies')?.getAttribute('data-want')
      if (want) { await act(async () => { fireEvent.click(screen.getByTestId(`minibus-reply-${want}`)) }); answered++ }
    }
    expect(answered).toBe(ride().length)
    expect(sawWord).toBe(true)
    expect(screen.getByTestId('rule-card')).toBeTruthy()
    fireEvent.click(screen.getByText('Дальше'))
    expect(onDone).toHaveBeenCalled()
  }, 60_000)
})
