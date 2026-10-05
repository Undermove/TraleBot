import React, { useState } from 'react'
import VerbSheet from '../VerbSheet'
import { cyr, type VerbFormHitDto } from '../types'

/**
 * Строка на итоге урока: «В этом уроке были глаголы» и до трёх глаголов, каждый открывает
 * свою карточку. Если глаголов в уроке не было (или к ним нет доступа) — ничего не рисует.
 */
export default function LessonVerbsLine({ verbs }: { verbs: VerbFormHitDto[] }) {
  const [open, setOpen] = useState<VerbFormHitDto | null>(null)
  if (verbs.length === 0) return null

  return (
    <div className="mt-6 w-full text-center" data-testid="lesson-verbs-line">
      <div className="mn-eyebrow text-navy mb-2">в этом уроке были глаголы</div>
      <div className="flex flex-wrap justify-center gap-2">
        {verbs.map(v => (
          <button
            key={v.verbId}
            onClick={() => setOpen(v)}
            data-testid="lesson-verbs-line-verb"
            className="jewel-pressable rounded-xl bg-navy-wash border-[1.5px] border-jewelInk px-3 py-1.5 text-left"
          >
            <span className="block font-geo text-[15px] font-bold text-jewelInk leading-tight">{v.title}</span>
            <span className="block text-[11px] text-jewelInk-mid leading-tight">{cyr(v.title)} · {v.ru}</span>
          </button>
        ))}
      </div>
      {open && (
        <VerbSheet
          verbId={open.verbId}
          highlight={{ tense: open.tense, person: open.person }}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}
