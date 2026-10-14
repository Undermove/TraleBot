import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { api as mocked } from '../api'
import Practice from '../screens/Practice'
import { defaultProgress } from '../progress'

vi.mock('../api', () => ({
  api: { lessonQuestions: vi.fn(), recordAnswer: vi.fn(), completeLesson: vi.fn() },
  markUiHintSeen: vi.fn(() => Promise.resolve())
}))
const api = vi.mocked(mocked)

// Урок 1: по два вопроса на каждую букву (ა, დ, რ), потом слова — как в questions.json.
const lemmas = ['ა', 'ა', 'დ', 'დ', 'რ', 'რ', 'დ', 'და', 'არა', 'რა']
const questions = lemmas.map((lemma, i) => ({ id: `q${i}`, lemma, question: `Вопрос ${i + 1}`, options: ['верно', 'неверно'], answerIndex: 0, explanation: '' }))

function answer() {
  fireEvent.click(screen.getByText('верно'))
  fireEvent.click(screen.getByText('проверить'))
  fireEvent.click(screen.getByText(/дальше →|итог →/))
}
const skipIntro = () => { fireEvent.click(screen.getByTestId('intro-skip')); fireEvent.click(screen.getByText('дальше →')) }

describe('alphabet lesson scenes', () => {
  beforeEach(() => {
    localStorage.clear()
    // Записи букв: в jsdom <audio> не играет.
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    api.lessonQuestions.mockResolvedValue(questions as any)
    api.recordAnswer.mockResolvedValue({ xpEarned: 1, progress: {} } as any)
    api.completeLesson.mockResolvedValue({ xpEarned: 20, progress: {} } as any)
  })

  it('introduces each letter before its first question, plays Morph mid-lesson and keeps the lesson count as it was', async () => {
    const navigate = vi.fn()
    render(<Practice moduleId="alphabet-progressive" lessonId={1} progress={defaultProgress} setProgress={() => {}} authenticated navigate={navigate} />)

    await waitFor(() => expect(screen.getByText(/новая буква · 1 из 3/)).toBeTruthy())
    skipIntro()
    expect(screen.getByText('Вопрос 1')).toBeTruthy()
    answer()
    expect(screen.getByText('Вопрос 2')).toBeTruthy()
    answer()
    expect(screen.getByText(/новая буква · 2 из 3/)).toBeTruthy()
    skipIntro(); answer(); answer()
    expect(screen.getByText(/новая буква · 3 из 3/)).toBeTruthy()
    skipIntro(); answer(); answer()

    // После шестого вопроса — «Превращение».
    expect(screen.getByText('Преврати слово в грузинское')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Назад'))
    expect(navigate).toHaveBeenCalledWith({ kind: 'lesson-theory', moduleId: 'alphabet-progressive', lessonId: 1 })
  })

  it('after the last question sends the same result to the server, then the cafe and the celebration', async () => {
    const navigate = vi.fn()
    render(<Practice moduleId="alphabet-progressive" lessonId={1} progress={defaultProgress} setProgress={() => {}} authenticated navigate={navigate} />)
    await waitFor(() => expect(screen.getByTestId('intro-skip')).toBeTruthy())
    for (let i = 0; i < questions.length; i++) {
      if (screen.queryByTestId('intro-skip')) skipIntro()
      if (screen.queryByText('Преврати слово в грузинское')) {
        // Пройти «Превращение» нечестно быстро: каждый раз жмём верную плитку.
        while (!screen.queryByText(/читается/) || screen.queryAllByTestId('morph-choice').length) {
          const ask = screen.getByText(/Какая грузинская буква/).textContent!
          const ru = ask.match(/«(.+?)»/)![1]
          const geo = { а: 'ა', д: 'დ', р: 'რ' }[ru.toLowerCase() as 'а']
          fireEvent.click(screen.getAllByTestId('morph-choice').find(b => b.getAttribute('aria-label') === geo)!)
          if (screen.queryByText(/читается/)) fireEvent.click(screen.getByText(/следующее слово →|дальше →/))
          if (!screen.queryByText('Преврати слово в грузинское')) break
        }
      }
      answer()
    }
    await waitFor(() => expect(screen.getByText('Кафе Бомборы')).toBeTruthy())
    expect(api.completeLesson).toHaveBeenCalledWith({ moduleId: 'alphabet-progressive', lessonId: 1, correct: 10, total: 10 })
    expect(navigate).not.toHaveBeenCalled()
    // Первый гость — с подсказкой.
    expect(screen.getByTestId('cafe-howto').textContent).toContain('Гость заказывает по-грузински')
    expect(screen.getAllByTestId('cafe-pointer')).toHaveLength(1)

    // Закрыть игру — уже итог урока: прогресс сохранён.
    await act(async () => { fireEvent.click(screen.getByLabelText('Назад')) })
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ kind: 'result', correct: 10, total: 10 }))
  })

  it('in an even lesson plays «Собери слово» in the middle instead of «Превращение»', async () => {
    const qs = ['ე', 'ე', 'ი', 'ი', 'ს', 'ს', 'ეს', 'ის'].map((lemma, i) => ({ id: `e${i}`, lemma, question: `Вопрос ${i + 1}`, options: ['верно', 'неверно'], answerIndex: 0, explanation: '' }))
    api.lessonQuestions.mockResolvedValue(qs as any)
    render(<Practice moduleId="alphabet-progressive" lessonId={2} progress={defaultProgress} setProgress={() => {}} authenticated navigate={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('intro-skip')).toBeTruthy())
    for (let i = 0; i < 6; i++) { if (screen.queryByTestId('intro-skip')) skipIntro(); answer() }
    expect(screen.getByText('Собери грузинское слово')).toBeTruthy()
    expect(screen.queryByText('Преврати слово в грузинское')).toBeNull()
  })

  it('leaves other modules untouched', async () => {
    render(<Practice moduleId="numbers" lessonId={1} progress={defaultProgress} setProgress={() => {}} authenticated navigate={() => {}} />)
    await waitFor(() => expect(screen.getByText('Вопрос 1')).toBeTruthy())
    expect(screen.queryByTestId('intro-skip')).toBeNull()
  })
})
