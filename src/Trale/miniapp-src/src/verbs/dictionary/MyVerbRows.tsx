import React from 'react'
import LevelBadge from '../session/LevelBadge'
import type { MyVerbDto } from '../types'

// Словарь под фильтром «глаголы»: одна строка на глагол, а не на каждое сохранённое слово.
// «Мои глаголы» = глаголы, чьи формы есть в словаре, и глаголы, с которыми человек уже играл
// (из урока или перевода), даже если в словарь он их не сохранял.

export default function MyVerbRows({ verbs, onOpen }: { verbs: MyVerbDto[]; onOpen: (verb: MyVerbDto) => void }) {
  return (
    <>
      {verbs.map(verb => (
        <button
          key={verb.id}
          data-testid={`my-verb-${verb.id}`}
          onClick={() => onOpen(verb)}
          className="jewel-tile jewel-pressable flex items-center gap-3 min-h-[56px] px-4 py-3 text-left"
          role="listitem"
        >
          <span className="relative z-[1] flex-1 min-w-0">
            <span className="block truncate leading-tight">
              <span className="font-geo text-[18px] font-bold text-jewelInk">{verb.title}</span>
              <span className="font-sans text-[13px] text-jewelInk-mid"> · {verb.ru}</span>
            </span>
            <span className="block font-sans text-[12px] text-jewelInk-mid truncate leading-snug mt-0.5" data-testid="saved-forms">
              {verb.saved.length
                ? <>в словаре: <span className="font-geo">{verb.saved.map(f => f.form).join(', ')}</span></>
                : 'начат в игре, в словаре пока нет'}
            </span>
          </span>
          <span className="relative z-[1] shrink-0"><LevelBadge level={verb.level} compact /></span>
        </button>
      ))}
    </>
  )
}

/** Подходит ли глагол под строку поиска: по названию, переводу или сохранённой форме. */
export function matchesVerb(verb: MyVerbDto, search: string) {
  const q = search.trim().toLowerCase()
  if (!q) return true
  return [verb.title, verb.ru, ...verb.saved.map(f => f.form)].some(s => s.toLowerCase().includes(q))
}
