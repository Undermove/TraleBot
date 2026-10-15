import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, act } from '@testing-library/react'
import { seeded } from '../../verbs/testing/catalog'
import { introLesson } from '../story'
import Detective from './Detective'
import {
  clueFor, clueGeo, clueKinds, makeCase, makePuzzle, minimalUnique, permutations, solutions, wrongRows, type DetectiveMode, type Mark
} from './Detective.logic'

beforeEach(() => localStorage.clear())

describe('detective: logic', () => {
  it('permutations of 3 are the 6 ways', () => {
    expect(permutations(3)).toHaveLength(6)
    expect(new Set(permutations(3).map(p => p.join())).size).toBe(6)
  })

  it('clue kinds follow what the learner knows', () => {
    expect(clueKinds('from', 16)).toEqual(['me', 'not'])
    expect(clueKinds('jobs', 21)).toEqual(['me', 'they', 'not'])
    expect(clueKinds('jobs', 19)).not.toContain('they')
  })

  it.each<[DetectiveMode, number]>([['from', 16], ['jobs', 21]])('%s: every puzzle has one answer, no spare clue, and is never solved by one clue', (mode, lesson) => {
    for (let seed = 1; seed <= 40; seed++) {
      const puzzles = makeCase(mode, lesson, seeded(seed))
      puzzles.forEach((p, i) => {
        expect(p.level).toBe(i + 1)
        expect(minimalUnique(p.people.length, p.clues)).toBe(true)
        expect(solutions(p.people.length, p.clues)).toEqual([p.solution])
        expect(p.clues.length).toBeGreaterThanOrEqual(2)
        expect(new Set(p.people.map(x => x.name)).size).toBe(p.people.length)
      })
      // Чем дальше, тем меньше сказано прямо о себе.
      const direct = (k: number) => puzzles[k].clues.filter(c => c.kind === 'me').length
      expect(direct(0)).toBe(2)
      expect(direct(2)).toBeLessThan(2)
    }
  })

  it('jobs puzzles use «ის არის» about someone else; from puzzles say «მე ვარ …დან»', () => {
    const jobs = Array.from({ length: 10 }, (_, s) => makePuzzle('jobs', 2, 21, seeded(s + 1)))
    const they = jobs.flatMap(p => p.clues.filter(c => c.kind === 'they').map(c => ({ c, p })))
    expect(they.length).toBeGreaterThan(0)
    for (const { c, p } of they) {
      expect(c.kind === 'they' && c.speaker !== c.who).toBe(true)
      expect(clueGeo(c, p)).toMatch(/^.+\? ის არის .+\.$/)
    }
    const from = makePuzzle('from', 1, 16, seeded(3))
    for (const c of from.clues) expect(clueGeo(c, from)).toMatch(/^მე ვარ .+დან\.$/)
  })

  it('the clue to re-read is the one about that neighbour; none when he is only found by elimination', () => {
    const clues = [{ kind: 'me' as const, who: 1, opt: 0 }, { kind: 'they' as const, speaker: 0, who: 2, opt: 1 }]
    expect(clueFor(1, clues)).toBe(0)
    expect(clueFor(2, clues)).toBe(1)
    expect(clueFor(0, clues)).toBeNull()
  })

  it('wrong rows: missing, double or misplaced ticks', () => {
    const sol = [2, 0, 1]
    const g: Mark[][] = [[2, 2, 1], [1, 1, 0], [0, 0, 0]]
    expect(wrongRows(g, sol)).toEqual([1, 2])
    expect(wrongRows([[0, 0, 1], [1, 0, 2], [0, 1, 0]], sol)).toEqual([])
  })
})

describe('Detective scene', () => {
  it.each<[DetectiveMode, number]>([['from', 16], ['jobs', 21]])('%s: a wrong check shakes rows, then three cases are solved and «Дальше» calls onDone', async (mode, lessonId) => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    const cases = makeCase(mode, lessonId, seeded(7))
    render(<Detective lesson={introLesson(lessonId)} step={{ kind: 'detective', mode }} fraction={0.5} onExit={() => {}} onDone={onDone} rng={seeded(7)} />)
    fireEvent.click(screen.getByText('Начать'))
    for (let i = 0; i < cases.length; i++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
      expect(screen.getAllByTestId('clue')).toHaveLength(cases[i].clues.length)
      if (i === 0) {
        fireEvent.click(screen.getByTestId('detective-check'))
        expect(screen.getAllByTestId(/row-/).every(r => r.dataset.wrong === 'yes')).toBe(true)
        const mentioned = cases[i].clues.some(c => c.who === 0)
        expect(screen.getAllByTestId('clue').some(c => c.dataset.hot === 'yes')).toBe(mentioned)
      }
      cases[i].solution.forEach((s, r) => fireEvent.click(screen.getByTestId(`cell-${r}-${s}`)))
      fireEvent.click(screen.getByTestId('detective-check'))
      fireEvent.click(screen.getByText(i + 1 < cases.length ? 'Следующее дело' : 'Закрыть дела'))
    }
    expect(screen.getByTestId('game-end').textContent).toContain('2 из 3')
    expect(screen.getByTestId('rule-card')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Дальше'))
    expect(onDone).toHaveBeenCalled()
    vi.useRealTimers()
  })
})
