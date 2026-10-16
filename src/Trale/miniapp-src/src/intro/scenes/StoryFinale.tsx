import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { cyr } from '../../verbs/types'
import { speak } from '../voice'
import Button from '../../components/Button'
import Mascot from '../../components/Mascot'
import { burst, haptic, sound } from '../../alphabet/games/fx'
import { ACTS, INTRO_LESSONS, INTRO_TOTAL, actOf, newPhrases, type IntroLesson } from '../story'
import '../../alphabet/games/alphabet.css'

/**
 * Праздник после урока без ошибок: что теперь умеешь (новые фразы урока), где ты в истории
 * (акт и сколько уроков акта позади) и что дальше.
 */
export default function StoryFinale({ lesson, onNext }: { lesson: IntroLesson; onNext: () => void }) {
  const act = actOf(lesson)
  const inAct = INTRO_LESSONS.filter(l => l.act === act.id)
  const pos = inAct.findIndex(l => l.id === lesson.id) + 1
  const next = INTRO_LESSONS.find(l => l.id === lesson.id + 1)
  const actDone = pos === inAct.length
  useEffect(() => { haptic('good'); sound.win(); burst(null, 'big') }, [])
  return (
    <div className="ab-screen flex flex-col items-center justify-center bg-cream px-6 text-center gap-3" data-testid="intro-finale" style={{ paddingTop: 'var(--safe-t)', paddingBottom: 'calc(var(--safe-b) + 16px)' }}>
      <motion.div initial={{ scale: 0.3, y: 40, rotate: -12 }} animate={{ scale: 1, y: 0, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 12 }}>
        <Mascot mood="cheer" size={110} />
      </motion.div>
      <div className="mn-eyebrow text-navy">акт {act.id} из {ACTS.length} · урок {lesson.id} из {INTRO_TOTAL}</div>
      <h1 className="text-[27px] font-extrabold leading-tight">{actDone ? `Акт «${act.title}» пройден!` : 'Урок пройден!'}</h1>
      <p className="text-[15px] text-jewelInk-soft max-w-[32ch]">{lesson.goal.replace(/\.$/, '')} — теперь это умеешь.</p>
      {newPhrases(lesson).length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {/* Выученные фразы — карточками; нажми — прозвучит ещё раз. */}
          {newPhrases(lesson).map((p, k) => (
            <motion.button key={p.id} data-testid="finale-phrase" onClick={() => { haptic('tap'); void speak(p.id) }}
              className="rounded-xl border-[1.5px] border-jewelInk bg-cream-tile px-2.5 py-1 text-[13px] text-left"
              style={{ boxShadow: '2px 2px 0 #15100A' }}
              initial={{ opacity: 0, y: 24, rotate: k % 2 ? 6 : -6 }} animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.35 + k * 0.12 }} whileTap={{ scale: 0.95 }}>
              <b className="font-geo block leading-tight">{p.geo}</b>
              <span className="block text-[11px] text-jewelInk-hint leading-tight">{cyr(p.geo)} — {p.ru}</span>
            </motion.button>
          ))}
        </div>
      )}
      <div className="flex gap-1 mt-1" aria-label={`урок ${pos} из ${inAct.length} в акте`}>
        {inAct.map((l, k) => (
          <motion.span key={l.id} className="h-2.5 w-6 rounded-full border-[1.5px] border-jewelInk"
            initial={{ backgroundColor: k < pos - 1 ? '#F5B820' : '#FDFAEF', scale: 1 }}
            animate={{ backgroundColor: k < pos ? '#F5B820' : '#FDFAEF', scale: k === pos - 1 ? [1, 1.5, 1] : 1 }}
            transition={{ delay: 0.8, duration: 0.5 }} />
        ))}
      </div>
      {next && <p className="text-[13px] text-jewelInk-hint">Дальше: {next.title}</p>}
      <div className="w-full max-w-[280px] mt-2"><Button onClick={onNext}>Дальше</Button></div>
    </div>
  )
}
