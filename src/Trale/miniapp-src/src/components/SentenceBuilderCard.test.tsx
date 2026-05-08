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
  describe('all non-preset slots filled → Проверить button is enabled', () => {
    it('Проверить is disabled initially when empty slots exist', () => {
      render(<SentenceBuilderCard question={l1Question} onAnswer={vi.fn()} />)
      const btn = screen.getByRole('button', { name: /Проверить/i })
      expect(btn).toHaveAttribute('aria-disabled', 'true')
    })

    it('Проверить becomes enabled after all empty slots are filled', async () => {
      const user = userEvent.setup()
      render(<SentenceBuilderCard question={l1Question} onAnswer={vi.fn()} />)

      // Select chip 'სახლში'
      await user.click(screen.getByRole('button', { name: 'სახლში' }))
      // Place it in the empty slot (slot-1)
      await user.click(screen.getByTestId('slot-1'))

      const btn = screen.getByRole('button', { name: /Проверить/i })
      expect(btn).not.toHaveAttribute('aria-disabled', 'true')
    })
  })

  describe('partially filled slots → Проверить button remains disabled', () => {
    it('Проверить stays disabled when only one of two empty slots is filled', async () => {
      const user = userEvent.setup()
      render(<SentenceBuilderCard question={l2Question} onAnswer={vi.fn()} />)

      // Fill only slot 1 (leaves slot 2 empty)
      await user.click(screen.getByRole('button', { name: 'მაღაზიაში' }))
      await user.click(screen.getByTestId('slot-1'))

      const btn = screen.getByRole('button', { name: /Проверить/i })
      expect(btn).toHaveAttribute('aria-disabled', 'true')
    })
  })

  describe('tapping filled non-preset slot → chip moves back to ChipPool', () => {
    it('chip returns to pool and slot becomes empty when tapped after filling', async () => {
      const user = userEvent.setup()
      render(<SentenceBuilderCard question={l1Question} onAnswer={vi.fn()} />)

      // Fill slot 1 with 'სახლში'
      await user.click(screen.getByRole('button', { name: 'სახლში' }))
      await user.click(screen.getByTestId('slot-1'))

      // Chip should now be in the slot; not in the pool area
      expect(within(screen.getByTestId('chip-pool')).queryByRole('button', { name: 'სახლში' })).toBeNull()

      // Tap the filled slot to return the chip
      await user.click(screen.getByTestId('slot-1'))

      // Chip should be back in the pool
      expect(screen.getByRole('button', { name: 'სახლში' })).toBeInTheDocument()

      // Slot should be empty again (Проверить disabled)
      const btn = screen.getByRole('button', { name: /Проверить/i })
      expect(btn).toHaveAttribute('aria-disabled', 'true')
    })
  })
})
