import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { setMuted } from '../../alphabet/games/fx'
import { introLesson, met } from '../story'
import Pingpong from './Pingpong'
import { POINTS, heardBy, judge, match, replies } from './Pingpong.logic'

describe('pingpong logic', () => {
  const m = match()
  it('пять розыгрышей, и ни один не повторяет другой', () => {
    expect(m).toHaveLength(POINTS)
    const seq = m.map(r => r.shots.map(s => [s.line, s.want, s.react].join('/')).join('|'))
    expect(new Set(seq).size).toBe(POINTS)
    // Подача и собеседники меняются.
    expect(new Set(m.map(r => r.serve)).size).toBe(2)
    expect(m.filter(r => r.guest).length).toBeGreaterThanOrEqual(2)
    // Прощаются один раз — в конце партии.
    expect(m.flatMap(r => r.shots).filter(s => s.want === 'nakhvamdis')).toHaveLength(1)
    expect(m[POINTS - 1].shots[m[POINTS - 1].shots.length - 1].want).toBe('nakhvamdis')
  })
  it('вернул вопрос — розыгрыш живёт, ответил и замолчал — сетка; на «а ты?» просто отвечаешь', () => {
    const ask = m[0].shots[1]
    expect(judge(ask, 'kargad_shen').res).toBe('hit')
    expect(judge(ask, 'kargad_madloba').res).toBe('net')
    const asked = m[1].shots[2]
    expect(judge(asked, 'kargad_madloba').res).toBe('hit')
    expect(judge(asked, 'dzalian_kargad').res).toBe('hit')
    expect(judge(asked, 'kargad_shen').res).toBe('net')
    expect(judge(m[3].shots[2], 'mets_kargad').res).toBe('hit')
  })
  it('слова сцены звучат в игре, а кнопка появляется только после того, как слово прозвучало', () => {
    const all = m.flatMap(r => r.shots).flatMap(s => [s.line, s.want, s.react, ...(s.ok ?? [])]).filter(Boolean) as string[]
    for (const id of ['dzalian_kargad', 'mets_kargad', 'kidev']) expect(all).toContain(id)
    for (const id of all) expect(met(4, id), id).toBe(true)
    expect(replies(4)).not.toContain('kidev')
    m.forEach((r, ri) => r.shots.forEach((s, si) => {
      const panel = replies(4, heardBy(m, ri, si))
      expect(panel, `${ri}.${si}`).toContain(s.want)
    }))
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
    let sawGuest = false, sawWord = false
    for (let k = 0; k < 3000 && !screen.queryByTestId('game-end'); k++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(100) })
      if (screen.queryByTestId('pingpong-guest')) sawGuest = true
      if (screen.queryAllByTestId('pingpong-new-word').length) {
        sawWord = true
        // Пока карточка нового слова открыта, отвечать нельзя: игра ждёт «Понятно».
        expect(screen.queryByTestId('pingpong-replies')?.getAttribute('data-want')).toBeFalsy()
        await act(async () => { fireEvent.click(screen.getByTestId('pingpong-word-ok')) })
        continue
      }
      const want = screen.queryByTestId('pingpong-replies')?.getAttribute('data-want')
      if (want) await act(async () => { fireEvent.click(screen.getByTestId(`pingpong-reply-${want}`)) })
    }
    expect(sawGuest).toBe(true)
    expect(sawWord).toBe(true)
    expect(screen.getByTestId('game-end').textContent).toMatch(/5 : 0/)
    fireEvent.click(screen.getByText('Дальше'))
    expect(onDone).toHaveBeenCalled()
  }, 60_000)
})
