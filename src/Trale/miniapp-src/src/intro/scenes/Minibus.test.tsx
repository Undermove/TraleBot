import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { setMuted } from '../../alphabet/games/fx'
import { introLesson, knows } from '../story'
import Minibus from './Minibus'
import { MY_STOP, judge, replies, ride } from './Minibus.logic'

describe('minibus logic', () => {
  it('thanks for help, sorry for bumping, yes only at your stop, goodbye at the end', () => {
    const r = ride()
    for (const e of r) {
      if (e.kind === 'change' || e.kind === 'glove') expect(e.want).toBe('madloba')
      if (e.kind === 'lurch' || e.kind === 'brake') expect(e.want).toBe('bodishi')
      if (e.kind === 'stop') expect(e.want).toBe(e.stop === MY_STOP ? 'ki' : 'ara')
    }
    expect(r[r.length - 1].want).toBe('nakhvamdis')
    const lurch = r.find(e => e.kind === 'lurch')!
    expect(judge(lurch, 'madloba').hint).toMatch(/не благодарят/)
    for (const id of replies(5)) expect(knows(5, id)).toBe(true)
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
    let answered = 0
    for (let k = 0; k < 2000 && !screen.queryByTestId('game-end'); k++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(100) })
      const want = screen.queryByTestId('minibus-replies')?.getAttribute('data-want')
      if (want) { await act(async () => { fireEvent.click(screen.getByTestId(`minibus-reply-${want}`)) }); answered++ }
    }
    expect(answered).toBe(ride().length)
    expect(screen.getByTestId('rule-card')).toBeTruthy()
    fireEvent.click(screen.getByText('Дальше'))
    expect(onDone).toHaveBeenCalled()
  }, 60_000)
})
