import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import VerbSheet from '../../VerbSheet'
import { onOpenLessonModule } from '../nav'
import { GO, at, familyVerb } from '../../testing/family'
import { newLearning } from '../../testing/sheetApi'
import { verbRu } from '../../testing/catalog'
import { entryLabel } from '../../session/SessionEntry'
import type { VerbLearningDto } from '../../session/types'

// Карточка глагола из семьи: строка «это „идти“ с приставкой…», выделенная приставка в каждой форме,
// ссылки на основной глагол и на уроки; у основного глагола — ряд остальных направлений.

const ACROSS = at('across', 'there')
const state: { learning: (id: string) => VerbLearningDto } = { learning: () => newLearning }
const familyOf = (id: string, baseLearned: boolean): VerbLearningDto['family'] =>
  GO.members.some(m => m.lemma === id)
    ? { id: 'go', role: id === GO.base ? 'base' : 'member', baseId: GO.base, baseName: GO.baseName, baseLearned, lessonDone: false }
    : null

vi.mock('../../../api', async () => (await import('../../testing/sheetApi')).sheetApi({
  fetchVerb: vi.fn((id: string) => Promise.resolve(GO.members.some(m => m.lemma === id) ? familyVerb(id) : verbRu('писать'))),
  fetchVerbLearning: vi.fn((id: string) => Promise.resolve(state.learning(id)))
}))

const open = (id: string) => render(<VerbSheet verbId={id} onClose={vi.fn()} />)

describe('семья на карточке глагола', () => {
  beforeEach(() => {
    localStorage.clear()
    state.learning = id => ({ ...newLearning, family: familyOf(id, true) })
  })

  it('глагол с приставкой: строка, приставка выделена в каждой форме таблицы, игра — короткая', async () => {
    open(ACROSS)
    const verb = familyVerb(ACROSS)
    const prefix = verb.family!.prefixes[0]

    await waitFor(() => expect(screen.getByTestId('family-line').textContent).toContain(`Это «${GO.baseName}» с приставкой «через»`))
    expect(screen.getByTestId('family-line').textContent).toContain(`${prefix}- в начале слова — через · туда`)
    const marked = screen.getAllByTestId('form-prefix')
    expect(marked).toHaveLength(6)
    expect(marked.every(m => m.textContent === prefix)).toBe(true)
    expect(screen.getByTestId('verb-tense-future').textContent).toContain(verb.tenses.future![0][0])

    // Другое лицо — приставка выделена и там.
    fireEvent.click(screen.getByTestId('verb-person-5'))
    expect(screen.getAllByTestId('form-prefix')).toHaveLength(6)

    await waitFor(() => expect(screen.getByTestId('session-entry').getAttribute('data-mode')).toBe('prefix'))
    expect(screen.getByRole('button', { name: 'Выучить приставку — 2 минуты' })).toBeInTheDocument()
    expect(screen.getByTestId('session-entry-about').textContent).toContain(`по «${GO.baseName}»`)
  })

  it('«сюда»: в строке обе приставки, выделена составная целиком', async () => {
    const id = at('out', 'here')
    open(id)
    await waitFor(() => expect(screen.getByTestId('family-line').textContent).toContain('«наружу» + «сюда»'))
    expect(screen.getAllByTestId('form-prefix')[0].textContent).toBe(familyVerb(id).family!.prefixes[0])
  })

  it('ссылки: на основной глагол — в этой же карточке, на уроки — через App', async () => {
    const opened = vi.fn()
    const off = onOpenLessonModule(opened)
    open(ACROSS)
    await waitFor(() => screen.getByTestId('family-lesson'))
    fireEvent.click(screen.getByTestId('family-lesson'))
    expect(opened).toHaveBeenCalledWith('preverbs')

    fireEvent.click(screen.getByTestId('family-base'))
    await waitFor(() => expect(screen.getByTestId('family-note').getAttribute('data-role')).toBe('base'))
    off()
  })

  it('основной глагол: ряд остальных направлений, нажатие открывает глагол; приставки выделены и у него', async () => {
    open(GO.base)
    await waitFor(() => expect(screen.getAllByTestId('family-member')).toHaveLength(GO.members.length - 1))
    expect(screen.queryByTestId('family-line')).toBeNull()
    const base = familyVerb(GO.base)
    // В будущем у основного глагола приставка другая — выделена та, что стоит в слове.
    expect(new Set(screen.getAllByTestId('form-prefix').map(m => m.textContent))).toEqual(new Set(base.family!.prefixes))
    await waitFor(() => expect(screen.getByTestId('session-entry').getAttribute('data-mode')).toBe('full'))

    fireEvent.click(screen.getByLabelText(/через, сюда$/))
    await waitFor(() => expect(screen.getByTestId('family-line').textContent).toContain('«через» + «сюда»'))
  })

  it('основной глагол не выучен: карточка направления сначала ведёт к нему, но учить отдельно не запрещает', async () => {
    state.learning = id => ({ ...newLearning, family: familyOf(id, false) })
    open(ACROSS)

    await waitFor(() => expect(screen.getByTestId('session-entry').getAttribute('data-mode')).toBe('base-first'))
    expect(screen.getByTestId('session-entry-base').textContent).toBe(`Сначала «${GO.baseName}»`)
    expect(screen.getByTestId('session-entry-alone').textContent).toBe('Учить этот глагол отдельно')
    fireEvent.click(screen.getByTestId('session-entry-base'))
    await waitFor(() => expect(screen.getByTestId('family-note').getAttribute('data-role')).toBe('base'))
  })

  it('обычный глагол: ни строки, ни ряда, ни выделенных приставок семьи', async () => {
    open('любой')
    await waitFor(() => screen.getByTestId('session-entry'))
    expect(screen.queryByTestId('family-note')).toBeNull()
    expect(screen.queryByTestId('form-prefix')).toBeNull()
  })

  it('подпись кнопки: выученному глаголу с приставкой — «Сыграть ещё», начатой сессии — «Продолжить игру»', () => {
    const member = { ...newLearning, family: familyOf(ACROSS, true) }
    expect(entryLabel(member).text).toBe('Выучить приставку — 2 минуты')
    expect(entryLabel({ ...member, level: 'meeting' }).text).toBe('Выучить приставку — 2 минуты')
    expect(entryLabel({ ...member, level: 'learned' })).toEqual({ text: 'Сыграть ещё', quiet: true })
    expect(entryLabel({ ...member, session: { id: 'x', plan: { v: 1, scenes: [] }, scene: 0, done: 0 } }).text).toBe('Продолжить игру')
    expect(entryLabel({ ...newLearning, family: familyOf(ACROSS, false) }).text).toBe('Выучить играя')
  })
})
