import React, { useEffect, useState } from 'react'
import { useGiftHint } from '../api'
import { appEvents } from '../analytics/appEvents'
import { cachedStash, loadStash, onStash, setStash } from './stashStore'
import { buzz } from './sensors'
import './today.css'

// Подсказка из подарка дня: в упражнении подсвечивает верный ответ (или пару в игре «пары»).
// Кнопка видна, только когда подсказки есть. Тратится на сервере; на экране — сразу.

export function showHint(): boolean {
  const ok = document.querySelector<HTMLElement>('[data-testid="daily-warm-option"][data-ok="yes"], [data-testid="daily-back-option"][data-ok="yes"], [data-testid="daily-pick"][data-ok="yes"]')
  const targets: HTMLElement[] = []
  if (ok) targets.push(ok)
  else {
    const left = document.querySelector<HTMLElement>('[data-testid="daily-tile-l"][data-matched="no"]')
    const right = left && document.querySelector<HTMLElement>(`[data-testid="daily-tile-r"][data-matched="no"][data-key="${CSS.escape(left.dataset.key ?? '')}"]`)
    if (left && right) targets.push(left, right)
  }
  targets.forEach(t => { t.classList.remove('td-hint'); void t.offsetWidth; t.classList.add('td-hint') })
  return targets.length > 0
}

export default function HintButton() {
  const [hints, setHints] = useState(cachedStash().hints)
  useEffect(() => { loadStash(); return onStash(s => setHints(s.hints)) }, [])
  if (hints <= 0) return null

  async function use() {
    if (!showHint()) return
    buzz.success()
    appEvents.tap('daily-hint')
    const s = cachedStash()
    setStash({ ...s, hints: Math.max(0, s.hints - 1) })
    try { const r = await useGiftHint(); setStash({ ...cachedStash(), hints: r.hints }) } catch {}
  }

  // Встаёт справа в строку заголовка шага (StepTitle right): варианты ответа и счёт ничем не закрыты.
  return (
    <button type="button" onClick={use} aria-label={`Подсказка, осталось ${hints}`}
      className="flex shrink-0 items-center gap-1 self-center rounded-full border-[2px] border-jewelInk bg-gold py-1.5 pl-2 pr-2.5 font-sans text-[14px] font-extrabold text-jewelInk active:translate-y-[2px]"
      style={{ boxShadow: '2px 2px 0 #15100A' }} data-testid="daily-hint">
      <svg width="16" height="18" viewBox="0 0 60 60" aria-hidden="true"><path d="M30 6 a16 16 0 0 1 10 28 v6 H20 v-6 A16 16 0 0 1 30 6 Z" fill="#FCD76D" stroke="#15100A" strokeWidth="4" /><path d="M21 48 H39" stroke="#15100A" strokeWidth="5" strokeLinecap="round" /></svg>
      {hints}
    </button>
  )
}
