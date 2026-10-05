import { describe, it, expect, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import Bones from './Bones'
import { COLS, boneRows, plantBones } from './boneField'
import { formOf } from './common'
import { seeded, verbRu } from '../testing/catalog'
import { moveSeen, rulesSeen } from '../testing/seen'

const verb = verbRu('писать')
const rows = boneRows(verb)
const SEED = 21
/** Где лежат косточки при этой случайности: игра закапывает их первым же вызовом. */
const bones = plantBones(rows.length * COLS, seeded(SEED))
const formAt = (cell: number) => formOf(verb, rows[Math.floor(cell / COLS)], cell % COLS)
const cellEl = (cell: number) => screen.getByTestId(`bones-cell-${cell}`)

function start() {
  rulesSeen('verb_bones'); moveSeen('verb_bones')
  render(<Bones verb={verb} onExit={() => {}} rng={seeded(SEED)} />)
}

/** Набрать слово на экранной грузинской клавиатуре. */
function type(word: string) {
  const dig = within(screen.getByTestId('bones-dig'))
  for (const letter of word) fireEvent.pointerDown(dig.getByRole('button', { name: letter }))
}

function digWithOptions(cell: number) {
  fireEvent.click(cellEl(cell))
  fireEvent.click(screen.getByText('Не помню — дай варианты'))
  fireEvent.click(within(screen.getByTestId('bones-dig')).getByRole('button', { name: formAt(cell) }))
}

describe('Bones', () => {
  beforeEach(() => localStorage.clear())

  it('shows the rules on the first entry and points at the first cell', () => {
    render(<Bones verb={verb} onExit={() => {}} rng={seeded(SEED)} />)

    expect(screen.getByText(/Как играть · 1 из 4/)).toBeTruthy()
    expect(screen.getByText(/Я закопал 7 косточек в таблице глагола «писать»/)).toBeTruthy()
    expect(cellEl(0).className).toContain('animate-pulse')
  })

  it('asks for the cell in Russian and digs it when its form is typed on the Georgian keyboard', () => {
    start()
    const cell = rows.indexOf('future') * COLS + 1

    fireEvent.click(cellEl(cell))
    expect(screen.getByTestId('bones-dig').textContent).toContain('ты · Будущее')
    expect(screen.getByTestId('bones-dig').textContent).toContain('«писать»')

    type(formAt(cell))
    expect(screen.getByTestId('bones-typed').textContent).toBe(formAt(cell))
    fireEvent.click(screen.getByText('Копать'))

    expect(cellEl(cell).dataset.state).toBe(bones.has(cell) ? 'bone' : 'empty')
    expect(screen.queryByTestId('bones-dig')).toBeNull()
  })

  it('shows the dug form large under the field, and again when an open cell is tapped', () => {
    start()
    digWithOptions(0)
    expect(screen.getByTestId('bones-peek').textContent).toContain('я · Настоящее')
    expect(screen.getByTestId('bones-peek').textContent).toContain(formAt(0))

    digWithOptions(1)
    expect(screen.getByTestId('bones-peek').textContent).toContain(formAt(1))

    fireEvent.click(cellEl(0))
    expect(screen.getByTestId('bones-peek').textContent).toContain(formAt(0))
    // В самой клетке — только косточка или цифра.
    expect(cellEl(0).textContent).not.toContain(formAt(0))
  })

  it('puts the number of neighbouring bones into an empty cell', () => {
    start()
    const empty = [...Array(rows.length * COLS).keys()].find(i => !bones.has(i))!
    const r = Math.floor(empty / COLS), c = empty % COLS
    let near = 0
    for (const b of bones) if (b !== empty && Math.abs(Math.floor(b / COLS) - r) <= 1 && Math.abs((b % COLS) - c) <= 1) near++

    digWithOptions(empty)

    expect(cellEl(empty).textContent).toBe(String(near))
  })

  it('does not punish a wrong form: says what it is and offers four options', () => {
    start()
    const cell = rows.indexOf('future') * COLS
    fireEvent.click(cellEl(cell))

    type(formAt(0))
    fireEvent.click(screen.getByText('Копать'))

    expect(screen.getByTestId('bones-note').textContent).toContain(`${formAt(0)} — это «я», настоящее`)
    expect(cellEl(cell).dataset.state).toBe('closed')
    const dig = within(screen.getByTestId('bones-dig'))
    fireEvent.click(dig.getByRole('button', { name: formAt(cell) }))
    expect(cellEl(cell).dataset.state).not.toBe('closed')
  })

  it('is won when every bone is found, and can be buried again', () => {
    start()
    for (const cell of bones) digWithOptions(cell)

    expect(screen.getByTestId('bones-won').textContent).toContain('Все косточки найдены за 7 попыток')
    expect(screen.getByText('7/7')).toBeTruthy()

    fireEvent.click(screen.getByText('Закопать заново'))

    expect(screen.queryByTestId('bones-won')).toBeNull()
    expect(cellEl([...bones][0]).dataset.state).toBe('closed')
  })
})
