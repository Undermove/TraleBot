import React from 'react'
import AudioPlayer from './AudioPlayer'
import { QuizQuestion } from '../types'

interface Props {
  question: QuizQuestion
  revealed: boolean
}

export default function AudioChoiceCard({ question, revealed }: Props) {
  return (
    <div className="jewel-tile px-5 py-4 flex flex-col gap-3">
      <div className="mn-eyebrow text-jewelInk-mid">Послушай и выбери</div>
      <AudioPlayer url={question.audioUrl ?? ''} />
      <div
        aria-live="polite"
        style={{
          opacity: revealed ? 1 : 0,
          transition: 'opacity 200ms ease',
          minHeight: '1.5rem',
        }}
      >
        {question.transcript && (
          <span className="font-geo text-[20px] font-bold text-jewelInk">
            {question.transcript}
          </span>
        )}
      </div>
    </div>
  )
}
