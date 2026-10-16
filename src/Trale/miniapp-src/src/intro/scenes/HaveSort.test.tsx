import React from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import HaveSort from './HaveSort'
import { DECK_SIZE, TRICKY, haveDeck, hintFor, isOver, send, sentence, sentenceAudio, startState } from './HaveSort.logic'
import { ALIVE, THINGS, introLesson } from '../story'
import { seeded } from '../../verbs/testing/catalog'
import { setMuted } from '../../alphabet/games/fx'

beforeEach(() => setMuted(true))
afterEach(() => { vi.useRealTimers(); setMuted(false) })

describe('HaveSort logic', () => {
  it('builds a 12-card deck: people mode mostly alive, full mode balanced with the tricky words, no repeats', () => {
    for (let seed = 1; seed < 30; seed++) {
      const p = haveDeck('people', seeded(seed))
      expect(p).toHaveLength(DECK_SIZE)
      expect(p.filter(c => c.alive).length).toBe(8)
      const f = haveDeck('full', seeded(seed))
      expect(f.filter(c => c.alive).length).toBe(6)
      for (const w of TRICKY) expect(f.some(c => c.geo === w), w).toBe(true)
      for (const d of [p, f]) {
        expect(new Set(d.map(c => c.geo)).size).toBe(d.length)
        for (const c of d) expect((c.alive ? ALIVE : THINGS).some(w => w.geo === c.geo)).toBe(true)
      }
    }
  })

  it('scores with combo, bounces a wrong card back without points; the sentence is voiced by the hero', () => {
    const dog = { geo: 'ძაღლი', ru: 'собака', src: 'x', alive: true }
    const money = { geo: 'ფული', ru: 'деньги', src: 'x', alive: false }
    let s = startState()
    for (let k = 0; k < 3; k++) s = send(s, dog, 'alive').state
    expect(s).toMatchObject({ i: 3, combo: 3, right: 3, score: 10 + 10 + 15 })
    const b = send(s, money, 'alive')
    expect(b.outcome).toBe('bounce')
    expect(b.state).toMatchObject({ i: 3, combo: 0, misses: 1, bounced: true })
    expect(send(b.state, money, 'thing')).toMatchObject({ outcome: 'late-catch', points: 0 })
    expect(sentence(dog)).toBe('მე მყავს ძაღლი')
    expect(sentence(money)).toBe('მე მაქვს ფული')
    expect(hintFor(dog)).toContain('на фото, მყავს')
    expect(sentenceAudio(dog)).toMatch(/\/have\/a\d+\.m4a$/)
    expect(sentenceAudio(money)).toMatch(/\/have\/t\d+\.m4a$/)
    expect(isOver({ ...startState(), i: DECK_SIZE }, haveDeck('full', seeded(1)))).toBe(true)
  })
})

describe('HaveSort scene', () => {
  it.each(['people', 'full'] as const)('%s: a miss shows why, then every card goes to the photo or the suitcase → onDone', async mode => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<HaveSort lesson={introLesson(mode === 'people' ? 27 : 28)} step={{ kind: 'havesort', mode }} fraction={0.5} onExit={() => {}} onDone={onDone} rng={seeded(3)} />)
    fireEvent.click(screen.getByText('Начать'))
    const first = screen.getByTestId('have-card')
    await act(async () => { fireEvent.click(screen.getByTestId(first.dataset.alive === 'yes' ? 'basket-thing' : 'basket-alive')) })
    expect(screen.getByTestId('have-tip').textContent).toMatch(/на фото|в чемодан/)
    for (let k = 0; k < 200 && !screen.queryByTestId('game-end'); k++) {
      // В jsdom уходящая карточка может задержаться в DOM — текущая всегда последняя.
      const cards = screen.queryAllByTestId('have-card'); const card = cards[cards.length - 1]
      if (card) await act(async () => { fireEvent.click(screen.getByTestId(card.dataset.alive === 'yes' ? 'basket-alive' : 'basket-thing')) })
      await act(async () => { await vi.advanceTimersByTimeAsync(2500) })
    }
    expect(screen.getByTestId('game-end')).toBeTruthy()
    expect(screen.getByTestId('rule-card')).toBeTruthy()
    fireEvent.click(screen.getByText('Дальше'))
    expect(onDone).toHaveBeenCalled()
  }, 60_000)
})
