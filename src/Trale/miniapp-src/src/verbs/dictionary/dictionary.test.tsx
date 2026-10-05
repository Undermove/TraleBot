import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import VocabularyList from '../../screens/VocabularyList'
import type { VocabularyItem } from '../../api'
import { formOf } from '../games/common'
import { verbRu } from '../testing/catalog'
import type { MyVerbDto, VerbFormHitDto } from '../types'
import * as mockedApi from '../../api'

// Глагол в словаре — своя сущность: запись-форма открывает сразу вид глагола; под фильтром «глаголы»
// — одна строка на глагол с уровнем; фраза с глаголом по-прежнему открывает карточку слова.

vi.mock('../../api', async () => {
  const sheet = (await import('../testing/sheetApi')).sheetApi()
  class ApiError extends Error { status = 0 }
  return { ...sheet, ApiError, api: { vocabulary: vi.fn(), deleteVocabularyEntry: vi.fn(() => Promise.resolve()) } }
})
const mocked = vi.mocked(mockedApi, true)

const WRITE = verbRu('писать')
const GO = verbRu('идти')
const hit = (verb: typeof WRITE, tense: 'present' | 'aorist', person: number, extra: Partial<VerbFormHitDto> = {}): VerbFormHitDto => ({
  form: formOf(verb, tense, person), verbId: verb.id, title: verb.title, ru: verb.ru, tense, person,
  meaning: verb.meanings![tense]![person], ...extra
})
const item = (id: string, word: string, definition: string, verb: VerbFormHitDto | null): VocabularyItem => ({
  id, word, definition, example: '', dateAddedUtc: null, successCount: 0, successReverseCount: 0, failedCount: 0,
  mastery: 'NotMastered', isStarter: false, verb
})

const iWrite = hit(WRITE, 'present', 0, { single: true, level: 'recognising' })
const iWrote = hit(WRITE, 'aorist', 0, { single: true, level: 'recognising' })
const phraseHit = hit(GO, 'present', 0, { single: false, level: 'new' })
const items = [
  item('1', iWrite.form, 'пишу', iWrite),
  item('2', iWrote.form, iWrote.meaning!, iWrote),
  item('3', `${phraseHit.form} …`, 'я иду домой', phraseHit),
  item('4', 'стол', 'table', null)
]
const verbs: MyVerbDto[] = [
  { id: WRITE.id, title: WRITE.title, ru: WRITE.ru, level: 'recognising', started: true, saved: [iWrite, iWrote] },
  { id: 'started-elsewhere', title: GO.title, ru: 'начатый из урока', level: 'meeting', started: true, saved: [] },
  { id: GO.id, title: GO.title, ru: GO.ru, level: 'new', started: false, saved: [phraseHit] }
]

async function open(filter?: 'verbs') {
  mocked.api.vocabulary.mockResolvedValue({ language: 'Georgian', items, starterItems: [], verbs })
  mocked.fetchVerb.mockImplementation(async id => (id === GO.id ? GO : WRITE))
  render(<VocabularyList progress={{} as never} navigate={vi.fn()} initialFilter={filter} />)
  if (filter) await screen.findAllByTestId(/^my-verb-/)
  else await screen.findByText('пишу')
}
const row = (text: string) => screen.getByText(text).closest('button')!

describe('глагол в словаре', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks() })

  it('запись-форма открывает сразу вид глагола: слово, что оно значит, уровень и кнопка игры — без карточки слова', async () => {
    await open()
    fireEvent.click(row('пишу'))

    const entry = await screen.findByTestId('verb-entry')
    expect(entry.textContent).toContain(iWrite.form)
    expect(screen.getByTestId('verb-entry-meaning').textContent).toBe(iWrite.meaning)
    expect(screen.getByTestId('verb-entry-saved').textContent).toContain('пишу')
    expect(entry.textContent).toContain(WRITE.ru)
    expect(screen.getByTestId('verb-sheet')).toBeTruthy()
    expect(screen.queryByTestId('verb-hint')).toBeNull()
    // Дальше — уровень и кнопка, потом таблица, открытая на лице сохранённого слова.
    const play = await screen.findByTestId('session-entry')
    expect(entry.compareDocumentPosition(play) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(play.compareDocumentPosition(screen.getByTestId('verb-tense-present')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(mocked.fetchVerb).toHaveBeenCalledWith(WRITE.id)
  })

  it('когда записано то же, что значит форма, перевод не повторяется', async () => {
    await open()
    fireEvent.click(row(iWrote.meaning!))

    await screen.findByTestId('verb-entry')
    expect(screen.queryByTestId('verb-entry-saved')).toBeNull()
  })

  it('фраза, в которой глагол просто есть, открывает карточку слова с подсказкой', async () => {
    await open()
    fireEvent.click(row('я иду домой'))

    expect(await screen.findByTestId('verb-hint')).toBeTruthy()
    expect(screen.queryByTestId('verb-sheet')).toBeNull()

    fireEvent.click(screen.getByTestId('verb-hint'))
    await screen.findByTestId('verb-sheet')
    expect(screen.queryByTestId('verb-entry')).toBeNull()
  })

  it('в общем списке у слова-глагола вместо точки «выучено» — уровень глагола', async () => {
    await open()

    expect(within(row('пишу')).getByTestId('verb-level').getAttribute('data-level')).toBe('recognising')
    expect(within(row('я иду домой')).getByTestId('verb-badge')).toBeTruthy()
    expect(within(row('table')).queryByTestId('verb-level')).toBeNull()
  })

  it('фильтр «глаголы»: одна строка на глагол — с уровнем и сохранёнными словами; начатый из урока тоже здесь', async () => {
    await open('verbs')

    const rows = screen.getAllByTestId(/^my-verb-/)
    expect(rows).toHaveLength(3)
    expect(rows[0].textContent).toContain(`${iWrite.form}, ${iWrote.form}`)
    expect(within(rows[0]).getByTestId('verb-level').getAttribute('data-level')).toBe('recognising')
    expect(rows[1].textContent).toContain('начат в игре, в словаре пока нет')
    expect(screen.queryByText('table')).toBeNull()

    fireEvent.click(rows[0])
    expect((await screen.findByTestId('verb-entry')).textContent).toContain(iWrite.form)
  })

  it('действия со словом — внизу и тихо: в квиз и удалить с подтверждением; после закрытия словарь перечитывается', async () => {
    await open()
    fireEvent.click(row('пишу'))
    const actions = await screen.findByTestId('verb-entry-actions')
    expect(actions.compareDocumentPosition(screen.getByTestId('verb-tense-present')) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()

    fireEvent.click(within(actions).getByText('Удалить из словаря'))
    expect(mocked.api.deleteVocabularyEntry).not.toHaveBeenCalled()
    fireEvent.click(within(actions).getByText('Удалить'))

    await waitFor(() => expect(mocked.api.deleteVocabularyEntry).toHaveBeenCalledWith('1'))
    await waitFor(() => expect(mocked.api.vocabulary).toHaveBeenCalledTimes(2), { timeout: 2000 })
    await act(async () => {})
  })
})
