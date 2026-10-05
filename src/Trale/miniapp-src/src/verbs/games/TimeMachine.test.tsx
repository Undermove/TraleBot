import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import TimeMachine from './TimeMachine'
import { formOf } from './common'
import { moveSeen, rulesSeen, seeded, verbRu } from './testCatalog'
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
    expect(screen.getByText(/я подсветил нужную форму/)).toBeTruthy()
  })

  it('asks in Russian built from the person, the stop and the verb translation', () => {
    rulesSeen('verb_time')
    render(<TimeMachine verb={verb} onExit={() => {}} rng={seeded(1)} />)

    const ask = screen.getByTestId('time-ask').textContent!
    expect(ask).toContain(`я · ${STOPS[asked().stop].label.toLowerCase()}`)
    expect(ask).toContain('«писать»')
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
    expect(screen.getByTestId('time-said').textContent).toContain(`${wrong} — это «я», ${STOPS[at.stop].label.toLowerCase()}`)
    expect(asked()).toEqual(target)

    fireEvent.click(option(answer()))

    expect(mascotStop()).toBe(target.stop)
    expect(screen.getByTestId('time-said').textContent).toBe('Он на месте!')
  })

  it('says when the stop is right but the traveller is not', () => {
    rulesSeen('verb_time'); moveSeen('verb_time')
    render(<TimeMachine verb={verb} onExit={() => {}} rng={seeded(1)} />)
    const target = asked()
    // При одном лице в игре четвёртый вариант — то же время у «ты».
    const other = formOf(verb, STOPS[target.stop].tense, 1)

    fireEvent.click(option(other))

    expect(mascotStop()).toBe(target.stop)
    expect(screen.getByTestId('time-said').textContent).toContain('Остановка та, но едет не «я»')
  })

  it('moves on after a right answer and adds a person after four of them', () => {
    rulesSeen('verb_time'); moveSeen('verb_time')
    render(<TimeMachine verb={verb} onExit={() => {}} rng={seeded(1)} />)
    expect(screen.getByText(/лиц: 1/)).toBeTruthy()

    for (let i = 0; i < 3; i++) {
      answerCorrectly()
      expect(asked().person).toBe(0)
    }
    answerCorrectly()

    expect(screen.getByText(/лиц: 2/)).toBeTruthy()
    expect(screen.getByTestId('time-said').textContent).toBe('Теперь ездит ещё и «ты».')
  })

  it('stops showing the first-move hint once a right answer was given', () => {
    rulesSeen('verb_time')
    render(<TimeMachine verb={verb} onExit={() => {}} rng={seeded(1)} />)

    answerCorrectly()

    expect(screen.queryByText(/я подсветил нужную форму/)).toBeNull()
    expect(option(answer()).className).not.toContain('animate-pulse')
  })
})
