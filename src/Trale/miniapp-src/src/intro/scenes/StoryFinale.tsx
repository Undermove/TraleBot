import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { cyr } from '../../verbs/types'
import { speak } from '../voice'
import Button from '../../components/Button'
import Mascot from '../../components/Mascot'
import { burst, flyGhost, haptic, reducedMotion, sound } from '../../alphabet/games/fx'
import { DictChip } from '../../alphabet/words/WordIntro'
import { api } from '../../api'
import { ACTS, INTRO_LESSONS, INTRO_TOTAL, actOf, newPhrases, sceneWords, type IntroLesson } from '../story'
import '../../alphabet/games/alphabet.css'

/** Первые уроки объясняют, зачем словарь; дальше хватает счётчика и кнопки. */
const EXPLAIN_DICT_UNTIL = 3

/**
 * Праздник после урока без ошибок: что теперь умеешь (новые фразы урока), где ты в истории
 * (акт и сколько уроков акта позади) и что дальше. Урок засчитан — его фразы и слова сцены сервер
 * кладёт в личный словарь: они влетают в значок «Словарь», рядом — «открыть словарь».
 */
export default function StoryFinale({ lesson, onNext, onVocabulary }: { lesson: IntroLesson; onNext: () => void; onVocabulary?: () => void }) {
  const act = actOf(lesson)
  const inAct = INTRO_LESSONS.filter(l => l.act === act.id)
  const pos = inAct.findIndex(l => l.id === lesson.id) + 1
  const next = INTRO_LESSONS.find(l => l.id === lesson.id + 1)
  const actDone = pos === inAct.length
  useEffect(() => { haptic('good'); sound.win(); burst(null, 'big') }, [])

  // Слова урока — в словарь (сервер решает, какие; повторный вызов ничего не добавляет). Без сети —
  // праздник как был, без словаря.
  const [saved, setSaved] = useState<string[] | null>(null)
  const [inDict, setInDict] = useState(0)
  const chip = useRef<HTMLDivElement>(null)
  const cards = useRef<Record<string, HTMLElement | null>>({})
  useEffect(() => {
    let alive = true
    Promise.resolve().then(() => api.addIntroWords(lesson.id))
      .then(r => { if (alive && r?.words?.length) setSaved(r.words.map(w => w.word)) })
      .catch(() => { /* праздник и без словаря */ })
    return () => { alive = false }
  }, [lesson.id])
  const all = [...newPhrases(lesson), ...sceneWords(lesson)]
  useEffect(() => {
    if (!saved) return
    let alive = true
    const quick = reducedMotion()
    void (async () => {
      await new Promise(r => setTimeout(r, quick ? 0 : 900))
      for (let i = 0; i < all.length && alive; i++) {
        void flyGhost(cards.current[all[i].id] ?? null, chip.current, all[i].geo, 420, 'font-geo text-[15px]')
        await new Promise(r => setTimeout(r, quick ? 0 : 260))
        if (!alive) return
        haptic('tap'); sound.snap(i)
        setInDict(i + 1)
      }
    })()
    return () => { alive = false }
  }, [saved]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="ab-screen flex flex-col items-center justify-center bg-cream px-6 text-center gap-3" data-testid="intro-finale" style={{ paddingTop: 'var(--safe-t)', paddingBottom: 'calc(var(--safe-b) + 16px)' }}>
      <motion.div initial={{ scale: 0.3, y: 40, rotate: -12 }} animate={{ scale: 1, y: 0, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 12 }}>
        <Mascot mood="cheer" size={110} />
      </motion.div>
      <div className="mn-eyebrow text-navy">акт {act.id} из {ACTS.length} · урок {lesson.id} из {INTRO_TOTAL}</div>
      <h1 className="text-[27px] font-extrabold leading-tight">{actDone ? `Акт «${act.title}» пройден!` : 'Урок пройден!'}</h1>
      <p className="text-[15px] text-jewelInk-soft max-w-[32ch]">{lesson.goal.replace(/\.$/, '')} — теперь это умеешь.</p>
      {saved && (
        <div className="flex items-center gap-2" data-testid="finale-dict">
          <span className="text-[13px] font-extrabold">Эти слова теперь в твоём словаре</span>
          <DictChip count={inDict} innerRef={chip} />
        </div>
      )}
      {newPhrases(lesson).length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {/* Выученные фразы — карточками; нажми — прозвучит ещё раз. */}
          {newPhrases(lesson).map((p, k) => (
            <motion.button key={p.id} ref={el => { cards.current[p.id] = el }} data-testid="finale-phrase" onClick={() => { haptic('tap'); void speak(p.id) }}
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
      {sceneWords(lesson).length > 0 && (
        <div className="flex flex-wrap justify-center items-center gap-1.5" data-testid="finale-scene-words">
          {/* Слова, которые встретились по ходу сцены: мельче, без карточек. */}
          <span className="text-[11px] font-bold text-jewelInk-hint">ещё по ходу:</span>
          {sceneWords(lesson).map((p, k) => (
            <motion.button key={p.id} ref={el => { cards.current[p.id] = el }} data-testid="finale-scene-word" onClick={() => { haptic('tap'); void speak(p.id) }}
              className="rounded-full border-[1.5px] border-jewelInk/40 bg-cream px-2 py-0.5 text-[12px]"
              initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.6 + newPhrases(lesson).length * 0.12 + k * 0.08 }} whileTap={{ scale: 0.95 }}>
              <b className="font-geo">{p.geo}</b> <span className="text-jewelInk-hint">{p.ru}</span>
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
      {saved && lesson.id <= EXPLAIN_DICT_UNTIL && (
        <p className="text-[13px] leading-snug text-jewelInk-soft max-w-[32ch] rounded-xl border-[1.5px] border-dashed border-jewelInk-faint bg-gold-wash/70 px-3 py-2" data-testid="finale-dict-tip">
          Забыл слово? Открой «Мой словарь» на главной: там все слова, которые ты встретил. Найди нужное и нажми — откроется карточка.
        </p>
      )}
      {next && <p className="text-[13px] text-jewelInk-hint">Дальше: {next.title}</p>}
      <div className="w-full max-w-[280px] mt-2 flex flex-col gap-2">
        {saved && onVocabulary && <Button variant="ghost" onClick={() => { haptic('tap'); onVocabulary() }}><span data-testid="finale-open-dict">открыть словарь</span></Button>}
        <Button onClick={onNext}>Дальше</Button>
      </div>
    </div>
  )
}
