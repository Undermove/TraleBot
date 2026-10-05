import React, { useEffect, useState } from 'react'
import VerbSheet from '../VerbSheet'
import { Coach } from '../parts'
import { PULSE } from '../ui/GameShell'
import type { VerbFormHitDto } from '../types'
import { meaningOfHit } from '../meaning'

const HINT_KEY = 'verb_lesson_chip_hint_seen'

/**
 * «В этом вопросе был глагол» — строка под разбором ответа в уроке. Открывает карточку глагола
 * шторкой поверх урока, на лице и времени формы из вопроса.
 *
 * Рендерить только ПОСЛЕ ответа: в карточке все формы глагола, до ответа она его выдаёт.
 * Состояние шторки живёт здесь, поэтому со сменой вопроса (компонент размонтируется) она
 * закрывается сама и не переезжает на следующий вопрос.
 */
export default function LessonVerbChip({ hit }: { hit: VerbFormHitDto }) {
  const [open, setOpen] = useState(false)
  // Подсказка — один раз за всё время: при первом появлении строки в уроке.
  const [first] = useState(() => {
    try { return !localStorage.getItem(HINT_KEY) } catch { return false }
  })
  useEffect(() => {
    if (first) try { localStorage.setItem(HINT_KEY, '1') } catch {}
  }, [first])

  return (
    <div className="mt-3 flex flex-col gap-2">
      {first && <Coach>В вопросе был глагол. Нажми — увидишь, как он меняется.</Coach>}
      <button
        onClick={() => setOpen(true)}
        data-testid="lesson-verb-chip"
        className={`jewel-pressable w-full text-left rounded-xl bg-navy-wash border-[1.5px] border-jewelInk px-3 py-2 flex items-center gap-2.5 ${first && !open ? PULSE : ''}`}
      >
        <span className="shrink-0 mn-eyebrow text-navy">глагол</span>
        {/* Слово из вопроса и что оно значит: «ვწერდი — я писал(а)»; сам глагол назван в карточке. */}
        <span className="flex-1 min-w-0 truncate text-[13px] text-jewelInk-mid">
          <span className="font-geo text-[15px] font-bold text-jewelInk">{hit.form}</span>{' '}
          — {meaningOfHit(hit).text} <span className="text-jewelInk-hint">· {hit.ru}</span>
        </span>
        <span className="shrink-0 text-[12px] font-bold text-navy whitespace-nowrap">все слова →</span>
      </button>
      {open && (
        <VerbSheet
          verbId={hit.verbId}
          highlight={{ tense: hit.tense, person: hit.person }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
