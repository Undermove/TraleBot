import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { seeded } from '../../verbs/testing/catalog'
import { JOBS, NAME_LIST, introLesson, phrase } from '../story'
import Party from './Party'
import {
  HOST, badgeFits, beats, happiness, jobFits, mingle, myJobOptions, planParty, repeatLine, whoAnswer, whoOptions, type PartyMode
} from './Party.logic'

const CASES: [number, PartyMode][] = [[7, 'names'], [10, 'full'], [11, 'who'], [20, 'jobs']]
const ME = 'ნინო'

beforeEach(() => localStorage.clear())

describe('party logic', () => {
  it.each(CASES)('lesson %i (%s): distinct guests, never the learner, every beat has exactly the right answers', (lessonId, mode) => {
    for (let seed = 1; seed < 25; seed++) {
      const plan = planParty(lessonId, mode, ME, seeded(seed))
      const names = plan.guests.map(g => g.name)
      expect(new Set(names).size).toBe(names.length)
      expect(names).not.toContain(ME)
      for (const n of names) expect(NAME_LIST).toContain(n)
      expect(plan.waves.flat().sort()).toEqual(plan.guests.filter(g => !g.friend).map(g => g.id).sort())
      if (plan.spare) expect(names).not.toContain(plan.spare)
      for (const g of plan.guests.filter(x => !x.friend)) {
        for (const beat of beats(g, mode, lessonId, ME, names, seeded(seed))) {
          expect(beat.options.some(o => o.ok)).toBe(true)
          expect(beat.options.some(o => !o.ok)).toBe(true)
          expect(new Set(beat.options.map(o => o.geo)).size).toBe(beat.options.length)
        }
      }
    }
  })

  it('names (L7): 4 guests in two waves, two of them ask you first; «…შენ?» is not used before lesson 9', () => {
    const plan = planParty(7, 'names', ME, seeded(3))
    expect(plan.guests).toHaveLength(4)
    expect(plan.waves).toEqual([[0, 1], [2, 3]])
    const g = plan.guests[1]
    expect(g.asksFirst).toBe(true)
    const [first, second] = beats(g, 'names', 7, ME, [], seeded(1))
    expect(first.says).toBe('გამარჯობა!')
    expect(first.options.find(o => o.ok)!.geo).toBe(`მე მქვია ${ME}`)
    expect(first.options.map(o => o.geo)).toContain(phrase('me_mkvia_karlosi').geo)
    expect(second.says).toBe(`მე მქვია ${g.name}.`)
    expect(second.options.find(o => o.ok)!.geo).toBe(`გამარჯობა, ${g.name}!`)
    // Урок 9 и гостья Нино: она говорит знакомую фразу целиком.
    const nino = { ...g, name: 'ნინო' }
    expect(beats(nino, 'names', 9, 'ანა', [], seeded(1))[0].says).toBe(phrase('me_mkvia_nino').geo)
    expect(beats(nino, 'names', 7, 'ანა', [], seeded(1))[0].says).toBe('გამარჯობა!')
  })

  it('full (L10): greet back (both greetings are fine), your name, then «სასიამოვნოა» with an echo', () => {
    const plan = planParty(10, 'full', ME, seeded(5))
    expect(plan.guests).toHaveLength(4)
    const bs = beats(plan.guests[0], 'full', 10, ME, [], seeded(2))
    expect(bs).toHaveLength(3)
    expect(bs[0].options.filter(o => o.ok).map(o => o.geo).sort()).toEqual(['გაგიმარჯოს!', 'გამარჯობა!'].sort())
    expect(bs[1].options.find(o => o.ok)!.geo).toBe(`მე მქვია ${ME}`)
    expect(bs[2].options.find(o => o.ok)!.geo).toBe(phrase('sasiamovnoa').geo)
    expect(bs[2].echo).toBe('სასიამოვნოა!')
  })

  it('who (L11): a friend plus two guests, no guest is called like the host, friend asked twice but not in a row', () => {
    for (let seed = 1; seed < 25; seed++) {
      const plan = planParty(11, 'who', 'ანა', seeded(seed))
      expect(plan.guests.filter(g => g.friend)).toHaveLength(1)
      expect(plan.guests.map(g => g.name)).not.toContain(HOST)
      expect(plan.questions.filter(q => q === 0)).toHaveLength(2)
      expect(plan.questions[0]).not.toBe(0)
      plan.questions.forEach((q, i) => i && expect(q).not.toBe(plan.questions[i - 1]))
      const opts = whoOptions(plan.guests, seeded(seed))
      expect(opts.length).toBeGreaterThanOrEqual(3)
      for (const g of plan.guests) expect(opts).toContain(whoAnswer(g))
      expect(whoAnswer(plan.guests[0])).toBe(phrase('es_chemi_megobaria').geo)
    }
  })

  it('jobs (L20): one of each job; you are the student, «from Georgia» is not a job', () => {
    const plan = planParty(20, 'jobs', ME, seeded(9))
    for (const j of JOBS) expect(plan.guests.filter(g => g.job.geo === j.geo)).toHaveLength(1)
    const g = plan.guests[0]
    expect(beats(g, 'jobs', 20, ME, [], seeded(1))[0].says).toBe(`გამარჯობა! მე ვარ ${g.job.geo}.`)
    expect(jobFits(g, g.job)).toBe(true)
    expect(jobFits(g, JOBS.find(j => j.geo !== g.job.geo)!)).toBe(false)
    expect(repeatLine(g, 'jobs')).toBe(`მე ვარ ${g.job.geo}.`)
    const opts = myJobOptions(20, seeded(1))
    expect(opts.filter(o => o.ok).map(o => o.geo)).toEqual([`მე ვარ ${JOBS[0].geo}`])
    expect(opts.map(o => o.geo)).toContain(phrase('sakartvelodan').geo)
  })

  it('mingle moves everybody, badges and happiness', () => {
    const slots = { 0: 0, 1: 1, 2: 2, 5: 6 }
    for (let seed = 1; seed < 20; seed++) {
      const m = mingle([0, 1, 2], slots, seeded(seed))
      expect([m[0], m[1], m[2]].sort()).toEqual([0, 1, 2])
      expect([0, 1, 2].every(id => m[id] !== slots[id as 0 | 1 | 2])).toBe(true)
      expect(m[5]).toBe(6)
    }
    const g = planParty(7, 'names', ME, seeded(1)).guests[0]
    expect(badgeFits(g, g.name)).toBe(true)
    expect(badgeFits(g, 'x')).toBe(false)
    expect(happiness(0, 0)).toBe(100)
    expect(happiness(2, 1)).toBe(79)
    expect(happiness(50, 0)).toBe(0)
  })
})

describe('party scene', () => {
  afterEach(() => vi.useRealTimers())

  it.each(CASES)('lesson %i (%s): plays through to the end screen and calls onDone', async (lessonId, mode) => {
    vi.useFakeTimers()
    const step = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }
    const onDone = vi.fn()
    render(<Party lesson={introLesson(lessonId)} step={{ kind: 'party', mode }} fraction={0.5} onExit={() => {}} onDone={onDone} rng={seeded(lessonId)} />)
    expect(screen.getByTestId('party-scene')).toBeTruthy()
    fireEvent.click(screen.getByText('Начать'))
    let asked = false
    for (let i = 0; i < 600 && !screen.queryByTestId('game-end'); i++) {
      const opts = screen.queryAllByTestId(/^party-opt-/)
      const guest = screen.queryAllByTestId(/^party-guest-/).find(b => b.dataset.done === '0')
      const badgesNow = screen.queryAllByTestId(/^party-badge-\d/)
      const zones = screen.queryAllByTestId(/^party-zone-/)
      if (opts.length) fireEvent.click(opts[i % opts.length])
      else if (badgesNow.length && guest) {
        fireEvent.click(guest)
        if (!asked) { fireEvent.click(screen.getByTestId('party-repeat')); asked = true }
        fireEvent.click(badgesNow[i % badgesNow.length])
      } else if (zones.length && guest && !zones[0].hasAttribute('disabled')) {
        fireEvent.click(guest)
        fireEvent.click(zones[i % zones.length])
      }
      await step(600)
    }
    expect(screen.getByTestId('game-end')).toBeTruthy()
    expect(screen.getByTestId('rule-card')).toBeTruthy()
    fireEvent.click(screen.getByText('Дальше'))
    expect(onDone).toHaveBeenCalled()
  })

  it('a wrong badge makes the guest laugh and goes back to the stack', async () => {
    vi.useFakeTimers()
    const step = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }
    const plan = planParty(7, 'names', ME, seeded(7))
    render(<Party lesson={introLesson(7)} step={{ kind: 'party', mode: 'names' }} fraction={0.5} onExit={() => {}} onDone={() => {}} rng={seeded(7)} />)
    fireEvent.click(screen.getByText('Начать'))
    for (let i = 0; i < 100 && !screen.queryByTestId('party-tray'); i++) {
      const opts = screen.queryAllByTestId(/^party-opt-/)
      if (opts.length) fireEvent.click(opts[i % opts.length])
      await step(600)
    }
    const guest = screen.queryAllByTestId(/^party-guest-/)[0]
    const id = Number(guest.dataset.testid?.split('-').pop())
    const wrong = screen.queryAllByTestId(/^party-badge-\d/).find(b => !b.textContent!.includes(plan.guests[id].name))!
    const before = screen.queryAllByTestId(/^party-badge-\d/).length
    fireEvent.click(guest)
    fireEvent.click(wrong)
    expect(screen.getByTestId('party-speech').textContent).toContain('Я не')
    expect(screen.queryAllByTestId(/^party-badge-\d/)).toHaveLength(before)
    expect(screen.queryByTestId(`party-badge-on-${id}`)).toBeNull()
  })
})
