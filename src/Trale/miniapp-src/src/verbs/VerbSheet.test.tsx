import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import VerbSheet from './VerbSheet'
import type { VerbDto } from './types'
import { hintSeen } from './ui/hints'
import { markUiHintSeen } from '../api'

const persons = (stem: string) => ['ვ' + stem, stem, stem + 'ს', 'ვ' + stem + 'თ', stem + 'თ', stem + 'ენ'].map(f => [f])

const verb: VerbDto = {
  id: 'წერს', title: 'წერა', ru: 'писать', kind: 'pattern', present: ['ვწერ'],
  masdarWithPreverb: ['დაწერა'], reason: 'Будущее и прошедшее «сделал» = приставка და- + основа настоящего.',
  root: 'წერ', oddTenses: [], model: { id: 'აკეთებს', title: 'კეთება', ru: 'делать' },
  tenses: { present: persons('წერ'), future: persons('დაწერ'), perfect: persons('დაწერია') },
  sentences: [],
  source: 'https://en.wiktionary.org/wiki/x'
}

vi.mock('../api', async () => (await import('./testing/sheetApi')).sheetApi({ fetchVerb: vi.fn(() => Promise.resolve(verb)) }))

function open(highlight?: { tense: string; person: number }) {
  const onClose = vi.fn()
  render(<VerbSheet verbId="წერს" highlight={highlight} onClose={onClose} />)
  return onClose
}

describe('VerbSheet', () => {
  beforeEach(() => localStorage.clear())

  it('shows the "я" forms first and switches the whole table to another person', async () => {
    open()
    await waitFor(() => expect(screen.getByTestId('verb-tense-present').textContent).toContain('ვწერ'))

    fireEvent.click(screen.getByTestId('verb-person-5'))

    expect(screen.getByTestId('verb-tense-present').textContent).toContain('წერენ')
    expect(screen.getByTestId('verb-tense-future').textContent).toContain('დაწერენ')
  })

  it('keeps rare tenses collapsed until asked', async () => {
    open()
    await waitFor(() => screen.getByTestId('verb-rare-toggle'))
    expect(screen.queryByTestId('verb-tense-perfect')).toBeNull()

    fireEvent.click(screen.getByTestId('verb-rare-toggle'))

    expect(screen.getByTestId('verb-tense-perfect')).toBeTruthy()
  })

  it('opens on the person of the parsed form, with its rare tense expanded', async () => {
    open({ tense: 'perfect', person: 2 })

    await waitFor(() => expect(screen.getByTestId('verb-tense-perfect').textContent).toContain('დაწერიას'))
  })

  it('shows the first-time hint only until a person is picked', async () => {
    open()
    await waitFor(() => screen.getByText(/Это главные формы/))

    fireEvent.click(screen.getByTestId('verb-person-1'))

    expect(screen.queryByText(/Это главные формы/)).toBeNull()
    // Отметка уходит на сервер и живёт в памяти мини-аппа — на устройстве её нет.
    expect(hintSeen('verb_card_person')).toBe(true)
    expect(markUiHintSeen).toHaveBeenCalledWith('ui:verb_card_person')
    expect(localStorage.length).toBe(0)
  })

  it('hides the explanation behind "что это значит?" and opens the model verb in the same sheet', async () => {
    const { fetchVerb } = await import('../api')
    open()
    await waitFor(() => screen.getByText('что это значит?'))
    expect(screen.queryByText(/Спрягается как/)).toBeNull()

    fireEvent.click(screen.getByText('что это значит?'))
    fireEvent.click(screen.getByText(/Спрягается как/))

    await waitFor(() => expect(fetchVerb).toHaveBeenLastCalledWith('აკეთებს'))
  })
})
