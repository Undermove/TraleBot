import React, { useEffect, useState } from 'react'
import { devDailyPush, devNextDay } from '../api'
import type { Screen } from '../types'
import { cardLine, streakLine } from './logic'
import { cachedDaily, loadDaily, onDaily, setDaily } from './store'
import type { DailyTaskDto } from './types'

/** Значок задания: листок календаря с галочкой — рисуем сами, без эмодзи. */
const DayIcon = ({ done }: { done: boolean }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    {done ? <path d="M8.5 14.8l2.4 2.4 4.6-4.6" /> : <path d="M12 12.5v3.2l2 1.3" />}
  </svg>
)

/**
 * Первая карточка главной: задание на сегодня, потом — «новое» после него, потом — «сделано».
 * Без доступа и без материала для задания карточки нет.
 */
export default function DailyCard({ navigate }: { navigate: (s: Screen) => void }) {
  const [task, setTask] = useState<DailyTaskDto | null>(cachedDaily)
  const [devNote, setDevNote] = useState<string | null>(null)

  useEffect(() => {
    loadDaily().catch(() => {})
    return onDaily(setTask)
  }, [])

  if (!task) return null

  const offer = task.done && task.offer && !task.offerTaken ? task.offer : null
  const finished = task.done && !offer
  const eyebrow = !task.done ? 'Задание дня' : offer ? 'Задание дня · сделано' : 'Задание дня'
  const title = !task.done ? task.title : offer ? offer.title : 'Сделано сегодня'
  const line = !task.done ? cardLine(task) : offer ? offer.line : `${streakLine(task.result?.streak ?? 0)}. Завтра будет новое.`

  async function dev(action: () => Promise<{ task?: DailyTaskDto; ok?: boolean }>, note: string) {
    setDevNote('…')
    try {
      const r = await action()
      if (r.task) setDaily(r.task.available ? r.task : null)
      setDevNote(r.ok === false ? 'задание уже сделано — сообщения нет' : note)
    } catch {
      setDevNote('не получилось')
    }
  }

  return (
    <>
      <button
        data-testid="dashboard-daily" data-state={!task.done ? 'todo' : offer ? 'offer' : 'done'}
        onClick={() => navigate({ kind: 'daily' })}
        className="jewel-tile jewel-pressable mt-4 w-full text-left px-5 py-4 flex items-center gap-4"
      >
        <div className="relative z-[1] shrink-0">
          <div
            className={`w-12 h-12 rounded-xl border-[1.5px] border-jewelInk flex items-center justify-center ${finished ? 'bg-navy text-cream' : 'bg-gold text-jewelInk'}`}
            style={{ boxShadow: '2px 2px 0 #15100A' }}
          >
            <DayIcon done={task.done} />
          </div>
        </div>
        <div className="flex-1 min-w-0 relative z-[1]">
          <div className="mn-eyebrow text-ruby mb-0.5 truncate">{eyebrow}</div>
          <div className="font-sans text-[16px] font-bold text-jewelInk leading-tight truncate" data-testid="dashboard-daily-title">{title}</div>
          <div className="font-sans text-[12px] text-jewelInk-mid mt-0.5 line-clamp-2" data-testid="dashboard-daily-line">{line}</div>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 text-ruby relative z-[1]">
          <path d="M8 5 L16 12 L8 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {task.dev && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-x-1 text-[12px] font-semibold text-jewelInk-hint" data-testid="daily-dev">
          <span>стенд:</span>
          <button className="min-h-[44px] px-1.5 underline" onClick={() => dev(() => devNextDay(1), 'наступил следующий день')}>+1 день</button>
          <span>·</span>
          <button className="min-h-[44px] px-1.5 underline" onClick={() => dev(() => devNextDay(7), 'прошла неделя')}>+7 дней</button>
          <span>·</span>
          <button className="min-h-[44px] px-1.5 underline" onClick={() => dev(devDailyPush, 'сообщение отправлено')}>сообщение бота</button>
          {devNote && <span className="w-full text-center" data-testid="daily-dev-note">{devNote}</span>}
        </div>
      )}
    </>
  )
}
