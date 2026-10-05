import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import VerbSheet from './VerbSheet'
import type { VerbDto } from './types'

// Формы — из каталога (настоящее время глагола «писать»).
const present = ['ვწერ', 'წერ', 'წერს', 'ვწერთ', 'წერთ', 'წერენ'].map(f => [f])

const base: VerbDto = {
  id: 'წერს', title: 'წერა', ru: 'писать', kind: 'feature', present: ['ვწერ'],
  masdarWithPreverb: [], reason: 'Будущее и прошедшее строятся не от формы настоящего.',
  root: 'წერ', oddTenses: [], model: null, tenses: { present }, sentences: [],
  source: 'https://en.wiktionary.org/wiki/x'
}

let verb: VerbDto = base
vi.mock('../api', async () => (await import('./testing/sheetApi')).sheetApi({ fetchVerb: vi.fn(() => Promise.resolve(verb)) }))

describe('VerbSheet: глагол, формы которого составила модель', () => {
  beforeEach(() => localStorage.clear())

  it('says the forms are unverified and offers no source link', async () => {
    verb = { ...base, status: 'generated', source: null }
    render(<VerbSheet verbId="წერს" onClose={vi.fn()} />)

    await waitFor(() => screen.getByTestId('verb-unverified'))

    expect(screen.getByTestId('verb-unverified').textContent).toContain('Не проверено')
    expect(screen.queryByText(/Источник форм/)).toBeNull()
  })

  it('shows no warning on a verified verb and keeps the source link', async () => {
    verb = { ...base, status: 'verified' }
    render(<VerbSheet verbId="წერს" onClose={vi.fn()} />)

    await waitFor(() => screen.getByText(/Источник форм/))

    expect(screen.queryByTestId('verb-unverified')).toBeNull()
  })

  it('treats a card without the status field as verified', async () => {
    verb = base
    render(<VerbSheet verbId="წერს" onClose={vi.fn()} />)

    await waitFor(() => screen.getByText(/Источник форм/))

    expect(screen.queryByTestId('verb-unverified')).toBeNull()
  })
})
