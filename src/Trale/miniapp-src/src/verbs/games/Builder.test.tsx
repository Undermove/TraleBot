import { describe, it, expect, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import Builder from './Builder'
import { builderCells, schemeOf, type BuilderCell } from './formParts'
import { seeded, verbRu } from '../testing/catalog'
import { moveSeen, rulesSeen } from '../testing/seen'
import type { TenseKey } from '../types'

const verb = verbRu('писать')
const scheme = schemeOf(verb)!
const cells = builderCells(verb)

/** Какую форму сейчас просят собрать. */
function asked(): BuilderCell {
  const el = screen.getByTestId('builder-ask')
  return cells.find(c => c.tense === (el.dataset.tense as TenseKey) && c.person === Number(el.dataset.person))!
}
const row = (id: string) => within(screen.getByTestId(`builder-row-${id}`))
const choose = (id: string, value: string) =>
  fireEvent.click(row(id).getAllByRole('button').find(b => b.dataset.value === value)!)
const unlocked = (id: string) => row(id).getAllByRole('button').filter(b => !(b as HTMLButtonElement).disabled).length

/** Собрать текущую форму правильно, выбирая только в открытых рядах. */
function solve() {
  const cell = asked()
  for (const id of ['preverb', 'marker', 'ending'] as const) if (unlocked(id)) choose(id, cell.parts[id])
  fireEvent.click(screen.getByText('Собрать'))
  return cell
}
const next = () => fireEvent.click(screen.getByText('Дальше'))

function start() {
  rulesSeen('verb_builder'); moveSeen('verb_builder')
  render(<Builder verb={verb} onExit={() => {}} rng={seeded(2)} extraPreverbs={[schemeOf(verbRu('делать'))!.preverb]} />)
}

describe('Builder', () => {
  beforeEach(() => localStorage.clear())

  it('shows the rules on the first entry and highlights the row to pick from', () => {
    render(<Builder verb={verb} onExit={() => {}} rng={seeded(2)} />)

    expect(screen.getByText(/Как играть · 1 из 4/)).toBeTruthy()
    expect(screen.getByTestId('builder-row-ending').className).toContain('animate-pulse')
    expect(screen.getByText(/Выбери окончание/)).toBeTruthy()
  })

  it('starts with only the ending to choose: preverb and person marker are already in the frame', () => {
    start()
    const cell = asked()

    expect(unlocked('preverb')).toBe(0)
    expect(unlocked('marker')).toBe(0)
    expect(unlocked('ending')).toBeGreaterThan(1)
    expect(screen.getByTestId('builder-frame').textContent).toContain(cell.parts.preverb + cell.parts.marker + scheme.root)
    expect(screen.getByTestId('builder-ask').textContent).toContain('писать')
  })

  it('assembles the form from the chosen parts and rewards the right one', () => {
    start()

    const cell = solve()

    expect(screen.getByTestId('builder-frame').textContent).toContain(cell.form)
    expect(screen.getByText('собрано 1')).toBeTruthy()
    next()
    expect(asked().form).not.toBe(cell.form)
  })

  it('on a wrong assembly names the part to change and lets fix it, without revealing the answer', () => {
    start()
    const cell = asked()
    const wrong = row('ending').getAllByRole('button').map(b => b.dataset.value!).find(v => v !== cell.parts.ending)!

    choose('ending', wrong)
    fireEvent.click(screen.getByText('Собрать'))

    expect(screen.getByTestId('builder-note').textContent).toContain('Поменяй окончание')
    expect(screen.queryByText('Дальше')).toBeNull()
    expect(screen.getByText('собрано 0')).toBeTruthy()

    choose('ending', cell.parts.ending)
    expect(screen.queryByTestId('builder-note')).toBeNull()
    fireEvent.click(screen.getByText('Собрать'))

    expect(screen.getByText('собрано 1')).toBeTruthy()
  })

  it('opens the person marker after three forms and the preverb after six', () => {
    start()
    for (let i = 0; i < 3; i++) { solve(); next() }

    expect(screen.getByText('Теперь показатель лица выбираешь ты.')).toBeTruthy()
    expect(unlocked('marker')).toBe(2)
    expect(unlocked('preverb')).toBe(0)

    for (let i = 0; i < 3; i++) { solve(); next() }

    expect(screen.getByText('Теперь и приставку выбираешь ты.')).toBeTruthy()
    // Своя приставка, прочерк и приставка другого глагола.
    expect(unlocked('preverb')).toBe(3)
    solve()
    expect(screen.getByText('собрано 7')).toBeTruthy()
  })
})
