import React, { useEffect } from 'react'
import Button from '../../components/Button'
import Mascot from '../../components/Mascot'
import { cyr, type VerbDto } from '../types'
import { STEP, type LadderItem, type Progress } from '../ladder/engine'
import { MeaningText } from '../parts'
import { SessionHeader } from '../ui/GameShell'
import { good } from '../ui/juice'
import InviteFriendLine from './InviteFriendLine'
import LevelBadge from './LevelBadge'
import type { ExamResult } from './QuizScene'
import { LEVEL_NAMES, LEVEL_ORDER, type VerbLevelKey, type VerbSessionSavedDto } from './types'

// Финиш сессии: должен ощущаться победой. Что сегодня было в игре — простыми фразами с их
// грузинскими словами, уровень глагола, награда и одна строка, зачем вернуться.

/** Сколько слов показываем: экран финиша — не таблица. */
const SHOWN = 5

interface Props {
  verb: VerbDto
  items: LadderItem[]
  /** Формы этой сессии: true — верно с первой попытки. */
  touched: Map<string, boolean>
  exam: ExamResult | null
  levelBefore: VerbLevelKey
  /** Ответ сервера; null — отчёт ещё не доехал (нет сети), он уйдёт позже. */
  saved: VerbSessionSavedDto | null
  progress: Progress
  onMore: () => void
  onDone: () => void
}

export default function Finish({ verb, items, touched, exam, levelBefore, saved, progress, onMore, onDone }: Props) {
  useEffect(() => { good(null, 'big') }, [])

  const level = saved?.state.level ?? levelBefore
  const levelUp = LEVEL_ORDER.indexOf(level) > LEVEL_ORDER.indexOf(levelBefore)
  const passed = !!exam && !!saved?.state.memory.examPassed
  const failed = !!exam && !passed

  const played = items.filter(i => touched.has(i.key))
  // Сначала то, что получилось с первого раза: финиш — про успех.
  const words = (failed ? exam!.missed : [...played.filter(i => touched.get(i.key)), ...played.filter(i => !touched.get(i.key))]).slice(0, SHOWN)
  const known = items.filter(i => (progress[i.key]?.step ?? STEP.NEW) > STEP.NEW).length

  const title = passed ? 'Экзамен сдан!' : failed ? 'Почти получилось' : levelUp ? 'Новый уровень!' : 'Отлично сыграно!'
  const line = passed
    ? `Глагол «${verb.ru}» выучен. Буду иногда напоминать его — на минуту, не больше.`
    : failed
      ? 'Экзамен пока не сдан — это не страшно. Эти слова вернулись в игру, сыграем с ними ещё:'
      : 'Вот что сегодня было в игре:'

  return (
    <div className="j-root flex flex-col min-h-[100dvh]" data-testid="session-finish" data-exam={passed ? 'passed' : failed ? 'failed' : 'none'}>
      <SessionHeader />
      <div className="px-5 flex-1 flex flex-col justify-center gap-4 py-4">
        <div className="text-center flex flex-col items-center gap-2 j-rise">
          <Mascot mood="cheer" size={112} className="j-hop" />
          <div className="text-[24px] font-extrabold text-navy j-pop">{title}</div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {saved && saved.xpEarned > 0 && (
              <span data-testid="session-xp" className="rounded-full border-[1.5px] border-jewelInk bg-gold px-3 py-0.5 text-[14px] font-extrabold j-pop">
                +{saved.xpEarned} XP
              </span>
            )}
            <span className={`rounded-full border border-jewelInk/40 px-3 py-1 ${levelUp ? 'bg-gold-wash j-glow' : 'bg-cream-tile'}`}>
              <LevelBadge level={level} />
            </span>
          </div>
          {levelUp && !passed && (
            <div className="text-[13px] text-jewelInk-mid" data-testid="session-level-up">
              Было «{LEVEL_NAMES[levelBefore]}» — стало «{LEVEL_NAMES[level]}».
            </div>
          )}
        </div>

        <div>
          <div className="text-[13px] text-jewelInk-mid text-center">{line}</div>
          {!passed && words.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5" data-testid="session-words">
              {words.map(i => (
                <div key={i.key} className="flex items-center justify-between gap-3 rounded-lg bg-cream-tile px-3 py-1.5 border border-cream-edge">
                  <span className="text-[14px] font-bold text-jewelInk min-w-0"><MeaningText meaning={i.meaning} /></span>
                  <span className="text-right shrink-0">
                    <span className="block font-geo text-[17px] font-bold leading-tight">{i.form}</span>
                    <span className="block text-[11px] text-jewelInk-hint leading-tight">{cyr(i.form)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-center text-[13px] text-jewelInk-mid" data-testid="session-comeback">
          {passed
            ? 'Хочешь — сыграй ещё, просто для удовольствия.'
            : <>Знакомых слов у этого глагола уже <b>{known}</b>. Загляни завтра — повторим за минуту.</>}
        </div>
        {!saved && (
          <div className="text-center text-[12px] text-jewelInk-hint" data-testid="session-offline">
            Нет связи — результат сохраню, как только она появится.
          </div>
        )}
      </div>

      <div className="px-5 flex flex-col gap-2" style={{ paddingBottom: 'calc(var(--safe-b, 0px) + 20px)' }}>
        {saved && <Button onClick={onMore}>Ещё одну</Button>}
        <Button variant={saved ? 'ghost' : 'primary'} onClick={onDone}>Готово</Button>
        {!failed && <InviteFriendLine />}
      </div>
    </div>
  )
}
