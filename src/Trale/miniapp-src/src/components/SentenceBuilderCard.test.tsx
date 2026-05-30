import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SentenceBuilderCard from './SentenceBuilderCard'
import { QuizQuestion } from '../types'

// L1 question: only slot 1 is empty (positions 0 and 2 are preset)
const l1Question: QuizQuestion = {
  id: 'q-l1',
  lemma: '',
  question: 'Я иду в дом',
  options: [],
  answerIndex: 0,
  explanation: '',
  questionType: 'sentence-builder',
  targetSentence: { ru: 'Я иду в дом' },
  level: 1,
  correctOrder: ['მე', 'სახლში', 'მივდივარ'],
  chipPool: ['სახლში', 'ვარ', 'გახვედი'],
  presetPositions: [
    { position: 0, token: 'მე' },
    { position: 2, token: 'მივდივარ' },
  ],
  hints: { '1': 'Постпозиция -ში стоит после существительного' },
}

// L2 question: slots 1 and 2 are empty (only position 0 is preset)
const l2Question: QuizQuestion = {
  id: 'q-l2',
  lemma: '',
  question: 'Ты идёшь в магазин',
  options: [],
  answerIndex: 0,
  explanation: '',
  questionType: 'sentence-builder',
  targetSentence: { ru: 'Ты идёшь в магазин' },
  level: 2,
  correctOrder: ['შენ', 'მაღაზიაში', 'მიდიხარ'],
  chipPool: ['მაღაზიაში', 'მიდიხარ', 'ვარ'],
  presetPositions: [{ position: 0, token: 'შენ' }],
  hints: {},
}

describe('SentenceBuilderCard', () => {
  describe('tap-only: chip tap auto-fills first empty slot', () => {
    it('Проверить is disabled initially when empty slots exist', () => {
      render(<SentenceBuilderCard question={l1Question} onAnswer={vi.fn()} />)
      const btn = screen.getByRole('button', { name: /Проверить/i })
      expect(btn).toHaveAttribute('aria-disabled', 'true')
    })

    it('Проверить becomes enabled after single chip tap (no slot click required)', async () => {
      const user = userEvent.setup()
      render(<SentenceBuilderCard question={l1Question} onAnswer={vi.fn()} />)

      // Single chip tap → auto-fills the only empty slot
      await user.click(screen.getByRole('button', { name: 'სახლში' }))

      const btn = screen.getByRole('button', { name: /Проверить/i })
      expect(btn).not.toHaveAttribute('aria-disabled', 'true')
    })
  })

  describe('tap-only: second chip fills next empty slot in order', () => {
    it('Проверить stays disabled when only one of two empty slots is filled', async () => {
      const user = userEvent.setup()
      render(<SentenceBuilderCard question={l2Question} onAnswer={vi.fn()} />)

      // First chip tap fills slot-1 (first empty slot)
      await user.click(screen.getByRole('button', { name: 'მაღაზიაში' }))

      const btn = screen.getByRole('button', { name: /Проверить/i })
      expect(btn).toHaveAttribute('aria-disabled', 'true')
    })
  })

  describe('tap-only: tapping filled slot returns chip to pool', () => {
    it('chip returns to pool and slot becomes empty when filled slot is tapped', async () => {
      const user = userEvent.setup()
      render(<SentenceBuilderCard question={l1Question} onAnswer={vi.fn()} />)

      // Tap chip → auto-fills slot-1
      await user.click(screen.getByRole('button', { name: 'სახლში' }))

      // Chip should be in slot, not in pool
      expect(within(screen.getByTestId('chip-pool')).queryByRole('button', { name: 'სახლში' })).toBeNull()

      // Tap filled slot to return chip
      await user.click(screen.getByTestId('slot-1'))

      // Chip back in pool
      expect(screen.getByRole('button', { name: 'სახლში' })).toBeInTheDocument()

      // Slot empty → Проверить disabled
      const btn = screen.getByRole('button', { name: /Проверить/i })
      expect(btn).toHaveAttribute('aria-disabled', 'true')
    })
  })

  describe('tap-only: no intermediate chip-selected state', () => {
    it('chip tap places chip in slot immediately; no bg-gold or chip-selected class in DOM', async () => {
      const user = userEvent.setup()
      render(<SentenceBuilderCard question={l1Question} onAnswer={vi.fn()} />)

      await user.click(screen.getByRole('button', { name: 'სახლში' }))

      // Chip placed in slot → no longer in pool
      expect(within(screen.getByTestId('chip-pool')).queryByRole('button', { name: 'სახლში' })).toBeNull()

      // No bg-gold (old selected state colour) in DOM
      expect(document.querySelector('.bg-gold')).toBeNull()

      // No chip-selected class anywhere
      expect(document.querySelector('.chip-selected')).toBeNull()
    })
  })
})

// L5 question: no preset slots, 4 tokens, 2 alternativeAnswers orderings
// correctOrder: ['მე', 'წიგნს', 'სახლში', 'ვკითხულობ']
// alternativeAnswers[0]: ['მე', 'სახლში', 'წიგნს', 'ვკითხულობ']
// alternativeAnswers[1]: ['წიგნს', 'მე', 'სახლში', 'ვკითხულობ']
const l5Question: QuizQuestion = {
  id: 'q-l5',
  lemma: '',
  question: 'Я читаю книгу дома',
  options: [],
  answerIndex: 0,
  explanation: '',
  questionType: 'sentence-builder',
  targetSentence: { ru: 'Я читаю книгу дома' },
  level: 5,
  correctOrder: ['მე', 'წიგნს', 'სახლში', 'ვკითხულობ'],
  chipPool: ['მე', 'წიგნს', 'სახლში', 'ვკითხულობ'],
  presetPositions: [],
  hints: {},
  alternativeAnswers: [
    ['მე', 'სახლში', 'წიგნს', 'ვკითხულობ'],
    ['წიგნს', 'მე', 'სახლში', 'ვკითხულობ'],
  ],
}

describe('alternativeAnswers — issue #968', () => {
  it('handleVerify_AcceptsCorrectOrder_Always: correctOrder always accepted as correct', async () => {
    const user = userEvent.setup()
    render(<SentenceBuilderCard question={l5Question} onAnswer={vi.fn()} />)

    // Tap chips in correctOrder: ['მე', 'წიგნს', 'სახლში', 'ვკითხულობ']
    await user.click(screen.getByRole('button', { name: 'მე' }))
    await user.click(screen.getByRole('button', { name: 'წიგნს' }))
    await user.click(screen.getByRole('button', { name: 'სახლში' }))
    await user.click(screen.getByRole('button', { name: 'ვკითხულობ' }))

    await user.click(screen.getByRole('button', { name: /Проверить/i }))

    // Should show correct — no "Должно было быть" text
    expect(screen.queryByText(/Должно было быть/i)).toBeNull()
    expect(screen.getByText('Отличная работа!')).toBeInTheDocument()
  })

  it('handleVerify_AcceptsAlternativeOrdering_AsCorrect: alternativeAnswers[0] accepted', async () => {
    const user = userEvent.setup()
    render(<SentenceBuilderCard question={l5Question} onAnswer={vi.fn()} />)

    // Tap in order matching alternativeAnswers[0]: ['მე', 'სახლში', 'წიგნს', 'ვკითხულობ']
    await user.click(screen.getByRole('button', { name: 'მე' }))
    await user.click(screen.getByRole('button', { name: 'სახლში' }))
    await user.click(screen.getByRole('button', { name: 'წიგნს' }))
    await user.click(screen.getByRole('button', { name: 'ვკითხულობ' }))

    await user.click(screen.getByRole('button', { name: /Проверить/i }))

    expect(screen.queryByText(/Должно было быть/i)).toBeNull()
    expect(screen.getByText('Отличная работа!')).toBeInTheDocument()
  })

  it('handleVerify_AcceptsSecondAlternative_AsCorrect: alternativeAnswers[1] accepted', async () => {
    const user = userEvent.setup()
    render(<SentenceBuilderCard question={l5Question} onAnswer={vi.fn()} />)

    // Tap in order matching alternativeAnswers[1]: ['წიგნს', 'მე', 'სახლში', 'ვკითხულობ']
    await user.click(screen.getByRole('button', { name: 'წიგნს' }))
    await user.click(screen.getByRole('button', { name: 'მე' }))
    await user.click(screen.getByRole('button', { name: 'სახლში' }))
    await user.click(screen.getByRole('button', { name: 'ვკითხულობ' }))

    await user.click(screen.getByRole('button', { name: /Проверить/i }))

    expect(screen.queryByText(/Должно было быть/i)).toBeNull()
    expect(screen.getByText('Отличная работа!')).toBeInTheDocument()
  })

  it('handleVerify_UnlistedOrdering_IsRejected: ordering not in correctOrder or alternativeAnswers rejected', async () => {
    const user = userEvent.setup()
    render(<SentenceBuilderCard question={l5Question} onAnswer={vi.fn()} />)

    // Tap in an unlisted order: ['სახლში', 'ვკითხულობ', 'მე', 'წიგნს']
    await user.click(screen.getByRole('button', { name: 'სახლში' }))
    await user.click(screen.getByRole('button', { name: 'ვკითხულობ' }))
    await user.click(screen.getByRole('button', { name: 'მე' }))
    await user.click(screen.getByRole('button', { name: 'წიგნს' }))

    await user.click(screen.getByRole('button', { name: /Проверить/i }))

    expect(screen.getByText(/Должно было быть/i)).toBeInTheDocument()
    expect(screen.queryByText('Отличная работа!')).toBeNull()
  })

  it('handleVerify_NoAlternativeAnswers_RejectsNonCorrectOrderAnswer: without alternativeAnswers non-matching rejected', async () => {
    const user = userEvent.setup()
    const questionWithoutAlt: QuizQuestion = { ...l5Question, alternativeAnswers: undefined }
    render(<SentenceBuilderCard question={questionWithoutAlt} onAnswer={vi.fn()} />)

    // Tap in order matching alternativeAnswers[0] (but alternativeAnswers is absent) → should be wrong
    await user.click(screen.getByRole('button', { name: 'მე' }))
    await user.click(screen.getByRole('button', { name: 'სახლში' }))
    await user.click(screen.getByRole('button', { name: 'წიგნს' }))
    await user.click(screen.getByRole('button', { name: 'ვკითხულობ' }))

    await user.click(screen.getByRole('button', { name: /Проверить/i }))

    expect(screen.getByText(/Должно было быть/i)).toBeInTheDocument()
    expect(screen.queryByText('Отличная работа!')).toBeNull()
  })
})
