import React from 'react'
import { cyr, type VerbDto } from './types'

// «Не путать» на карточке глагола: глаголы, которые по-русски звучат похоже, а значат чуть разное
// (scripts/verbs/confusables.json). Строка на каждый глагол группы — перевод, форма «я» и в чём разница;
// этот глагол отмечен, остальные открываются в той же карточке.

/** Знак «не равно»: похоже, но не то же самое. */
export function ConfusableIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M3 6h10M3 10h10M10.5 2.5l-5 11" />
    </svg>
  )
}

interface Props {
  verb: VerbDto
  onOpenVerb: (verbId: string) => void
}

export default function ConfusableNote({ verb, onOpenVerb }: Props) {
  const group = verb.confusable ?? []
  return (
    <div className="rounded-xl bg-cream-tile border border-jewelInk/40 p-3 flex flex-col gap-2.5" data-testid="verb-confusable">
      <div className="text-[13px] font-bold text-jewelInk">По-русски похоже, а значат чуть разное</div>
      {group.map(m => {
        const self = m.id === verb.id
        const line = (
          <>
            <span className="block">
              <span className="text-[14px] font-extrabold text-navy">{m.ru}</span>{' '}
              <span className="font-geo text-[15px] font-bold text-jewelInk">{m.present[0]}</span>{' '}
              <span className="text-[12px] text-jewelInk-hint">[{cyr(m.present[0] ?? '')}]</span>
              {self && <span className="ml-1.5 text-[11px] font-bold text-jewelInk-mid">этот глагол</span>}
            </span>
            <span className="block text-[13px] text-jewelInk-soft">{m.note}</span>
          </>
        )
        return self ? (
          <div key={m.id} data-testid="verb-confusable-self" className="text-left rounded-lg border-l-[3px] border-navy pl-2.5">{line}</div>
        ) : (
          <button key={m.id} data-testid="verb-confusable-other" onClick={() => onOpenVerb(m.id)}
            className="text-left rounded-lg border-l-[3px] border-jewelInk/20 pl-2.5 min-h-[44px]">
            {line}
            <span className="block text-[12px] text-navy underline">открыть</span>
          </button>
        )
      })}
    </div>
  )
}
