import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { api as mocked } from '../api'
import Practice from '../screens/Practice'
import { defaultProgress } from '../progress'
import { __setLessonEventSender, flushLessonEvents, type LessonEventDto } from '../analytics/lessonEvents'

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
}

let sent: LessonEventDto[] = []
const trail = () => { flushLessonEvents(); return sent.map(e => `${e.step}:${e.stepKind}:${e.event}${e.value != null ? '=' + e.value : ''}`) }

describe('alphabet lesson as a chain of games', () => {
  beforeEach(() => {
    sent = []
    __setLessonEventSender(events => { sent.push(...events) })
    localStorage.clear()
    // Записи слов: в jsdom <audio> не играет.
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    api.lessonQuestions.mockResolvedValue(questions as any)
    api.recordAnswer.mockResolvedValue({ xpEarned: 1, progress: {} } as any)
    api.completeLesson.mockResolvedValue({ xpEarned: 20, progress: {} } as any)
    api.addAlphabetWords.mockResolvedValue({ words: [], added: 0 } as any)
  })

  it('letters lesson 1: three letters with letter games, then a check of one question per letter that counts the lesson', async () => {
    const navigate = vi.fn()
    render(<Practice moduleId="alphabet-progressive" lessonId={1} progress={defaultProgress} setProgress={() => {}} authenticated navigate={navigate} />)

    await waitFor(() => expect(screen.getByText(/новая буква · 1 из 3/)).toBeTruthy())
    skipIntro()
    expect(screen.getByText(/новая буква · 2 из 3/)).toBeTruthy()
    skipIntro()

    // «Поймай букву»: лопаем только нужные пузыри; в первом раунде они подсвечены.
    expect(screen.getByText('Поймай букву')).toBeTruthy()
    for (let round = 0; round < 2; round++) {
      await waitFor(() => expect(screen.getByText(new RegExp(`поймай букву · ${round + 1} из 2`))).toBeTruthy(), { timeout: 3000 })
      const targets = screen.getAllByTestId('catch-bubble').filter(b => b.dataset.target === 'yes')
      if (round === 0) expect(targets.every(b => b.className.includes('ring-gold'))).toBe(true)
      for (const b of targets) fireEvent.pointerDown(b)
    }
    await waitFor(() => expect(screen.getByText(/новая буква · 3 из 3/)).toBeTruthy(), { timeout: 4000 })
    skipIntro()

    // «Пары»: буква ↔ её звук.
    expect(screen.getByText('Пары')).toBeTruthy()
    for (const pair of ['p0', 'p1', 'p2']) {
      const [a, b] = screen.getAllByTestId('pair-card').filter(c => c.dataset.pair === pair)
      fireEvent.click(a); fireEvent.click(b)
      await waitFor(() => expect(a.dataset.shown).toBe('yes'))
      await new Promise(r => setTimeout(r, 300))
    }

    // Проверка: последний вопрос о каждой букве урока; прогресс — как раньше, по ним.
    await waitFor(() => expect(screen.getByText('Вопрос 2')).toBeTruthy(), { timeout: 3000 })
    for (let i = 0; i < 3; i++) answer()
    await waitFor(() => expect(api.completeLesson).toHaveBeenCalledWith({ moduleId: 'alphabet-progressive', lessonId: 1, correct: 3, total: 3 }))
    await waitFor(() => expect(screen.getByTestId('alphabet-finale')).toBeTruthy())
    expect(api.addAlphabetWords).not.toHaveBeenCalled()

    // Аналитика хода урока: каждый шаг начат и пройден, «пропустить» в знакомстве с буквой, проверка, засчитан.
    expect(trail()).toEqual([
      '1:letter-intro:step_start', '1:letter-intro:step_skip', '1:letter-intro:step_done',
      '2:letter-intro:step_start', '2:letter-intro:step_skip', '2:letter-intro:step_done',
      '3:catch:step_start', '3:catch:step_done',
      '4:letter-intro:step_start', '4:letter-intro:step_skip', '4:letter-intro:step_done',
      '5:pairs:step_start', '5:pairs:step_done',
      '6:check:step_start', '6:check:step_done=3', '6:check:lesson_complete=3',
      '7:finale:step_start'
    ])
  }, 20_000)

  it('words lesson 12: every new word gets its own scene (no «ещё слова» list), then word games and a 4-question check', async () => {
    const wordQs = ['და', 'არა', 'რა', 'და'].map((lemma, i) => ({ id: `w${i}`, lemma, question: `Слово ${i + 1}`, options: ['верно', 'неверно'], answerIndex: 0, explanation: '' }))
    api.lessonQuestions.mockResolvedValue(wordQs as any)
    render(<Practice moduleId="alphabet-progressive" lessonId={12} progress={defaultProgress} setProgress={() => {}} authenticated navigate={() => {}} />)
    await waitFor(() => expect(screen.getByText('Тебе хватает букв, чтобы прочитать новое слово!')).toBeTruthy())
    const seen: string[] = []
    while (screen.queryByTestId('word-skip')) {
      seen.push(screen.getAllByTestId('word-tile').map(t => t.textContent).join(''))
      fireEvent.click(screen.getByTestId('word-skip'))
      await act(async () => { fireEvent.click(screen.getByText('в словарь →')) })
    }
    expect(seen).toEqual(['და', 'არა', 'რა'])
    expect(screen.queryByTestId('word-list')).toBeNull()
    // Дальше — игры со словами (первая в первом уроке слов — «Пары» слово ↔ значение).
    expect(screen.getByTestId('pairs')).toBeTruthy()
  }, 20_000)

  it('leaving a game goes back to the lesson theory', async () => {
    const navigate = vi.fn()
    const { unmount } = render(<Practice moduleId="alphabet-progressive" lessonId={1} progress={defaultProgress} setProgress={() => {}} authenticated navigate={navigate} />)
    await waitFor(() => expect(screen.getByTestId('intro-skip')).toBeTruthy())
    fireEvent.click(screen.getByLabelText('Назад'))
    expect(navigate).toHaveBeenCalledWith({ kind: 'lesson-theory', moduleId: 'alphabet-progressive', lessonId: 1 })
    unmount()
    // Ушёл посреди урока — «выход» на том шаге, где был.
    expect(trail()).toEqual(['1:letter-intro:step_start', '1:letter-intro:lesson_exit'])
  })

  it('leaves other modules untouched', async () => {
    render(<Practice moduleId="numbers" lessonId={1} progress={defaultProgress} setProgress={() => {}} authenticated navigate={() => {}} />)
    await waitFor(() => expect(screen.getByText('Вопрос 1')).toBeTruthy())
    expect(screen.queryByTestId('intro-skip')).toBeNull()
  })
})
