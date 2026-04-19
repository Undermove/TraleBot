import React, { useState } from 'react'

interface Props {
  onStartQuiz: () => void
}

const SEEN_KEY = 'vocab_first_open'

export default function FirstVocabBanner({ onStartQuiz }: Props) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(SEEN_KEY) === 'seen'
  )

  if (dismissed) return null

  function dismiss() {
    localStorage.setItem(SEEN_KEY, 'seen')
    setDismissed(true)
  }

  function handleStartQuiz() {
    dismiss()
    onStartQuiz()
  }

  return (
    <div className="jewel-tile mx-4 mb-3 border-navy">
      <div className="relative z-[1] px-4 py-4">
        <button
          onClick={dismiss}
          className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center text-jewelInk/50 hover:text-jewelInk active:scale-95 transition-transform"
          aria-label="Закрыть"
        >
          ×
        </button>
        <div className="flex items-start gap-3 pr-6">
          <span className="text-[22px] leading-none mt-0.5">📖</span>
          <div className="flex-1 min-w-0">
            <div className="font-sans text-[15px] font-extrabold text-jewelInk leading-tight">
              Твои переводы уже здесь
            </div>
            <div className="font-sans text-[13px] text-jewelInk-mid mt-1 leading-snug">
              Все слова, которые ты переводил в боте, собраны в один словарь. Хочешь закрепить?
            </div>
          </div>
        </div>
        <button
          onClick={handleStartQuiz}
          className="jewel-btn mt-3 w-full py-3 font-sans text-[14px] font-bold text-cream bg-navy rounded-xl active:scale-95 transition-transform"
        >
          Начать квиз
        </button>
      </div>
    </div>
  )
}
