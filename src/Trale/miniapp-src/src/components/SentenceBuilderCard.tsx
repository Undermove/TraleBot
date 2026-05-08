import React from 'react'
import { QuizQuestion } from '../types'

interface Props {
  question: QuizQuestion
  onAnswer: (isCorrect: boolean) => void
}

// Stub — full implementation replaces this in the green commit
export default function SentenceBuilderCard(_props: Props) {
  return <div data-testid="sentence-builder-card">TODO</div>
}
