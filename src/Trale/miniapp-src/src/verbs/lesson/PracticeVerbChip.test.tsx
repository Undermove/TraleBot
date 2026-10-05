import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Practice from '../../screens/Practice'
import { defaultProgress } from '../../progress'
import { hit, writeVerb } from './fixtures'

// Три вопроса урока в том виде, в каком их отдаёт сервер: у первых двух размечен глагол, у третьего нет.
const questions = [
  { id: 'q1', question: 'Как сказать «я пишу»?', options: ['ვწერ', 'წერს'], answerIndex: 0, explanation: '', verb: hit('ვწერ', 'present', 0) },
  { id: 'q2', question: 'Как сказать «он писал»?', options: ['წერდა', 'ვწერდი'], answerIndex: 0, explanation: '', verb: hit('წერდა', 'imperfect', 2) },
  { id: 'q3', question: 'Сколько падежей в грузинском?', options: ['семь', 'шесть'], answerIndex: 0, explanation: '', verb: null }
]

vi.mock('../../api', () => ({
  api: { lessonQuestions: vi.fn(() => Promise.resolve(questions)) },
  fetchVerb: vi.fn(() => Promise.resolve(writeVerb))
}))

const navigate = vi.fn()

async function openLesson() {
  render(
    <Practice
      moduleId="present-tense" lessonId={1} progress={defaultProgress} setProgress={() => {}}
      authenticated={false} navigate={navigate}
    />
  )
  await screen.findByText(questions[0].question)
}

const chip = () => screen.queryByTestId('lesson-verb-chip')
const answer = (option: string) => {
  fireEvent.click(screen.getByText(option))
  fireEvent.click(screen.getByText('проверить'))
}
const nextQuestion = () => fireEvent.click(screen.getByText('дальше →'))

describe('verb chip in lesson practice', () => {
  beforeEach(() => { localStorage.clear(); navigate.mockClear() })

  it('appears only after the answer is checked', async () => {
    await openLesson()
    expect(chip()).toBeNull()

    fireEvent.click(screen.getByText('ვწერ'))
    expect(chip()).toBeNull()

    fireEvent.click(screen.getByText('проверить'))
    expect(chip()!.textContent).toContain('წერა')
    expect(chip()!.textContent).toContain('писать')
  })

  it('appears after a wrong answer too', async () => {
    await openLesson()

    answer('წერს')

    expect(chip()).not.toBeNull()
  })

  it('opens the verb card on the tense and person of the form from the question', async () => {
    await openLesson()
    answer('ვწერ')
    nextQuestion()
    answer('წერდა')

    fireEvent.click(chip()!)

    const row = await screen.findByTestId('verb-tense-imperfect')
    expect(row.className).toContain('bg-gold-wash')
    expect(row.textContent).toContain('წერდა')
    expect(screen.getByTestId('verb-tense-present').className).not.toContain('bg-gold-wash')
  })

  it('returns to the same answered question when the card is closed', async () => {
    await openLesson()
    answer('ვწერ')
    fireEvent.click(chip()!)
    await screen.findByTestId('verb-tense-present')

    fireEvent.click(screen.getByTestId('verb-sheet'))

    await waitFor(() => expect(screen.queryByTestId('verb-sheet')).toBeNull())
    expect(screen.getByText(questions[0].question)).toBeTruthy()
    expect(screen.getByText('дальше →')).toBeTruthy()
    expect(chip()).not.toBeNull()
  })

  it('is gone on the next question until that one is answered', async () => {
    await openLesson()
    answer('ვწერ')

    nextQuestion()

    expect(screen.getByText(questions[1].question)).toBeTruthy()
    expect(chip()).toBeNull()
    expect(screen.queryByTestId('verb-sheet')).toBeNull()
  })

  it('does not appear for a question without a catalog verb', async () => {
    await openLesson()
    answer('ვწერ'); nextQuestion()
    answer('წერდა'); nextQuestion()

    answer('семь')

    expect(chip()).toBeNull()
  })

  it('explains itself once: the hint is shown with the first chip only', async () => {
    await openLesson()
    answer('ვწერ')
    expect(screen.getByText(/В вопросе был глагол/)).toBeTruthy()

    nextQuestion()
    answer('წერდა')

    expect(chip()).not.toBeNull()
    expect(screen.queryByText(/В вопросе был глагол/)).toBeNull()
  })
})
