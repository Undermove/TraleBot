import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SurveyFormPages, { firstOpenPage } from './SurveyFormPages'
import type { SurveyAnswerDto, SurveyQuestionDto } from '../api'

vi.mock('./Mascot', () => ({ default: () => null }))

const questions: SurveyQuestionDto[] = [
  { id: 'q1', text: 'Что ты почувствуешь, если TraleBot завтра исчезнет?', kind: 'choice', options: ['Очень расстроюсь', 'Мне всё равно'], allowOther: false },
  { id: 'q2', text: 'Чем ещё ты пользуешься для грузинского?', kind: 'choice', options: ['Репетитор или курсы', 'Только TraleBot'], allowOther: true },
  { id: 'q3', text: 'А что в последний раз раздражало или мешало?', kind: 'text', options: [], allowOther: false }
]
const chose = (option: string): SurveyAnswerDto => ({ option, other: false, text: null })

let save: ReturnType<typeof vi.fn<(id: string, a: SurveyAnswerDto) => Promise<void>>>
let finish: ReturnType<typeof vi.fn<() => Promise<void>>>
let exit: ReturnType<typeof vi.fn<() => void>>

beforeEach(() => {
  save = vi.fn<(id: string, a: SurveyAnswerDto) => Promise<void>>().mockResolvedValue()
  finish = vi.fn<() => Promise<void>>().mockResolvedValue()
  exit = vi.fn<() => void>()
  window.scrollTo = vi.fn() as never
})

const open = (initial: Record<string, SurveyAnswerDto> = {}, finished = false) =>
  render(<SurveyFormPages questions={questions} initial={initial} finished={finished} otherLabel="Другое" save={save} finish={finish} onExit={exit} />)
const progress = () => screen.getByTestId('survey-progress').textContent
const next = () => userEvent.click(screen.getByTestId('survey-page-next'))

describe('SurveyFormPages', () => {
  it('starts after what was answered in the bot, one question per page', async () => {
    open({ q1: chose('Очень расстроюсь') })
    expect(progress()).toBe('Вопрос 2 из 3')
    expect(screen.getByTestId('survey-page-question').textContent).toBe('Чем ещё ты пользуешься для грузинского?')
    expect(screen.getAllByRole('radio').map(r => r.textContent)).toEqual(['Репетитор или курсы', 'Только TraleBot', 'Другое'])
    expect(screen.queryByText(questions[0].text)).toBeNull()
    expect((screen.getByTestId('survey-page-next') as HTMLButtonElement).disabled).toBe(true)
  })

  it('«Другое» pressed in the bot opens the form on that question, asking for the words', () => {
    expect(firstOpenPage(questions.slice(1), { q2: { option: null, other: true, text: null }, q3: { option: null, other: false, text: 'ок' } })).toBe(0)
    expect(firstOpenPage(questions, {})).toBe(0)
    expect(firstOpenPage(questions, { q1: chose('Мне всё равно'), q2: { option: null, other: true, text: 'Подкасты' } })).toBe(2)
  })

  it('saves the answer on the way to the next page: an option, «Другое» with words, a free text', async () => {
    open()
    await userEvent.click(screen.getByRole('radio', { name: 'Мне всё равно' }))
    await next()
    expect(save).toHaveBeenLastCalledWith('q1', { option: 'Мне всё равно', other: false, text: null })
    await waitFor(() => expect(progress()).toBe('Вопрос 2 из 3'))

    expect(screen.queryByLabelText('Свой ответ')).toBeNull()
    await userEvent.click(screen.getByRole('radio', { name: 'Другое' }))
    await userEvent.type(screen.getByLabelText('Свой ответ'), '  Подкасты ')
    await next()
    expect(save).toHaveBeenLastCalledWith('q2', { option: null, other: true, text: 'Подкасты' })
    await waitFor(() => expect(progress()).toBe('Вопрос 3 из 3'))

    expect(screen.getByTestId('survey-page-next').textContent).toBe('Готово')
    await userEvent.type(screen.getByLabelText('Твой ответ'), 'Мало озвучки')
    expect(finish).not.toHaveBeenCalled()
    await next()

    expect(save).toHaveBeenLastCalledWith('q3', { option: null, other: false, text: 'Мало озвучки' })
    expect(await screen.findByTestId('survey-thanks')).toBeTruthy()
    expect(finish).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Вернуться' }))
    expect(exit).toHaveBeenCalledTimes(1)
  })

  it('a skipped question saves nothing; skipping the last one still ends with thanks', async () => {
    open({ q1: chose('Очень расстроюсь') })
    await userEvent.click(screen.getByRole('radio', { name: 'Только TraleBot' }))
    await userEvent.click(screen.getByRole('button', { name: 'Пропустить вопрос' }))
    await waitFor(() => expect(progress()).toBe('Вопрос 3 из 3'))
    await userEvent.click(screen.getByRole('button', { name: 'Пропустить вопрос' }))

    expect(await screen.findByTestId('survey-thanks')).toBeTruthy()
    expect(save).not.toHaveBeenCalled()
    expect(finish).toHaveBeenCalledTimes(1)
  })

  it('«Назад» returns to the previous page with the answer in place', async () => {
    open({ q1: chose('Очень расстроюсь') })
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
    expect(progress()).toBe('Вопрос 1 из 3')
    expect(screen.getByRole('radio', { name: 'Очень расстроюсь' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.queryByRole('button', { name: 'Назад' })).toBeNull()
  })

  it('stays on the page and says so when the answer could not be saved', async () => {
    save.mockRejectedValueOnce(new Error('offline'))
    open()
    await userEvent.click(screen.getByRole('radio', { name: 'Мне всё равно' }))
    await next()
    expect((await screen.findByTestId('survey-page-error')).textContent).toBe('Не получилось сохранить. Попробуй ещё раз.')
    expect(progress()).toBe('Вопрос 1 из 3')
    await next()
    await waitFor(() => expect(progress()).toBe('Вопрос 2 из 3'))
  })

  it('a form already gone through says thanks and lets the answers be corrected from the first question', async () => {
    open({ q1: chose('Очень расстроюсь'), q2: { option: null, other: true, text: 'Подкасты' }, q3: { option: null, other: false, text: 'Ок' } }, true)
    expect(screen.getByTestId('survey-already').textContent).toContain('Твои ответы уже у меня')
    await userEvent.click(screen.getByRole('button', { name: 'Поправить ответы' }))
    expect(progress()).toBe('Вопрос 1 из 3')
    await next()
    await waitFor(() => expect(progress()).toBe('Вопрос 2 из 3'))
    expect((screen.getByLabelText('Свой ответ') as HTMLTextAreaElement).value).toBe('Подкасты')
    await userEvent.click(screen.getByRole('radio', { name: 'Только TraleBot' }))
    await next()
    expect(save).toHaveBeenLastCalledWith('q2', { option: 'Только TraleBot', other: false, text: null })
  })
})
