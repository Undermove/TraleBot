import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import GameFrame from '../../alphabet/games/GameFrame'
import { burst, haptic, sound } from '../../alphabet/games/fx'
import { cyr } from '../../verbs/types'
import { JOBS, firstMet, met, phrase, replyRu } from '../story'
import { GameEnd, GameIntro, NewWord, RuleCard } from '../ui'
import { TreatIcon, pleaseAudio, pleaseLine, type Treat } from './party/Treats'
import { hush, speak, speakUrl } from '../voice'
import { JobIcon } from './Party'
import { Flag } from './icons'
import Passerby from './walk/Passerby'
import type { SceneProps, StepOf } from './types'
import {
  GUESTS, SHIFT_INTRO, answer, answerAudio, askField, extraBeats, fieldsOf, judge, planShift, reviewStars, shiftVerdict,
  type Booking, type Field, type RBeat, type ROption, type ReceptionMode
} from './Reception.logic'

/**
 * «Ресепшн» — ты подрабатываешь администратором гестхауса в Батуми. Гость заходит с чемоданом и
 * представляется; найди его бронь на стойке и выдай ключ. Отказов нет — все заселяются, вопрос только
 * в какой номер. Не рассказал гость сам — спроси. Всё по шагам: гость ждёт сколько нужно, голоса не
 * накладываются. Логика — Reception.logic.ts.
 */

const G = ({ g }: { g: string }) => <><b className="font-geo">{g}</b> <span className="text-[12px] text-jewelInk-hint">({cyr(g)})</span></>

const INTRO_TEXT: Record<ReceptionMode, string> = {
  names: 'Ты подрабатываешь на ресепшене гестхауса у моря. Гость заходит и называет имя — найди его бронь на стойке и выдай ключ. Потом гости станут скромнее: спроси, как их зовут.',
  listen: 'Теперь гости говорят, как их зовут и откуда они. На стойке есть похожие брони — два Карлоса, два гостя из Испании. Слушай внимательно.',
  ask: 'Сегодня гости только здороваются. Спроси имя и откуда гость — и найди его бронь.',
  full: 'Большой заезд: кто-то рассказывает всё сам, кого-то надо расспросить. В бронях теперь и профессия.'
}

function endRule(mode: ReceptionMode) {
  if (mode === 'names') {
    return <RuleCard title="Как спросить имя"><G g={phrase('ra_gkvia').geo} /> — как тебя зовут? В ответ: <G g="მე მქვია" /> + имя.</RuleCard>
  }
  const ge = 'საქართველო', es = 'ესპანეთი'
  return (
    <RuleCard title="-დან значит «из»">
      <G g={ge} /> → <G g={ge + 'დან'} />, <G g={es} /> → <G g={es + 'დან'} />. Спросить: <G g={phrase('saidan').geo} />
      {mode === 'full' && <> А профессия — без окончаний: <G g={`მე ვარ ${JOBS[1].geo}`} /> — я {JOBS[1].ru}.</>}
    </RuleCard>
  )
}

type Stage = 'enter' | 'talk' | 'thanks' | 'errand' | 'leave'

interface Line { geo: string; who: 'guest' | 'you' }

export default function Reception({ lesson, step, fraction, onExit, onDone, rng = Math.random }: SceneProps<StepOf<'reception'>>) {
  const mode = step.mode
  const shift = useMemo(() => planShift(lesson.id, mode, rng), []) // eslint-disable-line react-hooks/exhaustive-deps
  const fields = fieldsOf(mode)
  const [phase, setPhase] = useState<'intro' | 'play' | 'end'>('intro')
  const [at, setAt] = useState(0)
  const [stage, setStage] = useState<Stage>('enter')
  const [lines, setLines] = useState<Line[]>([])
  const [heard, setHeard] = useState<Field[]>([])
  const [busy, setBusy] = useState(true)
  const [tip, setTip] = useState('')
  const [bad, setBad] = useState<number | null>(null)
  const [given, setGiven] = useState<number | null>(null)
  const [misses, setMisses] = useState(0)
  const [stars, setStars] = useState<number[]>([])
  const [walk, setWalk] = useState(0)
  // Свой поворот смены: паспорт до брони, просьба или угощение после ключа, знакомство со словами сцены.
  const [passOk, setPassOk] = useState(false)
  const [err, setErr] = useState<{ list: RBeat[]; b: number } | null>(null)
  const [errBad, setErrBad] = useState<string | null>(null)
  const [errGood, setErrGood] = useState<string | null>(null)
  const [errMiss, setErrMiss] = useState(0)
  const [served, setServed] = useState<Treat | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)
  const shown = useRef<string[]>([])
  const keysGiven = useRef(0)
  const introduce = (id: string | undefined) => {
    if (id && firstMet(lesson.id, id) && !shown.current.includes(id)) { shown.current = [...shown.current, id]; setFresh(id) }
  }
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false; hush() }, [])

  const g = shift[at]

  // Пока гость идёт к стойке или уходит наверх — ноги шагают.
  useEffect(() => {
    if (phase !== 'play' || (stage !== 'enter' && stage !== 'leave')) return
    const id = window.setInterval(() => setWalk(w => w + 0.45), 40)
    return () => window.clearInterval(id)
  }, [phase, stage])

  const say = async (line: Line, url?: string, id?: string) => {
    setLines(ls => [...ls.slice(-2), line])
    if (id) await speak(id, line.who === 'you' ? 'hero' : g.voice)
    else await speakUrl(url, line.geo)
  }

  // Гость входит, подходит к стойке, здоровается и рассказывает, что хочет.
  useEffect(() => {
    if (phase !== 'play') return
    let off = false
    setStage('enter'); setLines([]); setHeard([]); setBusy(true); setGiven(null); setMisses(0); setBad(null)
    setPassOk(false); setErr(null); setServed(null); setFresh(null)
    setTip(at === 0 ? 'Гость заходит. Послушай, что он скажет.' : 'Следующий гость.')
    ;(async () => {
      await new Promise(r => window.setTimeout(r, 1100))
      if (off || !alive.current) return
      setStage('talk')
      haptic('soft')
      await say({ geo: `${phrase('gamarjoba').geo}!`, who: 'guest' }, undefined, 'gamarjoba')
      for (const f of g.told) {
        if (off || !alive.current) return
        await say({ geo: answer(g, f), who: 'guest' }, answerAudio(g, f))
        setHeard(h => [...h, f])
      }
      if (off || !alive.current) return
      setBusy(false)
      const left = fields.filter(f => !g.told.includes(f))
      setTip(g.extra.passport ? 'Сначала попроси у гостя паспорт.' : left.length ? 'Гость рассказал не всё — спроси, что нужно, и найди бронь.' : 'Найди бронь гостя и выдай ключ.')
    })()
    return () => { off = true }
  }, [phase, at]) // eslint-disable-line react-hooks/exhaustive-deps

  const ask = async (id: string) => {
    if (busy) return
    setBusy(true)
    await say({ geo: phrase(id).geo, who: 'you' }, undefined, id)
    if (!alive.current) return
    const f = askField(id)
    if (f) {
      await say({ geo: answer(g, f), who: 'guest' }, answerAudio(g, f))
      setHeard(h => (h.includes(f) ? h : [...h, f]))
    } else {
      // «Как дела?» — гость отвечает и улыбается, но про бронь это ничего не говорит.
      await say({ geo: phrase('kargad_madloba').geo, who: 'guest' }, undefined, 'kargad_madloba')
      setTip('Приятно поболтать, но бронь так не найти. Спроси имя или откуда гость.')
    }
    if (alive.current) setBusy(false)
  }

  const askPassport = async () => {
    if (busy || passOk) return
    setBusy(true)
    await say({ geo: pleaseLine('pasporti'), who: 'you' }, pleaseAudio('pasporti'))
    if (!alive.current) return
    setPassOk(true); haptic('soft'); sound.pop(2)
    introduce('pasporti')
    setTip(fields.some(f => !heard.includes(f) && !g.told.includes(f)) ? 'Паспорт на стойке. Теперь узнай, что нужно, и найди бронь.' : 'Паспорт на стойке. Найди бронь гостя.')
    setBusy(false)
  }

  // После ключа: гость просит напиток, угощает — или ты сам предлагаешь чай.
  const showErr = async (list: RBeat[], b: number) => {
    setErr({ list, b }); setBusy(true)
    const beat = list[b]
    if (beat.says) await say({ geo: beat.says, who: 'guest' }, beat.audio)
    if (!alive.current) return
    introduce(beat.word)
    setTip(beat.options[0].treat ? 'Что гость хочет? Подай.' : beat.who === 'you' && b === 0 && !beat.says ? 'Предложи гостю попить с дороги.' : beat.word === 'gemrielia' ? 'Ты пробуешь… Похвали!' : 'Тебя угощают!')
    setBusy(false)
  }
  const answerErr = async (o: ROption) => {
    if (busy || !err) return
    if (!o.ok) {
      haptic('bad'); sound.miss(); setErrMiss(m => m + 1)
      setErrBad(o.geo); window.setTimeout(() => setErrBad(null), 500)
      setTip(o.why ?? 'Не то. Попробуй ещё.')
      return
    }
    setBusy(true); haptic('good'); sound.snap(err.b); setErrGood(o.geo); setFresh(null)
    if (o.treat) { setServed(o.treat); await new Promise(r => window.setTimeout(r, 600)) }
    else if (o.audio) await say({ geo: o.geo, who: 'you' }, o.audio)
    else await say({ geo: o.geo, who: 'you' }, undefined, o.geo === phrase('gemrielia').geo ? 'gemrielia' : undefined)
    if (!alive.current) return
    const beat = err.list[err.b]
    if (beat.echo) await say({ geo: beat.echo, who: 'guest' }, undefined, 'madloba')
    if (!alive.current) return
    setErrGood(null); setErrMiss(0)
    if (err.b + 1 < err.list.length) { void showErr(err.list, err.b + 1); return }
    leave()
  }
  const leave = async () => {
    setErr(null); setStage('leave')
    await new Promise(r => window.setTimeout(r, 1300))
    if (!alive.current) return
    if (at + 1 >= GUESTS) { sound.win(); setPhase('end') } else setAt(a => a + 1)
  }

  const pickCard = async (card: Booking, el: HTMLElement) => {
    if (busy || stage !== 'talk') return
    if (g.extra.passport && !passOk) { haptic('soft'); setTip('Сначала попроси паспорт.'); return }
    const v = judge(g, card, heard)
    if (!v.ok) {
      haptic('bad'); sound.miss()
      setMisses(m => m + 1)
      setBad(card.room); window.setTimeout(() => setBad(null), 500)
      setTip(v.hint)
      return
    }
    setBusy(true)
    haptic('good'); sound.pop(4); burst(el, 'small')
    setGiven(card.room)
    const s = reviewStars(misses)
    setStars(st => [...st, s])
    // Слова урока 9: первый ключ — «გასაღები», второй — «ოთახი» (комната).
    keysGiven.current += 1
    introduce(keysGiven.current === 1 ? 'gasaghebi' : keysGiven.current === 2 ? 'otakhi' : undefined)
    setTip(met(lesson.id, 'gasaghebi')
      ? `Гость получил ключ — ${phrase('gasaghebi').geo} — от комнаты ${card.room}.`
      : `Ключ от номера ${card.room} — у гостя.`)
    setStage('thanks')
    await new Promise(r => window.setTimeout(r, 650))
    if (!alive.current) return
    await say({ geo: `${phrase('madloba').geo}!`, who: 'guest' }, undefined, 'madloba')
    if (!alive.current) return
    const list = extraBeats(g.extra, g.voice, rng)
    // Подарок гость ставит на стойку; напиток появится, когда подашь.
    if (list.length) { setStage('errand'); if (g.extra.gift) setServed(g.extra.gift); void showErr(list, 0); return }
    void leave()
  }

  const start = () => { setAt(0); setStars([]); shown.current = []; keysGiven.current = 0; setPhase('play') }

  const title = 'Ресепшн'
  if (phase === 'intro') {
    return (
      <GameFrame title={title} eyebrow="игра урока" fraction={fraction} onExit={onExit}>
        <div className="flex-1 min-h-0 flex flex-col" data-testid="reception-scene">
          <GameIntro title="Ресепшн у моря" text={`${INTRO_TEXT[mode]}${SHIFT_INTRO[lesson.id] ? ` ${SHIFT_INTRO[lesson.id]}` : ''}`} onStart={start} hero />
        </div>
      </GameFrame>
    )
  }
  if (phase === 'end') {
    const avg = stars.reduce((a, b) => a + b, 0) / Math.max(1, stars.length)
    return (
      <GameFrame title={title} eyebrow="игра урока" fraction={fraction} onExit={onExit}>
        <GameEnd title={`Отзывы: ${avg.toFixed(1)} из 5`} text={shiftVerdict(stars)} rule={endRule(mode)} onNext={onDone} onAgain={start} />
      </GameFrame>
    )
  }

  const left = fields.filter(f => !heard.includes(f))
  const avg = stars.length ? stars.reduce((a, b) => a + b, 0) / stars.length : 5

  return (
    <GameFrame title={title} eyebrow={`гость ${at + 1} из ${GUESTS}`} fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col gap-2.5" data-testid="reception-scene">
        <div className="relative shrink-0 h-[300px] ab-short:h-[230px] rounded-2xl border-[1.5px] border-jewelInk overflow-hidden" style={{ boxShadow: '3px 3px 0 #15100A' }} data-testid="reception-lobby">
          <Lobby given={given} rooms={g.desk.map(d => d.room)} />
          {/* Отзывы — звёздами в углу. */}
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-cream/90 border-[1.5px] border-jewelInk px-2 py-0.5 text-[12px] font-extrabold" data-testid="reception-rating">
            <StarIcon /> {avg.toFixed(1)}
          </div>

          {/* Гость: входит из двери слева, стоит у стойки, с ключом уходит к лестнице справа. */}
          <motion.div
            key={at}
            className="absolute bottom-[38px] z-10"
            data-testid="reception-guest"
            initial={{ left: '-12%' }}
            animate={{ left: stage === 'leave' ? '118%' : '70%' }}
            transition={stage === 'leave' ? { duration: 1.3, ease: 'easeIn' } : { type: 'spring', stiffness: 60, damping: 16 }}
          >
            <div className="relative -translate-x-1/2">
              <svg width="104" height="170" viewBox="-60 -190 120 200" className="overflow-visible" aria-hidden>
                <g transform="scale(0.98)">
                  <Passerby who={{ ru: '', kind: g.look.kind, coat: g.look.coat, skin: g.look.skin, hair: g.look.hair, extra: g.look.extra, voice: g.voice }}
                    phase={walk} stride={stage === 'enter' || stage === 'leave' ? 1 : 0} face={misses && stage === 'talk' ? 'huh' : 'smile'} talking={false} wave={stage === 'thanks'} />
                </g>
                {/* Чемодан на колёсиках. */}
                <g transform="translate(34 -4)">
                  <rect x="-14" y="-54" width="28" height="50" rx="5" fill="#E01A3C" stroke="#15100A" strokeWidth="2.6" />
                  <path d="M-6 -54 v-12 h12 v12" fill="none" stroke="#15100A" strokeWidth="2.6" />
                  <path d="M-14 -36 h28 M-14 -22 h28" stroke="#15100A" strokeWidth="1.6" opacity="0.5" />
                  <circle cx="-8" cy="-2" r="3.5" fill="#15100A" /><circle cx="8" cy="-2" r="3.5" fill="#15100A" />
                </g>
              </svg>
            </div>
          </motion.div>

          <Counter />

          {/* Паспорт гостя на стойке и то, что ты подал. */}
          <AnimatePresence>
            {passOk && stage !== 'leave' && (
              <motion.div key={`pass-${at}`} className="absolute z-30 left-[59%] bottom-[60px] ab-short:bottom-[46px]" data-testid="reception-passport-on"
                initial={{ opacity: 0, x: 60, rotate: 20, scale: 0.7 }} animate={{ opacity: 1, x: 0, rotate: -8, scale: 1 }} exit={{ opacity: 0, y: 20 }}
                transition={{ type: 'spring', stiffness: 260, damping: 16 }}>
                <PassportIcon />
              </motion.div>
            )}
            {served && stage !== 'leave' && (
              <motion.div key={`served-${at}`} className="absolute z-30 left-[73%] bottom-[60px] ab-short:bottom-[46px]" data-testid="reception-served"
                initial={{ opacity: 0, y: 40, scale: 0.5 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 15 }}>
                <TreatIcon t={served} size={36} />
              </motion.div>
            )}
          </AnimatePresence>

          {fresh && (
            <div key={fresh} className="absolute left-2 bottom-2 z-30">
              <NewWord word={phrase(fresh)} />
            </div>
          )}

          {/* Ключ летит к гостю. */}
          <AnimatePresence>
            {given !== null && stage !== 'leave' && (
              <motion.div className="absolute z-20 left-[62%] bottom-[150px]" data-testid="reception-key"
                initial={{ opacity: 0, y: 80, scale: 0.6, rotate: -30 }} animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.7 }}
                transition={{ type: 'spring', stiffness: 300, damping: 16 }}>
                <KeyTag room={given} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Реплики: последние две, у гостя — слева, твои — справа. */}
          <div className="absolute top-2 left-2 w-[58%] flex flex-col gap-1 z-20" data-testid="reception-lines">
            <AnimatePresence initial={false}>
              {lines.map((l, k) => (
                <motion.div key={`${at}-${k}-${l.geo}-${lines.length}`} layout
                  initial={{ opacity: 0, y: 8, scale: 0.9 }} animate={{ opacity: k < lines.length - 1 ? 0.7 : 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                  className={`max-w-[92%] rounded-2xl border-[1.5px] border-jewelInk px-2.5 py-1 ${l.who === 'you' ? 'self-end bg-navy text-cream' : 'self-start bg-cream-tile'}`}
                  style={{ boxShadow: '2px 2px 0 #15100A' }}>
                  <span className="block font-geo font-bold text-[15px] leading-tight">{l.geo}</span>
                  <span className={`block text-[10.5px] font-semibold leading-tight ${l.who === 'you' ? 'text-cream/75' : 'text-jewelInk-hint'}`}>{cyr(l.geo)}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Вопросы — если гость рассказал не всё. */}
        {g.asks.length > 0 && left.length > 0 && (
          <div className="shrink-0 grid grid-cols-2 gap-1.5" data-testid="reception-asks">
            {g.asks.filter(id => { const f = askField(id); return !f || !heard.includes(f) }).map(id => (
              <motion.button key={id} data-testid={`ask-${id}`} disabled={busy} onClick={() => { haptic('tap'); void ask(id) }}
                className="min-h-[44px] rounded-xl border-[1.5px] border-jewelInk bg-navy-wash px-2 py-1 text-center"
                style={{ boxShadow: '2px 2px 0 #15100A' }}
                animate={{ opacity: busy ? 0.5 : 1 }} whileTap={busy ? undefined : { scale: 0.95 }}>
                <span className="block font-geo font-bold text-[14px] leading-tight">{phrase(id).geo}</span>
                <span className="block text-[10.5px] font-semibold text-jewelInk-hint leading-tight">{phrase(id).ru}</span>
              </motion.button>
            ))}
          </div>
        )}

        {/* Паспорт — до брони. */}
        {g.extra.passport && !passOk && stage === 'talk' && (
          <div className="shrink-0" data-testid="reception-passport">
            <motion.button data-testid="ask-pasporti" disabled={busy} onClick={() => { haptic('tap'); void askPassport() }}
              className="w-full min-h-[44px] rounded-xl border-[1.5px] border-jewelInk bg-gold-wash px-2 py-1 text-center"
              style={{ boxShadow: '2px 2px 0 #15100A' }} animate={{ opacity: busy ? 0.5 : 1 }} whileTap={busy ? undefined : { scale: 0.96 }}>
              <span className="block font-geo font-bold text-[14px] leading-tight">{pleaseLine('pasporti')}</span>
              <span className="block text-[10.5px] font-semibold text-jewelInk-hint leading-tight">{cyr(pleaseLine('pasporti'))} — паспорт, пожалуйста</span>
            </motion.button>
          </div>
        )}

        {/* Просьба, угощение или твоё предложение — после ключа. */}
        {stage === 'errand' && err && (
          <div className={`shrink-0 grid gap-1.5 ${err.list[err.b].options[0].treat ? 'grid-cols-3' : 'grid-cols-1'}`} data-testid="reception-errand"
            data-want={err.list[err.b].options.findIndex(o => o.ok)}>
            {err.list[err.b].options.map((o, k) => (
              <motion.button key={`${err.b}-${o.geo}`} data-testid={`rc-opt-${k}`} disabled={busy} onClick={() => { haptic('tap'); void answerErr(o) }}
                className={`rounded-xl border-[1.5px] border-jewelInk px-2 py-1 flex flex-col items-center justify-center ${o.treat ? 'min-h-[78px] gap-0.5' : 'min-h-[44px]'}`}
                style={{ boxShadow: '2px 2px 0 #15100A' }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: busy && errGood !== o.geo ? 0.55 : 1, y: errGood === o.geo ? -5 : 0, x: errBad === o.geo ? [0, -7, 7, -5, 5, 0] : 0,
                  backgroundColor: errGood === o.geo ? '#D6E9D9' : errBad === o.geo ? '#F7DCDD' : errMiss >= 2 && o.ok ? '#FBEFC6' : o.treat ? '#FDFAEF' : '#E3ECF7' }}
                whileTap={busy ? undefined : { scale: 0.95 }} transition={{ type: 'spring', stiffness: 420, damping: 24 }}>
                {o.treat && <TreatIcon t={o.treat} size={34} />}
                <span className="block font-geo font-bold text-[14px] leading-tight">{o.geo}</span>
                <span className="block text-[10.5px] font-semibold text-jewelInk-hint leading-tight">{o.treat && firstMet(lesson.id, o.treat) ? phrase(o.treat).ru : replyRu(lesson.id, o.geo) ?? cyr(o.geo)}</span>
              </motion.button>
            ))}
          </div>
        )}

        {/* Брони на стойке (пока идёт просьба или угощение — ключ уже выдан, брони убраны). */}
        {stage !== 'errand' && <div className={`shrink-0 grid gap-2 ${g.desk.length > 3 ? 'grid-cols-2' : 'grid-cols-3'}`} data-testid="reception-desk" data-want={g.booking.room}>
          {g.desk.map(card => (
            <motion.button
              key={`${at}-${card.room}`}
              data-testid={`booking-${card.room}`}
              disabled={busy || stage !== 'talk' || (g.extra.passport && !passOk)}
              onClick={e => { haptic('tap'); void pickCard(card, e.currentTarget) }}
              className="relative min-h-[86px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile px-2 pt-1.5 pb-2 text-center flex flex-col items-center gap-1"
              style={{ boxShadow: '3px 3px 0 #15100A' }}
              initial={{ opacity: 0, y: 14 }}
              animate={{
                opacity: given !== null && given !== card.room ? 0.35 : 1, y: given === card.room ? -6 : 0,
                x: bad === card.room ? [0, -7, 7, -5, 5, 0] : 0,
                backgroundColor: given === card.room ? '#D6E9D9' : bad === card.room ? '#F7DCDD' : '#FDFAEF'
              }}
              whileTap={busy ? undefined : { scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            >
              <KeyTag room={card.room} small />
              <span className="block font-geo font-extrabold text-[16px] leading-none">{card.name}</span>
              <span className="block text-[10.5px] font-semibold text-jewelInk-hint leading-none">{cyr(card.name)}</span>
              {(mode !== 'names') && (
                <span className="flex items-center gap-1.5 mt-0.5">
                  <Flag code={card.country.flag} size={22} />
                  {mode === 'full' && <JobIcon job={card.job} size={18} />}
                </span>
              )}
            </motion.button>
          ))}
        </div>}

        <div className="shrink-0 min-h-[40px] text-center text-[13px] leading-snug text-jewelInk-soft px-2" aria-live="polite" data-testid="reception-tip">{tip}</div>
      </div>
    </GameFrame>
  )
}

/** Паспорт: бордовая книжечка с гербом. */
function PassportIcon() {
  return (
    <svg width="34" height="44" viewBox="0 0 34 44" aria-hidden>
      <rect x="2" y="2" width="30" height="40" rx="4" fill="#8E1B2E" stroke="#15100A" strokeWidth="2" />
      <circle cx="17" cy="18" r="6" fill="none" stroke="#F5B820" strokeWidth="1.6" />
      <path d="M17 12 v12 M11 18 h12" stroke="#F5B820" strokeWidth="1.2" />
      <rect x="9" y="30" width="16" height="3" rx="1.5" fill="#F5B820" />
    </svg>
  )
}

function StarIcon() {
  return <svg width="13" height="13" viewBox="0 0 20 20" aria-hidden><path d="M10 1.8l2.5 5.3 5.8.7-4.3 4 1.1 5.7L10 14.7l-5.1 2.8 1.1-5.7-4.3-4 5.8-.7z" fill="#F5B820" stroke="#15100A" strokeWidth="1.4" strokeLinejoin="round" /></svg>
}

/** Брелок с номером комнаты — цифры понятны без слов. */
function KeyTag({ room, small }: { room: number; small?: boolean }) {
  const w = small ? 46 : 64, h = small ? 18 : 26
  return (
    <svg width={w} height={h} viewBox="0 0 64 26" aria-hidden data-testid={small ? undefined : 'reception-key-tag'}>
      <path d="M3 13a6 6 0 1 0 12 0a6 6 0 1 0 -12 0z" fill="#F5B820" stroke="#15100A" strokeWidth="2" />
      <circle cx="9" cy="13" r="2" fill="#FDFAEF" stroke="#15100A" strokeWidth="1.4" />
      <path d="M15 13h8 M19 13v4 M22 13v3" stroke="#15100A" strokeWidth="2.2" strokeLinecap="round" />
      <rect x="26" y="4" width="35" height="18" rx="6" fill="#1B5FB0" stroke="#15100A" strokeWidth="2" />
      <text x="43.5" y="17.5" textAnchor="middle" fontSize="13" fontWeight="800" fill="#FDFAEF" fontFamily="system-ui, sans-serif">{room}</text>
    </svg>
  )
}

/** Холл гестхауса: дверь, доска с ключами, арочное окно на море с пальмой, растение, стойка со звонком. */
function Lobby({ given, rooms }: { given: number | null; rooms: number[] }) {
  return (
    <svg viewBox="0 0 360 300" preserveAspectRatio="xMidYMax slice" width="100%" height="100%" className="absolute inset-0" aria-hidden>
      {/* Потолок и лампы над холлом. */}
      <rect width="360" height="300" fill="#F4E3C8" />
      <rect width="360" height="16" fill="#E8D2AE" /><path d="M0 16 H360" stroke="#15100A" strokeWidth="1.2" />
      {[120, 250].map(x => (
        <g key={x}>
          <path d={`M${x} 16 v26`} stroke="#15100A" strokeWidth="1.4" />
          <path d={`M${x - 14} 54 a14 12 0 0 1 28 0 Z`} fill="#F5B820" stroke="#15100A" strokeWidth="1.6" />
          <ellipse cx={x} cy="58" rx="22" ry="5" fill="#FFE08A" opacity="0.5" />
        </g>
      ))}
      <g transform="translate(0 70)">
      <defs>
        <linearGradient id="rc-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9CC6EE" /><stop offset="0.55" stopColor="#D7EAF7" /><stop offset="0.56" stopColor="#4F9BB0" /><stop offset="1" stopColor="#2F7F86" /></linearGradient>
      </defs>
      {/* Стены и пол. */}
      <rect width="360" height="230" fill="#F4E3C8" />
      <rect y="120" width="360" height="72" fill="#E8D2AE" />
      <path d="M0 120 H360" stroke="#15100A" strokeWidth="1.2" />
      {Array.from({ length: 12 }, (_, k) => <path key={k} d={`M${k * 32 + 8} 122 v68`} stroke="#15100A" strokeWidth="0.8" opacity="0.18" />)}
      <rect y="192" width="360" height="38" fill="#B98E5E" />
      {Array.from({ length: 10 }, (_, k) => <path key={k} d={`M${k * 40} 192 l20 38`} stroke="#15100A" strokeWidth="0.8" opacity="0.2" />)}

      {/* Дверь на улицу. */}
      <g>
        <rect x="10" y="62" width="50" height="130" rx="3" fill="#7A4E2D" stroke="#15100A" strokeWidth="2" />
        <rect x="18" y="72" width="34" height="46" rx="16" fill="#D7EAF7" stroke="#15100A" strokeWidth="1.6" />
        <circle cx="52" cy="134" r="2.6" fill="#F5B820" stroke="#15100A" strokeWidth="1" />
      </g>

      {/* Доска с ключами: брелоки комнат, выданный ключ — пустой крючок. */}
      <g>
        <rect x="80" y="24" width="112" height="72" rx="6" fill="#B5793F" stroke="#15100A" strokeWidth="2" />
        {Array.from({ length: 8 }, (_, k) => {
          const x = 92 + (k % 4) * 26, y = 36 + Math.floor(k / 4) * 32
          const room = rooms[k]
          const gone = room !== undefined && room === given
          return (
            <g key={k}>
              <circle cx={x} cy={y} r="2" fill="#15100A" />
              {!gone && <g><path d={`M${x} ${y} v6`} stroke="#15100A" strokeWidth="1.4" /><rect x={x - 6} y={y + 6} width="12" height="14" rx="3" fill={k % 3 === 0 ? '#1B5FB0' : k % 3 === 1 ? '#E01A3C' : '#4E8A5B'} stroke="#15100A" strokeWidth="1.3" /></g>}
            </g>
          )
        })}
      </g>

      {/* Арочное окно: море и пальма. */}
      <g>
        <path d="M232 112 V52 a48 40 0 0 1 96 0 V112 Z" fill="url(#rc-sea)" stroke="#15100A" strokeWidth="2.4" />
        <path d="M280 12 V112 M232 66 H328" stroke="#FDFAEF" strokeWidth="5" />
        <path d="M280 12 V112 M232 66 H328" stroke="#15100A" strokeWidth="1" opacity="0.4" />
        <path d="M244 112 Q248 86 258 70" stroke="#7A4E2D" strokeWidth="4" fill="none" strokeLinecap="round" />
        {[-150, -110, -70, -30, 10].map(a => {
          const r = (a * Math.PI) / 180
          return <path key={a} d={`M258 70 q${Math.cos(r) * 10} ${Math.sin(r) * 10 - 4} ${Math.cos(r) * 20} ${Math.sin(r) * 16 + 6}`} stroke="#4E8A5B" strokeWidth="4" fill="none" strokeLinecap="round" />
        })}
        <path d="M232 112 h96" stroke="#15100A" strokeWidth="3" />
      </g>

      {/* Растение в кадке. */}
      <g>
        <rect x="334" y="160" width="22" height="32" rx="3" fill="#C2553A" stroke="#15100A" strokeWidth="1.8" />
        {[[-40, 30], [-10, 34], [20, 30], [45, 26]].map(([a, l], k) => {
          const r = ((a - 90) * Math.PI) / 180
          return <path key={k} d={`M345 160 q${Math.cos(r) * l * 0.4} ${Math.sin(r) * l * 0.6} ${Math.cos(r) * l} ${Math.sin(r) * l}`} stroke="#4E8A5B" strokeWidth="6" fill="none" strokeLinecap="round" />
        })}
      </g>

      </g>
    </svg>
  )
}

/** Стойка — отдельным слоем поверх гостя: он стоит за ней, видно его по пояс. */
function Counter() {
  return (
    <svg viewBox="0 0 360 300" preserveAspectRatio="xMidYMax slice" width="100%" height="100%" className="absolute inset-0 z-[15] pointer-events-none" aria-hidden>
      <g transform="translate(0 70)">
      {/* Стойка — спереди, гость стоит за ней. */}
      <g>
        <rect x="96" y="170" width="200" height="60" fill="#8A5A33" stroke="#15100A" strokeWidth="2.2" />
        <rect x="90" y="164" width="212" height="10" rx="3" fill="#B5793F" stroke="#15100A" strokeWidth="2" />
        {[0, 1, 2, 3].map(k => <rect key={k} x={110 + k * 46} y="182" width="34" height="38" rx="3" fill="none" stroke="#15100A" strokeWidth="1.2" opacity="0.4" />)}
        {/* Звонок. */}
        <path d="M262 164 a10 9 0 0 1 20 0 Z" fill="#F5B820" stroke="#15100A" strokeWidth="1.6" />
        <rect x="259" y="162" width="26" height="3" rx="1" fill="#15100A" />
        <circle cx="272" cy="153" r="2" fill="#15100A" />
      </g>
      </g>
    </svg>
  )
}
