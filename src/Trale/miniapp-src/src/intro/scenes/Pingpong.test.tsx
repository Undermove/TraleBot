import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { setMuted } from '../../alphabet/games/fx'
import { introLesson, knows } from '../story'
import Pingpong from './Pingpong'
import { POINTS, judge, match, replies } from './Pingpong.logic'

describe('pingpong logic', () => {
  it('serves alternate; returning the question keeps the rally, answering and going quiet is a net', () => {
    const m = match()
    expect(m).toHaveLength(POINTS)
    expect(m.map(r => r.serve)).toEqual(['friend', 'you', 'friend', 'you', 'friend'])
    const ask = m[0].shots[1]
    expect(judge(ask, 'kargad_shen').res).toBe('hit')
    expect(judge(ask, 'kargad_madloba').res).toBe('net')
    // Тебя спросили «а ты?» — возвращать вопрос второй раз уже незачем.
    const asked = m[1].shots[2]
    expect(judge(asked, 'kargad_madloba').res).toBe('hit')
    expect(judge(asked, 'kargad_shen').res).toBe('net')
    for (const r of m) for (const s of r.shots) for (const id of [s.want, s.line, s.react].filter(Boolean) as string[]) expect(knows(4, id)).toBe(true)
    for (const id of replies(4)) expect(knows(4, id)).toBe(true)
  })
})

describe('Pingpong', () => {
  beforeEach(() => setMuted(true))
  afterEach(() => { vi.useRealTimers(); setMuted(false) })

  it('five rallies → the match → rule → onDone', async () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<Pingpong lesson={introLesson(4)} step={{ kind: 'pingpong', mode: 'echo' }} fraction={0.5} onExit={() => {}} onDone={onDone} />)
    fireEvent.click(screen.getByText('Начать'))
    for (let k = 0; k < 2000 && !screen.queryByTestId('game-end'); k++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(100) })
      const want = screen.queryByTestId('pingpong-replies')?.getAttribute('data-want')
      if (want) await act(async () => { fireEvent.click(screen.getByTestId(`pingpong-reply-${want}`)) })
    }
    expect(screen.getByTestId('game-end').textContent).toMatch(/5 : 0/)
    fireEvent.click(screen.getByText('Дальше'))
    expect(onDone).toHaveBeenCalled()
  }, 60_000)
})
