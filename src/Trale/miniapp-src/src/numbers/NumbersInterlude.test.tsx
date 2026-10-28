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

const questions = [1, 2, 3, 4].map(i => ({ id: `q${i}`, lemma: 'ერთი', question: `Вопрос ${i}`, options: ['верно', 'неверно'], answerIndex: 0, explanation: '' }))

describe('numbers lesson: level game, then the check', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false })))
    api.lessonQuestions.mockResolvedValue(questions as never)
  })

  it('opens the level first: the first number to tap, no quiz yet', async () => {
    const { container } = render(<Practice moduleId="numbers" lessonId={1} progress={defaultProgress} setProgress={() => {}} authenticated navigate={() => {}} />)
    await waitFor(() => expect(container.querySelector('.nm #ex-tap')).toBeTruthy())
    expect(container.querySelector('#ex-tap')?.textContent).toBe('1')
    expect(screen.queryByText('Вопрос 1')).toBeNull()
  })

  it('leaves the level by the back button to the module', async () => {
    const navigate = vi.fn()
    const { container } = render(<Practice moduleId="numbers" lessonId={5} progress={defaultProgress} setProgress={() => {}} authenticated navigate={navigate} />)
    await waitFor(() => expect(container.querySelector('.nm .back')).toBeTruthy())
    await act(async () => { fireEvent.click(container.querySelector('.nm .back')!) })
    expect(navigate).toHaveBeenCalledWith({ kind: 'module', moduleId: 'numbers' })
  })

  it('lesson 11 stays an ordinary quiz', async () => {
    render(<Practice moduleId="numbers" lessonId={11} progress={defaultProgress} setProgress={() => {}} authenticated navigate={() => {}} />)
    await waitFor(() => expect(screen.getByText('Вопрос 1')).toBeTruthy())
  })
})
