import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import TranslationProgress from '../TranslationProgress'
import { furtherStage, progressView } from '../stages'
import type { TranslateProgress, TranslateStage } from '../../api'

// Блок «перевод идёт»: слова для шага, счёт шагов у глагола, секунды ожидания.

const at = (stage: TranslateStage | null, verbLookup = false, slow = false): TranslateProgress => ({ stage, verbLookup, slow })

describe('progressView', () => {
  it('has short words for every step of an ordinary word and never counts steps for it', () => {
    const stages: Array<TranslateStage | null> = [null, 'started', 'base', 'recognizing', 'dictionaries', 'saving']
    const views = stages.map((s) => progressView(at(s)))

    expect(views.map((v) => v.text)).toEqual([
      'Ищу перевод', 'Ищу перевод', 'Смотрю в нашей базе', 'Разбираюсь, что за слово', 'Ищу перевод в словарях', 'Сохраняю в твой словарь'
    ])
    expect(views.every((v) => v.step === null)).toBe(true)
    expect(views.every((v) => !/глагол|форм|минут/.test(v.text + v.note))).toBe(true)
  })

  it('counts the steps of a verb forward only: 2 → 3 → 4 → 5', () => {
    const path: TranslateStage[] = ['verb-source', 'verb-forms', 'verb-review', 'saving']

    expect(path.map((s) => progressView(at(s, true)).step)).toEqual([2, 3, 4, 5])
  })

  it('keeps a verb that ends up in the old translator after the look-up at a later step, not an earlier one', () => {
    const view = progressView(at('dictionaries', true))

    expect(view.text).toBe('Ищу перевод в словарях')
    expect(view.step).toBe(4)
  })

  it('takes the verb path from the step alone when the flag has not arrived', () => {
    expect(progressView(at('verb-forms')).step).toBe(3)
  })
})

describe('furtherStage', () => {
  it('moves forward, never back, and ignores what it does not know', () => {
    expect(furtherStage(null, 'base')).toBe('base')
    expect(furtherStage('verb-review', 'verb-forms')).toBe('verb-review')
    expect(furtherStage('verb-forms', 'saving')).toBe('saving')
    expect(furtherStage('verb-forms', null)).toBe('verb-forms')
    expect(furtherStage('verb-forms', undefined)).toBe('verb-forms')
    expect(furtherStage('verb-forms', 'brand-new-step')).toBe('verb-forms')
  })
})

describe('TranslationProgress', () => {
  afterEach(() => vi.useRealTimers())

  it('counts the seconds of a long wait and does not show them for a quick one', () => {
    vi.useFakeTimers()
    render(<TranslationProgress progress={at('verb-forms', true, true)} startedAt={Date.now()} />)
    expect(screen.queryByTestId('translate-seconds')).toBeNull()

    act(() => { vi.advanceTimersByTime(2000) })
    expect(screen.queryByTestId('translate-seconds')).toBeNull()

    act(() => { vi.advanceTimersByTime(10_000) })
    expect(screen.getByTestId('translate-seconds').textContent).toBe('12 с')
  })

  it('goes on counting from the moment the word was sent when the screen is opened again', () => {
    render(<TranslationProgress progress={at('verb-review', true, true)} startedAt={Date.now() - 31_000} />)

    expect(screen.getByTestId('translate-seconds').textContent).toBe('31 с')
  })

  it('is a live status region with one moving bar for an ordinary word and five segments for a verb', () => {
    const { rerender } = render(<TranslationProgress progress={at('dictionaries')} startedAt={Date.now()} />)
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.queryAllByTestId('translate-seg')).toHaveLength(0)

    rerender(<TranslationProgress progress={at('verb-forms', true)} startedAt={Date.now()} />)
    expect(screen.getAllByTestId('translate-seg').map((s) => s.getAttribute('data-state')))
      .toEqual(['done', 'done', 'now', 'next', 'next'])
  })
})
