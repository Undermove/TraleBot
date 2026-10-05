import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import TimeMachine from './TimeMachine'
import { describeSlot, formOf } from './common'
import { seeded, verbRu } from '../testing/catalog'
import { moveSeen, rulesSeen } from '../testing/seen'
import { STOPS, locate } from './timeRounds'

const verb = verbRu('писать')

/** Что сейчас спрашивают: остановка с флажком и лицо. */
function asked() {
  const el = screen.getByTestId('time-ask')
  return { stop: Number(el.dataset.stop), person: Number(el.dataset.person) }
}
const answer = () => formOf(verb, STOPS[asked().stop].tense, asked().person)
const option = (form: string) => screen.getByRole('button', { name: form })
const mascotStop = () => Number(screen.getByTestId('time-mascot').dataset.stop)

function answerCorrectly() {
  fireEvent.click(option(answer()))
  act(() => { vi.advanceTimersByTime(1200) })
}

describe('TimeMachine', () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers() })
  afterEach(() => vi.useRealTimers())

  it('shows the rules on the first entry and highlights the first move', () => {
    render(<TimeMachine verb={verb} onExit={() => {}} rng={seeded(1)} />)

    expect(screen.getByText(/Как играть · 1 из 4/)).toBeTruthy()
    expect(option(answer()).className).toContain('animate-pulse')
    expect(screen.getByText(/я подсветил нужное слово/)).toBeTruthy()
  })

  it('asks with a plain Russian phrase conjugated for this verb — one question line and the phrase, no tense names', () => {
    rulesSeen('verb_time')
    render(<TimeMachine verb={verb} onExit={() => {}} rng={seeded(1)} />)

    const ask = screen.getByTestId('time-ask').textContent!
    const phrase = verb.meanings![STOPS[asked().stop].tense]![0]
    expect(['я пишу', 'я писал(а)', 'я буду писать']).toContain(phrase)
    expect(ask).toBe(`Как сказать?${phrase}`)
  })

  it('sends the mascot where the tapped form belongs and says what that form is — then lets try again', () => {
    rulesSeen('verb_time'); moveSeen('verb_time')
    render(<TimeMachine verb={verb} onExit={() => {}} rng={seeded(1)} />)
    const target = asked()
    const wrong = screen.getAllByRole('button').map(b => b.textContent!).find(f => {
      const at = locate(verb, f)
      return at && at.stop !== target.stop
    })!
    const at = locate(verb, wrong)!

    fireEvent.click(option(wrong))

    expect(mascotStop()).toBe(at.stop)
    expect(screen.getByTestId('time-said').textContent).toBe(`${wrong} — это ${describeSlot(verb, { tense: STOPS[at.stop].tense, person: at.person })}.`)
    expect(asked()).toEqual(target)

    fireEvent.click(option(answer()))

    expect(mascotStop()).toBe(target.stop)
    expect(screen.getByTestId('time-said').textContent).toBe('Он на месте!')
  })

  it('names the other person in plain words when the time is right but the person is not', () => {
    rulesSeen('verb_time'); moveSeen('verb_time')
    render(<TimeMachine verb={verb} onExit={() => {}} rng={seeded(1)} />)
    const target = asked()
    // При одном лице в игре четвёртый вариант — то же время у «ты».
    const other = formOf(verb, STOPS[target.stop].tense, 1)

    fireEvent.click(option(other))

    expect(mascotStop()).toBe(target.stop)
    expect(screen.getByTestId('time-said').textContent).toContain(`— это «${verb.meanings![STOPS[target.stop].tense]![1]}»`)
  })

  it('moves on after a right answer and adds a person after four of them', () => {
    rulesSeen('verb_time'); moveSeen('verb_time')
    render(<TimeMachine verb={verb} onExit={() => {}} rng={seeded(1)} />)

    for (let i = 0; i < 3; i++) {
      answerCorrectly()
      expect(asked().person).toBe(0)
    }
    answerCorrectly()

    expect(screen.getByTestId('time-said').textContent).toBe('Теперь ездит ещё и «ты».')
  })

  it('stops showing the first-move hint once a right answer was given', () => {
    rulesSeen('verb_time')
    render(<TimeMachine verb={verb} onExit={() => {}} rng={seeded(1)} />)

    answerCorrectly()

    expect(screen.queryByText(/я подсветил нужное слово/)).toBeNull()
    expect(option(answer()).className).not.toContain('animate-pulse')
  })
})
