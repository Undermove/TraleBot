import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import Ladder from './Ladder'
import LadderEntry, { entryLabel } from './LadderEntry'
import VerbSheet from '../VerbSheet'
import { SOLID_STEP, STEP, buildItems, settle, tokens, type FormState, type Progress } from './engine'
import { verbByLemma } from '../testing/catalog'
import { moveSeen, rulesSeen } from '../testing/seen'
import * as mockedApi from '../../api'
import { cellLabel } from './types'
import type { VerbProgressDto, VerbProgressStepDto } from './types'

// Глагол, формы и фразы — из настоящего каталога.
const verb = verbByLemma('წერს')
const items = buildItems(verb)
const [first, second, third] = items
const noProgress: VerbProgressDto = { verbId: verb.id, canLearn: true, total: items.length, forms: [] }

vi.mock('../../api', async () => (await import('../testing/sheetApi')).sheetApi())
const api = vi.mocked(mockedApi)

const state = (step: number, extra: Partial<FormState> = {}): FormState => ({ step, best: step, reviews: 0, due: false, ...extra })
/** Дожидаемся фоновых сохранений и берём последнее, что ушло на сервер про эту форму. */
async function savedStep(key: string) {
  for (let i = 0; i < 3; i++) await act(async () => {})
  const all = api.saveVerbProgress.mock.calls.flatMap(c => c[1] as VerbProgressStepDto[])
  return all.filter(s => `${s.tense}:${s.person}` === key).pop()
}
const option = (key: string) => screen.getByTestId(`ladder-option-${key}`)
const barWidth = () => parseInt(screen.getByTestId('ladder-bar').style.width)
const tick = (ms = 2000) => act(() => { vi.advanceTimersByTime(ms) })

function open(initial: Progress = {}) {
  const onExit = vi.fn()
  render(<Ladder verb={verb} initial={initial} onExit={onExit} />)
  return onExit
}

/**
 * Открывает игру с первой формой на нужной ступени. Если форма уже окрепла, игра сначала
 * знакомит со следующей — проходим знакомство, после него спросят нашу.
 */
function openAt(step: number) {
  const onExit = open({ [first.key]: state(step) })
  if (step >= SOLID_STEP) fireEvent.click(screen.getByText('Понятно'))
  return onExit
}

describe('Ladder', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    rulesSeen('ladder')
    moveSeen('ladder')
    api.saveVerbProgress.mockReset().mockResolvedValue(noProgress)
  })
  afterEach(() => vi.useRealTimers())

  it('при первом входе показывает правила, а на первом шаге — подсказку', () => {
    localStorage.clear()
    open()

    expect(screen.getByText(/Как играть · 1 из 3/)).toBeTruthy()
    fireEvent.click(screen.getByText('Дальше'))
    fireEvent.click(screen.getByText('Дальше'))
    fireEvent.click(screen.getByText('Играть'))

    expect(screen.queryByText(/Как играть ·/)).toBeNull()
    expect(screen.getByText(/нажми «Понятно»/)).toBeTruthy()
  })

  it('знакомит с первой формой — что она значит и живая фраза — и потом спрашивает её же', async () => {
    open()

    const intro = screen.getByTestId('ladder-intro')
    expect(intro.textContent).toContain(first.form)
    expect(intro.textContent).toContain(cellLabel(first))
    expect(intro.textContent).toContain('как «я делаю», только про «писать»')
    expect(intro.textContent).toContain(first.sentences[0].ru)

    fireEvent.click(screen.getByText('Понятно'))

    expect(screen.getByText('Что это за форма?')).toBeTruthy()
    expect(option(first.key)).toBeTruthy()
    expect((await savedStep(first.key))?.step).toBe(STEP.MEANING)
  })

  it('верный ответ поднимает форму на ступень и ведёт к следующему заданию', async () => {
    openAt(STEP.FORM)
    expect(screen.getByText('Как сказать?')).toBeTruthy()

    fireEvent.click(option(first.key))
    expect((await savedStep(first.key))?.step).toBe(STEP.GAP)
    tick()

    expect(screen.queryByText('Как сказать?')).toBeNull()
  })

  it('на ошибку объясняет, что за форму выбрали, и даёт попробовать ещё раз', async () => {
    openAt(STEP.FORM)
    const wrong = screen.getAllByTestId(/^ladder-option-/).find(o => o !== option(first.key))!
    const wrongItem = items.find(i => `ladder-option-${i.key}` === wrong.getAttribute('data-testid'))!

    fireEvent.click(wrong)

    const note = screen.getByTestId('ladder-note').textContent!
    expect(note).toContain(wrongItem.form)
    expect(note).toContain(cellLabel(wrongItem))
    expect(note).toContain('Попробуй ещё раз')
    expect(wrong).toBeDisabled()
    expect((await savedStep(first.key))?.step).toBe(STEP.MEANING)
    tick()
    expect(screen.getByText('Как сказать?')).toBeTruthy()

    // Вторая попытка в том же задании ступень уже не меняет.
    const saves = api.saveVerbProgress.mock.calls.length
    fireEvent.click(option(first.key))
    expect(api.saveVerbProgress.mock.calls.length).toBe(saves)
    tick()
    expect(screen.getByText('Что это за форма?')).toBeTruthy()
  })

  it('полоска после ошибки назад не идёт', () => {
    openAt(STEP.GAP)
    const before = barWidth()
    expect(before).toBeGreaterThan(0)
    const wrong = screen.getAllByTestId(/^ladder-option-/).find(o => o !== option(first.key))!

    fireEvent.click(wrong)
    expect(barWidth()).toBe(before)
    fireEvent.click(option(first.key))
    tick()

    expect(barWidth()).toBe(before)
  })

  it('во фразе с пропуском после верного ответа показывает фразу целиком', async () => {
    openAt(STEP.GAP)
    expect(screen.getByTestId('ladder-gap').textContent).toContain('_____')

    fireEvent.click(option(first.key))

    const shown = screen.getByTestId('ladder-gap').textContent!
    expect(first.sentences.map(s => s.ka)).toContain(shown)
    expect((await savedStep(first.key))?.step).toBe(settle(first, state(STEP.GAP), true).step)
  })

  describe('сборка фразы', () => {
    /** Фраза, которую сейчас просят собрать, её слова по порядку и лишние фишки. */
    function building() {
      const sentence = first.buildable.find(s => screen.queryByText(s.ru))!
      const chips = within(screen.getByTestId('ladder-chips')).getAllByRole('button')
      const answer = tokens(sentence.ka)
      const pool = [...chips]
      const words = answer.map(w => pool.splice(pool.findIndex(c => c.textContent === w), 1)[0])
      return { sentence, words, decoys: pool }
    }

    it('первая собранная слово в слово фраза — веха, игра ждёт «Дальше»', async () => {
      openAt(STEP.BUILD)
      const { words } = building()

      words.forEach(w => fireEvent.click(w))
      fireEvent.click(screen.getByText('Проверить'))

      expect(screen.getByTestId('ladder-cheer').textContent).toContain('сам собрал фразу')
      expect((await savedStep(first.key))?.step).toBe(STEP.TYPE)
      tick(5000)
      expect(screen.getByTestId('ladder-cheer')).toBeTruthy()
      fireEvent.click(screen.getByText('Дальше'))
      expect(screen.queryByTestId('ladder-cheer')).toBeNull()
    })

    it('во второй раз веху не показывает и идёт дальше сама', () => {
      localStorage.setItem('verb_ladder_first_sentence', '1')
      openAt(STEP.BUILD)

      building().words.forEach(w => fireEvent.click(w))
      fireEvent.click(screen.getByText('Проверить'))

      expect(screen.queryByTestId('ladder-cheer')).toBeNull()
      tick()
      expect(screen.queryByText('Собери фразу')).toBeNull()
    })

    it('другой порядок слов не ошибка: ступень засчитана, показан порядок из источника', async () => {
      openAt(STEP.BUILD)
      const { sentence, words } = building()

      ;[...words].reverse().forEach(w => fireEvent.click(w))
      fireEvent.click(screen.getByText('Проверить'))

      const note = screen.getByTestId('ladder-note').textContent!
      expect(note).toContain('Засчитано')
      expect(note).toContain('гибкий, но не любой — в источнике фраза такая')
      expect(note).toContain(sentence.ka)
      expect((await savedStep(first.key))?.step).toBe(STEP.TYPE)
      expect(screen.queryByTestId('ladder-cheer')).toBeNull()
    })

    it('не та форма глагола — объясняет, что это за форма, и просит заменить', async () => {
      openAt(STEP.BUILD)
      const { sentence, words, decoys } = building()
      const decoyItem = items.find(i => i.form === decoys[0].textContent)!

      words.forEach(w => fireEvent.click(w.textContent === sentence.form ? decoys[0] : w))
      fireEvent.click(screen.getByText('Проверить'))

      const note = screen.getByTestId('ladder-note').textContent!
      expect(note).toContain(cellLabel(decoyItem))
      expect(note).toContain('замени')
      expect((await savedStep(first.key))?.step).toBe(STEP.GAP)
      expect(within(screen.getByTestId('ladder-built')).queryByText(decoyItem.form)).toBeNull()
      expect(within(screen.getByTestId('ladder-chips')).getByText(decoyItem.form)).toBeTruthy()
      expect(screen.getByText('Проверить')).toBeTruthy()
    })
  })

  describe('написать самому', () => {
    const type = (word: string) => {
      const keyboard = within(document.querySelector('.geo-keyboard') as HTMLElement)
      for (const letter of word) fireEvent.pointerDown(keyboard.getByText(letter))
    }

    it('верно написанная форма выучена — счётчик выученных растёт', async () => {
      openAt(STEP.TYPE)
      expect(screen.getByText(`0/${items.length}`)).toBeTruthy()

      type(first.form)
      fireEvent.click(screen.getByText('Проверить'))

      expect((await savedStep(first.key))?.step).toBe(STEP.MASTERED)
      expect(screen.getByText(`1/${items.length}`)).toBeTruthy()
    })

    it('если написали другую форму глагола — говорит, какая это, и показывает нужную', async () => {
      openAt(STEP.TYPE)

      type(third.form)
      fireEvent.click(screen.getByText('Проверить'))

      const note = screen.getByTestId('ladder-note').textContent!
      expect(note).toContain(cellLabel(third))
      expect(note).toContain(`Правильно так: ${first.form}`)
      expect((await savedStep(first.key))?.step).toBe(settle(first, state(STEP.TYPE), false).step)
      expect(document.querySelector('.geo-keyboard')).toBeNull()
      fireEvent.click(screen.getByText('Дальше'))
      expect(screen.queryByTestId('ladder-note')).toBeNull()
    })
  })

  it('форму, которой пора на повторение, спрашивает первой и помечает как повторение', async () => {
    open({ [first.key]: state(STEP.MASTERED, { due: true }) })

    expect(screen.getByText(/^Повторение · /)).toBeTruthy()

    fireEvent.click(option(first.key))
    expect(await savedStep(first.key)).toMatchObject({ step: STEP.MASTERED, reviews: 1 })
  })

  it('когда всё выучено и повторять нечего, говорит об этом и отдаёт прогресс при выходе', () => {
    const all = Object.fromEntries(items.map(i => [i.key, state(STEP.MASTERED)]))
    const onExit = open(all)

    expect(screen.getByTestId('ladder-done').textContent).toContain('Все формы выучены')
    fireEvent.click(screen.getByText('Готово'))

    expect(onExit).toHaveBeenCalledWith(all)
  })

  it('крестик отдаёт карточке прогресс вместе с только что сделанным шагом', () => {
    const onExit = open()
    fireEvent.click(screen.getByText('Понятно'))

    fireEvent.click(screen.getByLabelText('Закрыть'))

    expect(onExit).toHaveBeenCalledWith({ [first.key]: state(STEP.MEANING) })
  })

  it('не теряет шаг, если сохранение не прошло: он уходит со следующим ответом', async () => {
    api.saveVerbProgress.mockRejectedValueOnce(new Error('offline'))
    open()

    fireEvent.click(screen.getByText('Понятно'))
    await act(async () => {})
    fireEvent.click(option(first.key))
    await act(async () => {})

    expect(api.saveVerbProgress).toHaveBeenCalledTimes(2)
    expect((await savedStep(first.key))?.step).toBe(STEP.FORM)
    expect(screen.getByTestId('verb-ladder')).toBeTruthy()
  })
})

describe('вход в лесенку с карточки глагола', () => {
  beforeEach(() => {
    localStorage.clear()
    rulesSeen('ladder')
    api.fetchVerb.mockReset().mockResolvedValue(verb)
    api.fetchVerbProgress.mockReset().mockResolvedValue(noProgress)
    api.saveVerbProgress.mockReset().mockResolvedValue(noProgress)
  })

  it('подпись кнопки: начать, продолжить, повторить, всё выучено', () => {
    const all = (due: number) => Object.fromEntries(items.map((i, n) => [i.key, state(STEP.MASTERED, { due: n < due })]))

    expect(entryLabel(items, {})).toEqual({ text: 'Выучить играя', quiet: false })
    expect(entryLabel(items, { [first.key]: state(STEP.MASTERED), [second.key]: state(STEP.FORM) }))
      .toEqual({ text: `Продолжить · 1 из ${items.length}`, quiet: false })
    expect(entryLabel(items, { [first.key]: state(STEP.TYPE, { best: STEP.MASTERED }) }).text)
      .toBe(`Продолжить · 1 из ${items.length}`)
    expect(entryLabel(items, all(2)).text).toBe('Повторить · 2 формы')
    expect(entryLabel(items, all(5)).text).toBe('Повторить · 5 форм')
    expect(entryLabel(items, all(21)).text).toBe('Повторить · 21 форму')
    expect(entryLabel(items, all(0))).toEqual({ text: `Выучено · ${items.length} из ${items.length}`, quiet: true })
  })

  it('открывает игру на весь экран поверх карточки и возвращает к ней с новым счётом', async () => {
    api.fetchVerbProgress.mockResolvedValue({
      ...noProgress,
      forms: items.slice(0, 4).map(i => ({ tense: i.tense, person: i.person, step: STEP.MASTERED, bestStep: STEP.MASTERED, reviews: 0, nextDueAtUtc: null, due: false }))
    })
    render(<VerbSheet verbId={verb.id} onClose={() => {}} />)
    const button = await screen.findByText(`Продолжить · 4 из ${items.length}`)
    expect(screen.getByTestId('verb-sheet').contains(button)).toBe(true)

    fireEvent.click(button)

    const ladder = screen.getByTestId('verb-ladder')
    expect(ladder.parentElement).toBe(document.body)
    expect(screen.getByTestId('verb-sheet')).toBeTruthy()

    fireEvent.click(within(ladder).getByText('Понятно'))
    fireEvent.click(within(ladder).getByLabelText('Закрыть'))

    expect(screen.queryByTestId('verb-ladder')).toBeNull()
    expect(screen.getByText(`Продолжить · 4 из ${items.length}`)).toBeTruthy()
    expect(screen.getByTestId('verb-tense-present')).toBeTruthy()
  })

  it('прогресс не перечитывается, когда в карточке переключают лицо', async () => {
    render(<VerbSheet verbId={verb.id} onClose={() => {}} />)
    await screen.findByText('Выучить играя')

    fireEvent.click(screen.getByTestId('verb-person-2'))

    expect(screen.getByText('Выучить играя')).toBeTruthy()
    expect(api.fetchVerbProgress).toHaveBeenCalledTimes(1)
  })

  it('у непроверенного глагола кнопки нет', async () => {
    api.fetchVerbProgress.mockResolvedValue({ ...noProgress, canLearn: false })
    render(<LadderEntry verb={verb} />)

    await waitFor(() => expect(screen.queryByTestId('ladder-entry-loading')).toBeNull())

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('если прогресс не загрузился, кнопки нет — с нуля поверх сохранённого не начинаем', async () => {
    api.fetchVerbProgress.mockRejectedValue(new Error('offline'))
    render(<LadderEntry verb={verb} />)

    await waitFor(() => expect(screen.queryByTestId('ladder-entry-loading')).toBeNull())

    expect(screen.queryByRole('button')).toBeNull()
  })
})
