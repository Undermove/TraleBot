import React from 'react'
import AudioPlayer from './AudioPlayer'
import { QuizQuestion } from '../types'

interface Props {
  question: QuizQuestion
  revealed: boolean
}

/**
 * «Послушай и выбери»: одна строка — кнопка записи слева, подпись и (после проверки) услышанная фраза
 * справа. Низкая карточка, чтобы варианты и объяснение после проверки помещались на экран телефона.
 */
export default function AudioChoiceCard({ question, revealed }: Props) {
  return (
    <div className="jewel-tile px-4 py-3 flex items-center gap-3" data-testid="audio-choice-card">
      <AudioPlayer url={question.audioUrl ?? ''} />
      <div className="min-w-0 flex-1">
        <div className="mn-eyebrow text-jewelInk-mid">Послушай и выбери</div>
        <div
          aria-live="polite"
          style={{ opacity: revealed ? 1 : 0, transition: 'opacity 200ms ease', minHeight: '1.4rem' }}
        >
          {question.transcript && (
            <span className="font-geo text-[18px] font-bold leading-tight text-jewelInk break-words">
              {question.transcript}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
