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

const questions = [1, 2, 3, 4].map(i => ({ id: `q${i}`, lemma: 'ვიღვიძებ', question: `Вопрос ${i}`, options: ['верно', 'неверно'], answerIndex: 0, explanation: '' }))

describe('my day lesson: game first, then the check', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false })))
    api.lessonQuestions.mockResolvedValue(questions as never)
  })

  it('opens the game with its steps, no quiz yet', async () => {
    const { container } = render(<Practice moduleId="my-day" lessonId={1} progress={defaultProgress} setProgress={() => {}} authenticated navigate={() => {}} />)
    await waitFor(() => expect(container.querySelector('.md .lvl')).toBeTruthy())
    expect(container.querySelector('.md .lvl')?.textContent).toContain('Шаг 1 из 4')
    expect(container.querySelectorAll('.md .steps i')).toHaveLength(4)
    expect(screen.queryByText('Вопрос 1')).toBeNull()
  })

  it('leaves the game by the back button to the module', async () => {
    const navigate = vi.fn()
    const { container } = render(<Practice moduleId="my-day" lessonId={2} progress={defaultProgress} setProgress={() => {}} authenticated navigate={navigate} />)
    await waitFor(() => expect(container.querySelector('.md .back')).toBeTruthy())
    await act(async () => { fireEvent.click(container.querySelector('.md .back')!) })
    expect(navigate).toHaveBeenCalledWith({ kind: 'module', moduleId: 'my-day' })
  })
})
