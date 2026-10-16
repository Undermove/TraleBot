import React, { useState } from 'react'
import Button from '../components/Button'
import Mascot from '../components/Mascot'
import '../alphabet/games/alphabet.css'
import { BackIcon } from '../alphabet/games/GameFrame'
import { haptic } from '../alphabet/games/fx'
import { ACTS, INTRO_TOTAL, actOf, geoName, hasUsableName, introLesson, newPhrases, saveName, type IntroStep } from './story'
import { transliterateToGeorgian } from '../utils/georgianizerName'
import { cyr } from '../verbs/types'

/** Как сцена называется в плане урока на стартовом экране. */
export const STEP_TITLE: Record<IntroStep['kind'], string> = {
  phrase: 'Новые фразы', rule: 'Находка правила', walk: 'Прогулка', bakery: 'Пекарня', pingpong: 'Пинг-понг', minibus: 'Маршрутка', party: 'Вечеринка',
  magnets: 'Наклейки окончаний', reception: 'Ресепшн', detective: 'Кто есть кто', chat: 'Чат с Нино', taxi: 'Такси',
  family: 'Семейный альбом', havesort: 'Живое или вещь', aboutme: 'Обо мне', supra: 'Супра'
}

/**
 * Начало урока «Знакомства» вместо стены теории: где ты в истории (акт), что будет в уроке (план сцен),
 * какие фразы откроешь (карточки рубашкой вверх) и большая «Начать». Теория — по «подробнее».
 */
export default function IntroOpener({ lessonId, onBack, onStart, details }: {
  lessonId: number
  onBack: () => void
  onStart: () => void
  details: React.ReactNode
}) {
  const lesson = introLesson(lessonId)
  const act = actOf(lesson)
  const phrases = newPhrases(lesson)
  const [more, setMore] = useState(false)
  // Имени, которое пишется по-грузински, нет (в Telegram латиница-никнейм, эмодзи…) — спрашиваем тут же,
  // а не подставляем чужое: в уроках герой — это ты.
  const [askName] = useState(() => !hasUsableName())
  const [name, setName] = useState('')
  const nameOk = !askName || !!transliterateToGeorgian(name.trim())
  const plan = lesson.steps.map(s => STEP_TITLE[s.kind])

  return (
    <div className="ab-screen flex flex-col bg-cream" data-testid="intro-opener">
      <div className="shrink-0" style={{ paddingTop: 'var(--safe-t)' }}>
        <div className="mn-kilim" />
        <div className="px-5 py-3 flex items-center gap-3">
          <button onClick={() => { haptic('tap'); onBack() }} aria-label="Назад"
            className="shrink-0 w-11 h-11 rounded-xl bg-cream-tile border-[1.5px] border-jewelInk flex items-center justify-center" style={{ boxShadow: '2px 2px 0 #15100A' }}><BackIcon /></button>
          <div className="flex-1 mn-eyebrow text-navy text-center pr-11">урок {lessonId} из {INTRO_TOTAL}</div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col items-center px-5 text-center overflow-y-auto">
        <div className="text-[12px] font-extrabold tracking-[0.08em] uppercase text-jewelInk-hint">акт {act.id} из {ACTS.length} · {act.title}</div>
        <div className="ab-short:hidden mt-1"><Mascot mood="cheer" size={84} /></div>
        <h1 className="mt-1 text-[27px] ab-short:text-[23px] font-extrabold leading-tight">{lesson.title}</h1>
        <p className="mt-1 text-[14px] text-jewelInk-soft max-w-[32ch]">{lesson.id === 1 || lesson.act !== introLesson(lessonId - 1).act ? act.story + ' ' : ''}{lesson.goal}</p>

        {phrases.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-2" data-testid="opener-phrases">
            {phrases.map((p, k) => (
              <div key={p.id} className="ab-deal rounded-xl border-[1.5px] border-jewelInk bg-navy text-cream px-3 py-2 min-w-[64px] text-[13px] font-extrabold" style={{ boxShadow: '3px 3px 0 #15100A', animationDelay: `${k * 160}ms` }}>
                фраза {k + 1}
              </div>
            ))}
          </div>
        )}

        <ol className="mt-4 flex flex-wrap justify-center gap-1.5" aria-label="План урока">
          {[...plan, 'Проверка'].map((t, k) => (
            <li key={k} className="rounded-full border-[1.5px] border-jewelInk bg-cream-tile px-2.5 py-0.5 text-[12px] font-bold">{k + 1}. {t}</li>
          ))}
        </ol>

        {more && <div className="mt-4 w-full text-left" data-testid="opener-details">{details}</div>}
      </div>

      <div className="shrink-0 px-5 pt-3 flex flex-col gap-2" style={{ paddingBottom: 'calc(var(--safe-b) + 16px)' }}>
        {askName && (
          <label className="flex flex-col gap-1 text-[13px] font-bold text-jewelInk-soft" data-testid="opener-name">
            Как тебя зовут? В уроках так будут звать тебя.
            <input
              data-testid="opener-name-input"
              value={name}
              maxLength={20}
              onChange={e => setName(e.target.value)}
              className="min-h-[44px] rounded-xl border-[1.5px] border-jewelInk bg-cream-tile px-3 text-[17px] font-bold text-jewelInk"
              placeholder="Имя по-русски"
            />
            {name.trim() && (nameOk
              ? <span className="text-[12px] text-jewelInk-mid">по-грузински: <span className="font-geo font-bold text-jewelInk">{geoName(name).geo}</span> [{cyr(geoName(name).geo)}]</span>
              : <span className="text-[12px] text-ruby">Напиши русскими или латинскими буквами</span>)}
          </label>
        )}
        <Button disabled={!nameOk} onClick={() => { haptic('pop'); if (askName) saveName(name.trim()); onStart() }}>Начать</Button>
        <button onClick={() => setMore(m => !m)} className="min-h-[40px] text-[13px] font-bold text-navy">{more ? 'свернуть' : 'подробнее'}</button>
      </div>
    </div>
  )
}
