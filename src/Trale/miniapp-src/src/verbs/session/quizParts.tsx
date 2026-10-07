import React from 'react'
import { cyr, type VerbSentenceDto } from '../types'

// Мелкие части экрана сцены-квиза (QuizScene.tsx): правила и повторяющиеся элементы разметки.

export const HELP = [
  'Я показываю слово и что оно значит — ты запоминаешь. Потом спрашиваю его.',
  'Ошибся — не страшно: скажу, что значит выбранное, и можно попробовать ещё раз.'
]
export const EXAM_HELP = [
  'Это экзамен: короткий, по главным словам глагола. На каждый вопрос — одна попытка.',
  'Сдашь — глагол выучен. Не сдашь — ничего страшного: слова, где ошибся, вернутся в игру.'
]

export const Geo = ({ children }: { children: React.ReactNode }) => <span className="font-geo font-bold text-jewelInk">{children}</span>

export function Prompt({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="mn-eyebrow text-navy">{eyebrow}</div>
      <div className="mt-3">{children}</div>
    </div>
  )
}

export function SentenceBox({ sentence }: { sentence: VerbSentenceDto }) {
  return (
    <div className="mt-6 rounded-xl bg-cream-tile border border-jewelInk/30 p-3">
      <div className="text-[11px] text-jewelInk-hint">например</div>
      <div className="mt-1 font-geo text-[17px] font-bold">{sentence.ka}</div>
      <div className="text-[12px] text-jewelInk-hint" data-testid="sentence-cyr">{cyr(sentence.ka)}</div>
      <div className="text-[13px] text-jewelInk-mid">{sentence.ru}</div>
    </div>
  )
}

export function ChipButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-2 rounded-lg bg-cream-tile border-[1.5px] border-jewelInk font-geo text-[17px] font-bold"
      style={{ boxShadow: '2px 2px 0 #15100A' }}
    >
      {children}
    </button>
  )
}
