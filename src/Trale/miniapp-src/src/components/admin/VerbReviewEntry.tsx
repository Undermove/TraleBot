import { useEffect, useState } from 'react'
import { adminVerbs } from '../../api'
import { needsAttention } from './verbReview'

/** Вход на экран проверки глаголов от нейросети: одна кнопка и сколько глаголов ждут. */
export default function VerbReviewEntry({ onOpen }: { onOpen: () => void }) {
  const [waiting, setWaiting] = useState<number | null>(null)
  useEffect(() => {
    adminVerbs.modelMade().then(r => setWaiting(r.verbs.filter(needsAttention).length)).catch(() => {})
  }, [])

  return (
    <div className="mb-5">
      <div className="mn-eyebrow mb-2">Глаголы от нейросети</div>
      <button
        type="button" onClick={onOpen} data-testid="verb-review-entry"
        className="w-full min-h-[52px] px-4 rounded border-[1.5px] border-jewelInk bg-cream-tile font-sans text-[14px] font-extrabold text-jewelInk text-left flex items-center justify-between"
      >
        <span>Проверка глаголов{waiting === null ? '' : ` · ${waiting} ждут`}</span>
        <span aria-hidden className="text-jewelInk-hint">→</span>
      </button>
    </div>
  )
}
