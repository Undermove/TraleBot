import React from 'react'
import Mascot from '../../components/Mascot'
import { haptic } from '../games/fx'
import { availableProducts, cafeLevel, georgianLetters, orderText } from './products'

/** Плитка «Кафе Бомборы» на карте модуля «Алфавит». Появляется после первого урока. */
export default function CafeTile({ completed, onOpen }: { completed: readonly number[] | undefined; onOpen: () => void }) {
  const level = cafeLevel(completed)
  if (level < 1) return null
  const examples = availableProducts(level).map(p => orderText(p, level)!).sort((a, b) => georgianLetters(b) - georgianLetters(a)).slice(0, 2)
  return (
    <button
      onClick={() => { haptic('tap'); onOpen() }}
      data-testid="cafe-tile"
      className="w-full mb-6 rounded-2xl border-[1.5px] border-jewelInk bg-gold-wash text-left flex items-center gap-3 px-3 py-2 overflow-hidden relative"
      style={{ boxShadow: '3px 3px 0 #15100A' }}
    >
      <div className="absolute top-0 inset-x-0 h-2.5 flex">
        {Array.from({ length: 14 }, (_, i) => <div key={i} className={`flex-1 ${i % 2 ? 'bg-cream' : 'bg-ruby'}`} />)}
      </div>
      <Mascot mood="cheer" size={72} className="shrink-0 mt-2" />
      <div className="flex-1 min-w-0 pt-2">
        <div className="mn-eyebrow text-ruby">игра</div>
        <div className="text-[18px] font-extrabold leading-tight">Кафе Бомборы</div>
        <div className="text-[13px] text-jewelInk-mid leading-snug">Гости заказывают буквами, которые ты уже знаешь: {examples.map((t, i) => <React.Fragment key={t}>{i > 0 && ', '}«<span className="font-geo">{t}</span>»</React.Fragment>)}</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0"><path d="M6 3 L12 8 L6 13" stroke="#15100A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  )
}
