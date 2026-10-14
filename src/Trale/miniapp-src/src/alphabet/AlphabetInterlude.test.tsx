import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { api as mocked } from '../api'
import Practice from '../screens/Practice'
import { defaultProgress } from '../progress'

vi.mock('../api', () => ({
  api: { lessonQuestions: vi.fn(), recordAnswer: vi.fn(), completeLesson: vi.fn(), addAlphabetWords: vi.fn() },
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
/** «Новое слово»: пропустить каждое слово сцены и отправить его в словарь. */
async function skipWords() {
  while (screen.queryByTestId('word-skip')) {
    fireEvent.click(screen.getByTestId('word-skip'))
    await act(async () => { fireEvent.click(screen.getByText('в словарь →')) })
  }
  if (screen.queryByTestId('word-list')) fireEvent.click(screen.getByText('дальше →'))
}

describe('alphabet lesson as a chain of games', () => {
  beforeEach(() => {
    localStorage.clear()
    // Записи слов: в jsdom <audio> не играет.
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    api.lessonQuestions.mockResolvedValue(questions as any)
    api.recordAnswer.mockResolvedValue({ xpEarned: 1, progress: {} } as any)
    api.completeLesson.mockResolvedValue({ xpEarned: 20, progress: {} } as any)
    api.addAlphabetWords.mockResolvedValue({ words: [], added: 0 } as any)
  })

  it('lesson 1: letters, «Поймай букву», «Пары», new words, «Превращение», then a 4-question check that counts the lesson', async () => {
    const navigate = vi.fn()
    render(<Practice moduleId="alphabet-progressive" lessonId={1} progress={defaultProgress} setProgress={() => {}} authenticated navigate={navigate} />)

    await waitFor(() => expect(screen.getByText(/новая буква · 1 из 3/)).toBeTruthy())
    skipIntro()
    expect(screen.getByText(/новая буква · 2 из 3/)).toBeTruthy()
    skipIntro()

    // «Поймай букву»: лопаем только нужные пузыри; в первом раунде они подсвечены.
    expect(screen.getByText('Поймай букву')).toBeTruthy()
    for (let round = 0; round < 2; round++) {
      await waitFor(() => expect(screen.getByText(new RegExp(`поймай букву · ${round + 1} из 2`))).toBeTruthy(), { timeout: 2000 })
      const targets = screen.getAllByTestId('catch-bubble').filter(b => b.dataset.target === 'yes')
      if (round === 0) expect(targets.every(b => b.className.includes('ring-gold'))).toBe(true)
      for (const b of targets) fireEvent.pointerDown(b)
    }
    await waitFor(() => expect(screen.getByText(/новая буква · 3 из 3/)).toBeTruthy(), { timeout: 3000 })
    skipIntro()

    // «Пары»: буква ↔ её звук.
    expect(screen.getByText('Пары')).toBeTruthy()
    for (const pair of ['p0', 'p1', 'p2']) {
      const [a, b] = screen.getAllByTestId('pair-card').filter(c => c.dataset.pair === pair)
      fireEvent.click(a); fireEvent.click(b)
      await waitFor(() => expect(a.dataset.shown).toBe('yes'))
      await new Promise(r => setTimeout(r, 300))
    }

    // Новые слова урока — до любых вопросов о них.
    await waitFor(() => expect(screen.getByText('Тебе хватает букв, чтобы прочитать новое слово!')).toBeTruthy(), { timeout: 3000 })
    await skipWords()

    // «Превращение»: из звучания в грузинские буквы.
    expect(screen.getByText('Преврати слово в грузинское')).toBeTruthy()
    const geo: Record<string, string> = { а: 'ა', д: 'დ', р: 'რ' }
    while (screen.queryAllByTestId('morph-choice').length) {
      const ru = screen.getByText(/Какая грузинская буква/).textContent!.match(/«(.+?)»/)![1]
      fireEvent.click(screen.getAllByTestId('morph-choice').find(b => b.getAttribute('aria-label') === geo[ru])!)
      if (screen.queryByTestId('morph-meaning')) fireEvent.click(screen.getByText(/следующее слово →|дальше →/))
    }
    if (screen.queryByTestId('morph-meaning')) fireEvent.click(screen.getByText(/дальше →/))

    // Проверка: последние 4 вопроса урока; прогресс — как раньше, по ним.
    await waitFor(() => expect(screen.getByText('Вопрос 7')).toBeTruthy())
    for (let i = 0; i < 4; i++) answer()
    await waitFor(() => expect(api.completeLesson).toHaveBeenCalledWith({ moduleId: 'alphabet-progressive', lessonId: 1, correct: 4, total: 4 }))
    await waitFor(() => expect(screen.getByTestId('alphabet-finale')).toBeTruthy())
    expect(api.addAlphabetWords).toHaveBeenCalledWith(1)
  }, 15_000)

  it('leaving a game goes back to the lesson theory', async () => {
    const navigate = vi.fn()
    render(<Practice moduleId="alphabet-progressive" lessonId={1} progress={defaultProgress} setProgress={() => {}} authenticated navigate={navigate} />)
    await waitFor(() => expect(screen.getByTestId('intro-skip')).toBeTruthy())
    fireEvent.click(screen.getByLabelText('Назад'))
    expect(navigate).toHaveBeenCalledWith({ kind: 'lesson-theory', moduleId: 'alphabet-progressive', lessonId: 1 })
  })

  it('leaves other modules untouched', async () => {
    render(<Practice moduleId="numbers" lessonId={1} progress={defaultProgress} setProgress={() => {}} authenticated navigate={() => {}} />)
    await waitFor(() => expect(screen.getByText('Вопрос 1')).toBeTruthy())
    expect(screen.queryByTestId('intro-skip')).toBeNull()
  })
})
