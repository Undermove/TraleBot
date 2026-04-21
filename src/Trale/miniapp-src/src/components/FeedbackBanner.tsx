import React from 'react'

interface Props {
  isCorrect: boolean
  body: React.ReactNode
  topMargin?: string
}

export default function FeedbackBanner({ isCorrect, body, topMargin = 'mt-4' }: Props) {
  return (
    <div
      className={`${topMargin} p-4 border-[1.5px] rounded-xl relative ${
        isCorrect
          ? 'bg-navy border-jewelInk text-cream'
          : 'bg-ruby border-jewelInk text-cream'
      }`}
      style={{ boxShadow: '2px 2px 0 #15100A' }}
    >
      <div className="mb-2">
        <div className="font-geo text-[26px] font-bold leading-tight">
          {isCorrect ? 'სწორია!' : 'არასწორია!'}
        </div>
        <div className="font-sans text-[11px] tracking-wide opacity-60">
          {isCorrect ? 'swor·ia' : 'ara·swor·ia'}
        </div>
        <div className="font-sans text-[11px] font-extrabold uppercase tracking-widest opacity-75 mt-0.5">
          {isCorrect ? 'Верно' : 'Ошибка'}
        </div>
      </div>
      <div className="font-sans text-[14px] leading-snug opacity-90">{body}</div>
    </div>
  )
}
