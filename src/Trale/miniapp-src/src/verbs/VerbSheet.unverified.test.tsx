import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import catalog from '../../../Verbs/verbs.json'
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

describe('VerbSheet: глагол, который составила модель', () => {
  beforeEach(() => localStorage.clear())

  it('says quietly where the verb came from: one line, no warning block, no source link', async () => {
    verb = { ...base, status: 'generated', source: null }
    render(<VerbSheet verbId="წერს" onClose={vi.fn()} />)

    await waitFor(() => screen.getByTestId('verb-model-made'))

    expect(screen.getByTestId('verb-model-made').textContent).toBe('составлено нейросетью')
    expect(screen.queryByText(/Не проверено|Могут быть ошибки/)).toBeNull()
    expect(screen.queryByText(/Источник форм/)).toBeNull()
  })

  it('shows no such line on a verified verb and keeps the source link', async () => {
    verb = { ...base, status: 'verified' }
    render(<VerbSheet verbId="წერს" onClose={vi.fn()} />)

    await waitFor(() => screen.getByText(/Источник форм/))

    expect(screen.queryByTestId('verb-model-made')).toBeNull()
  })

  it('treats a card without the status field as verified', async () => {
    verb = base
    render(<VerbSheet verbId="წერს" onClose={vi.fn()} />)

    await waitFor(() => screen.getByText(/Источник форм/))

    expect(screen.queryByTestId('verb-model-made')).toBeNull()
  })

  it('shows an unverified tense apart from the others, marked, with one line of explanation', async () => {
    // Формы — из каталога: прошедшее «сделал» глагола «писать».
    const write = (catalog as { verbs: { lemma: string; tenses: Record<string, string[][]>; meanings: Record<string, string[]> }[] }).verbs
      .find(v => v.lemma === 'წერს')!
    verb = {
      ...base, status: 'generated', source: null,
      unverified: { aorist: write.tenses.aorist }, unverifiedMeanings: { aorist: write.meanings.aorist }
    }
    render(<VerbSheet verbId="წერს" onClose={vi.fn()} />)

    const row = await waitFor(() => screen.getByTestId('verb-unverified-aorist'))

    expect(row.textContent).toContain(write.tenses.aorist[0][0])
    expect(row.textContent).toContain(write.meanings.aorist[0])
    expect(row.textContent).toContain('Прошедшее: сделал · не проверено')
    expect(screen.getByTestId('verb-unverified-note').textContent)
      .toBe('Формы с пометкой «не проверено» собраны автоматически и ещё не проверены. В заданиях их нет.')
    // Проверенные строки — как у всех; непроверенное время не числится ни среди них, ни среди отсутствующих.
    expect(screen.getByTestId('verb-tense-present')).toBeTruthy()
    expect(screen.queryByTestId('verb-tense-aorist')).toBeNull()
    expect(screen.getByTestId('verb-partial').textContent).not.toContain('прошедшее: сделал')
    expect(screen.getByTestId('verb-partial').textContent).toContain('будущее')

    await userEvent.click(screen.getByTestId('verb-person-5'))
    expect(screen.getByTestId('verb-unverified-aorist').textContent).toContain(write.tenses.aorist[5][0])
  })

  it('has no mark and no note when every tense is verified', async () => {
    verb = { ...base, status: 'generated', source: null, unverified: {}, unverifiedMeanings: {} }
    render(<VerbSheet verbId="წერს" onClose={vi.fn()} />)

    await waitFor(() => screen.getByTestId('verb-model-made'))

    expect(screen.queryByTestId('verb-unverified-note')).toBeNull()
    expect(screen.queryByText(/не проверено/)).toBeNull()
  })
})
