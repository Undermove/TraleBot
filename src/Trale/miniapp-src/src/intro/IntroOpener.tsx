import React, { useState } from 'react'
import { motion } from 'framer-motion'
import Button from '../components/Button'
import Mascot from '../components/Mascot'
import '../alphabet/games/alphabet.css'
import { BackIcon } from '../alphabet/games/GameFrame'
import { haptic } from '../alphabet/games/fx'
import { ACTS, INTRO_LESSONS, INTRO_TOTAL, actOf, geoName, hasUsableName, introLesson, newPhrases, saveName, type IntroStep } from './story'
import { transliterateToGeorgian } from '../utils/georgianizerName'
import { cyr } from '../verbs/types'
import { DAYS } from './scenes/Bakery.logic'
import { POINTS } from './scenes/Pingpong.logic'
import { ride } from './scenes/Minibus.logic'
import { DECK_SIZE } from './scenes/HaveSort.logic'

/** Как сцена называется в плане урока на стартовом экране. */
export const STEP_TITLE: Record<IntroStep['kind'], string> = {
  phrase: 'Новые фразы', rule: 'Находка правила', walk: 'Прогулка', bakery: 'Пекарня', pingpong: 'Пинг-понг', minibus: 'Маршрутка', party: 'Вечеринка',
  magnets: 'Наклейки окончаний', reception: 'Ресепшн', detective: 'Посылки в подъезде', chat: 'Чат с Нино', taxi: 'Такси',
  family: 'Семейный альбом', havesort: 'Фото и чемодан', aboutme: 'Интервью', supra: 'Супра'
}

/** Что будешь делать в шаге — одной строкой, под названием. */
export const STEP_DESC: Record<IntroStep['kind'], string> = {
  phrase: 'послушай и разбери по словам', rule: 'сравни примеры и найди правило', walk: 'идёшь по улице и здороваешься',
  bakery: `${DAYS.length} визита за шоти — и разговор с пекаршей`, pingpong: `партия из ${POINTS} розыгрышей: верни вопрос, как мяч`, minibus: `${ride().length} ситуаций в дороге: спасибо, извините, да и нет`,
  party: 'знакомься и раздавай бейджи', magnets: 'прилепи окончание к слову', reception: 'найди бронь гостя и выдай ключ',
  detective: 'раздай соседям их посылки', chat: 'переписка с соседкой Нино', taxi: 'поболтай — и таксист сбросит цену',
  family: 'семейный альбом Нино', havesort: `${DECK_SIZE} карточек: живых — на фото, вещи — в чемодан`, aboutme: 'интервью для студенческой газеты', supra: 'большое застолье у соседей'
}

/** Пиктограммы шагов: по картинке понятно, куда идёшь. */
function StepIcon({ kind }: { kind: IntroStep['kind'] | 'check' }) {
  const INK = '#15100A'
  const c = { fill: 'none', stroke: INK, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden>
      {kind === 'phrase' && <><path d="M5 8 h20 a3 3 0 0 1 3 3 v9 a3 3 0 0 1 -3 3 h-11 l-6 5 v-5 h-3 a3 3 0 0 1 -3 -3 v-9 a3 3 0 0 1 3 -3 z" fill="#FDFAEF" stroke={INK} strokeWidth="1.8" /><path d="M10 14 h12 M10 18 h8" {...c} /></>}
      {kind === 'rule' && <><circle cx="14" cy="14" r="8" fill="#FCE9A8" stroke={INK} strokeWidth="1.8" /><path d="M20 20 l8 8" {...c} strokeWidth="3" /></>}
      {kind === 'walk' && <><path d="M4 30 L13 6 H21 L30 30 Z" fill="#E3D6BE" stroke={INK} strokeWidth="1.6" /><path d="M17 10 v4 M17 18 v4 M17 26 v3" {...c} /></>}
      {kind === 'bakery' && <><path d="M3 20 Q10 9 17 10 Q24 9 31 20 Q24 27 17 26 Q10 27 3 20 Z" fill="#E0A55A" stroke={INK} strokeWidth="1.8" /><path d="M9 19 Q17 13 25 19" {...c} stroke="#B5793F" strokeWidth="2" /></>}
      {kind === 'pingpong' && <><circle cx="13" cy="14" r="9" fill="#1B5FB0" stroke={INK} strokeWidth="1.8" /><path d="M19 20 l6 6" {...c} strokeWidth="4" stroke="#7A4E2D" /><circle cx="27" cy="9" r="3" fill="#FDFAEF" stroke={INK} strokeWidth="1.4" /></>}
      {kind === 'minibus' && <><rect x="3" y="9" width="28" height="16" rx="4" fill="#F5B820" stroke={INK} strokeWidth="1.8" /><path d="M7 13 h6 v5 h-6 z M16 13 h5 v5 h-5 z M24 13 h4 v5 h-4 z" fill="#9CC6EE" stroke={INK} strokeWidth="1.2" /><circle cx="10" cy="26" r="2.6" fill={INK} /><circle cx="24" cy="26" r="2.6" fill={INK} /></>}
      {kind === 'party' && <><path d="M2 8 Q17 20 32 8" {...c} />{[7, 12, 17, 22, 27].map((x, k) => <circle key={x} cx={x} cy={8 + (k % 4 ? 5 : 3)} r="2.4" fill={['#E01A3C', '#F5B820', '#4E8A5B', '#1B5FB0', '#E01A3C'][k]} stroke={INK} strokeWidth="1" />)}<rect x="9" y="19" width="16" height="11" rx="2" fill="#FDFAEF" stroke={INK} strokeWidth="1.6" /><path d="M9 22 h16" stroke="#E01A3C" strokeWidth="2.4" /></>}
      {kind === 'magnets' && <><rect x="6" y="9" width="20" height="16" rx="4" fill="#E01A3C" stroke={INK} strokeWidth="1.8" transform="rotate(-8 16 17)" /><path d="M22 9 l4 4 h-4 z" fill="#F6EEDC" stroke={INK} strokeWidth="1.2" transform="rotate(-8 16 17)" /></>}
      {kind === 'reception' && <><circle cx="9" cy="17" r="5" fill="#F5B820" stroke={INK} strokeWidth="1.8" /><path d="M14 17 h7 M18 17 v3" {...c} /><rect x="20" y="11" width="12" height="12" rx="3" fill="#1B5FB0" stroke={INK} strokeWidth="1.6" /></>}
      {kind === 'detective' && <><circle cx="12" cy="11" r="5" fill="#F2C9A0" stroke={INK} strokeWidth="1.6" /><path d="M4 28 q8 -12 16 0" fill="#7A4E9A" stroke={INK} strokeWidth="1.6" /><path d="M24 9 q4 -4 6 0 q0 3 -3 4 v2 M27 19 v0.5" {...c} strokeWidth="2.2" /></>}
      {kind === 'chat' && <><rect x="9" y="3" width="16" height="28" rx="4" fill="#FDFAEF" stroke={INK} strokeWidth="1.8" /><rect x="12" y="8" width="9" height="4" rx="2" fill="#9CC6EE" /><rect x="13" y="14" width="9" height="4" rx="2" fill="#F5B820" /><rect x="12" y="20" width="7" height="4" rx="2" fill="#9CC6EE" /></>}
      {kind === 'taxi' && <><path d="M4 22 v-4 l4 -7 h18 l4 7 v4 z" fill="#F5B820" stroke={INK} strokeWidth="1.8" /><rect x="13" y="7" width="8" height="4" rx="1" fill={INK} /><circle cx="10" cy="23" r="3" fill={INK} /><circle cx="24" cy="23" r="3" fill={INK} /></>}
      {kind === 'family' && <><rect x="4" y="6" width="26" height="22" rx="3" fill="#FDFAEF" stroke={INK} strokeWidth="1.8" /><circle cx="12" cy="15" r="3" fill="#F2C9A0" stroke={INK} strokeWidth="1.2" /><circle cx="22" cy="15" r="3" fill="#E0AC7E" stroke={INK} strokeWidth="1.2" /><path d="M7 25 q5 -6 10 0 q5 -6 10 0" fill="#4E8A5B" stroke={INK} strokeWidth="1.2" /></>}
      {kind === 'havesort' && <><path d="M5 13 h14 l-2 15 h-10 z" fill="#E8D2AE" stroke={INK} strokeWidth="1.8" /><path d="M9 13 q3 -7 6 0" {...c} /><path d="M26 12 q-4 -4 -6 0 q-1 3 6 8 q7 -5 6 -8 q-2 -4 -6 0" fill="#E01A3C" stroke={INK} strokeWidth="1.4" /></>}
      {kind === 'aboutme' && <><rect x="3" y="7" width="28" height="20" rx="3" fill="#FDFAEF" stroke={INK} strokeWidth="1.8" /><circle cx="11" cy="15" r="3.5" fill="#F2C9A0" stroke={INK} strokeWidth="1.2" /><path d="M18 13 h9 M18 17 h7 M8 22 h19" {...c} /></>}
      {kind === 'supra' && <><path d="M11 4 h12 l-2 11 a4 4 0 0 1 -8 0 z" fill="#C2204A" stroke={INK} strokeWidth="1.8" /><path d="M17 19 v9 M12 29 h10" {...c} /></>}
      {kind === 'check' && <><circle cx="17" cy="17" r="13" fill="#D6E9D9" stroke={INK} strokeWidth="1.8" /><path d="M11 17 l4 4 l8 -8" {...c} strokeWidth="2.6" /></>}
    </svg>
  )
}

/**
 * Начало урока «Знакомства» вместо стены теории: где ты в истории (акт и его уроки), что будет в уроке
 * (шаги с картинками и строкой «что будешь делать»), какие фразы откроешь (карточки рубашкой вверх)
 * и большая «Начать». Теория — по «подробнее».
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
  const inAct = INTRO_LESSONS.filter(l => l.act === lesson.act)
  // Имени, которое пишется по-грузински, нет (в Telegram латиница-никнейм, эмодзи…) — спрашиваем тут же,
  // а не подставляем чужое: в уроках герой — это ты.
  const [askName] = useState(() => !hasUsableName())
  const [name, setName] = useState('')
  const nameOk = !askName || !!transliterateToGeorgian(name.trim())
  const steps: { kind: IntroStep['kind'] | 'check'; title: string; desc: string }[] = [
    ...lesson.steps.map(s => ({ kind: s.kind, title: STEP_TITLE[s.kind], desc: STEP_DESC[s.kind] })),
    { kind: 'check', title: 'Проверка', desc: 'пять вопросов по уроку' }
  ]

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

      <div className="flex-1 min-h-0 flex flex-col items-center px-5 text-center overflow-y-auto pb-2">
        <div className="text-[12px] font-extrabold tracking-[0.08em] uppercase text-jewelInk-hint">акт {act.id} из {ACTS.length} · {act.title}</div>
        {/* Уроки акта — точками: пройденные, этот, впереди. */}
        <div className="mt-1.5 flex items-center gap-1.5" data-testid="opener-act" aria-label={`Урок ${inAct.findIndex(l => l.id === lessonId) + 1} из ${inAct.length} в акте`}>
          {inAct.map(l => (
            <motion.span key={l.id} className="block rounded-full border-[1.5px] border-jewelInk"
              style={{ width: l.id === lessonId ? 22 : 10, height: 10 }}
              animate={{ backgroundColor: l.id < lessonId ? '#4E8A5B' : l.id === lessonId ? '#F5B820' : '#FDFAEF' }} />
          ))}
        </div>
        <div className="ab-short:hidden mt-2"><Mascot mood="cheer" size={76} /></div>
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

        {/* План урока: шаги карточками — картинка, название, что будешь делать. */}
        <ol className="mt-4 w-full max-w-[360px] flex flex-col gap-2 text-left" aria-label="План урока" data-testid="opener-plan">
          {steps.map((s, k) => (
            <motion.li key={k} className="flex items-center gap-3 rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile px-3 py-2"
              style={{ boxShadow: '2px 2px 0 #15100A' }}
              initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.12 + k * 0.08 }}>
              <span className="shrink-0 w-6 text-[13px] font-extrabold text-jewelInk-hint text-center">{k + 1}</span>
              <span className="shrink-0"><StepIcon kind={s.kind} /></span>
              <span className="min-w-0">
                <span className="block text-[14px] font-extrabold leading-tight">{s.title}</span>
                <span className="block text-[12px] text-jewelInk-soft leading-snug">{s.desc}</span>
              </span>
            </motion.li>
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
