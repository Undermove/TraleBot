import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import GameFrame from '../../alphabet/games/GameFrame'
import { burst, haptic, sound } from '../../alphabet/games/fx'
import { cyr } from '../../verbs/types'
import { NUMBERS, phrase } from '../story'
import { GameEnd, GameIntro, RuleCard } from '../ui'
import { hush, speak, speakUrl } from '../voice'
import { numberAudio } from '../audio'
import type { SceneProps, StepOf } from './types'
import { HINTS_OFF_AFTER, POINTS, heardBy, judge, match, replies, type Speaker } from './Pingpong.logic'
import type { Who } from './Walk.logic'
import Passerby, { type Face } from './walk/Passerby'
import { SpeechBubble } from './Walk'

/**
 * «Пинг-понг» на Бульваре: разговор — розыгрыш. Каждая реплика — удар по мячу. Вернул вопрос
 * («კარგად, შენ?») — мяч летит обратно, разговор живёт; ответил и замолчал — мяч в сетке. Подача по
 * очереди: то друг спрашивает тебя, то ты его. Мяч летит по дуге и отскакивает от стола; на твой удар —
 * вибрация.
 * Партия — один вечер: к столу подходят соседи, темнеет, друг зовёт «კიდევ?», счёт он называет
 * по-грузински. Логика — Pingpong.logic.ts.
 */

const G = ({ children }: { children: string }) => <b className="font-geo">{children}</b>
const FRIEND: Who = { ru: 'Друг', kind: 'man', coat: '#2F7F86', skin: '#C68A5E', hair: '#15100A', extra: 'cap', voice: 'm' }

/** Где мяч: у друга, у тебя, в полёте, в сетке. Координаты — проценты сцены. */
type Ball = 'friend' | 'you' | 'toFriend' | 'toYou' | 'net'
const AT = { friend: { left: 50, top: 37 }, you: { left: 66, top: 86 }, bounceFar: { left: 54, top: 50 }, bounceNear: { left: 60, top: 70 }, net: { left: 57, top: 57 } }

export default function Pingpong({ lesson, onExit, onDone, fraction }: SceneProps<StepOf<'pingpong'>>) {
  const rallies = useMemo(() => match(), [])
  const [phase, setPhase] = useState<'intro' | 'play' | 'end'>('intro')
  const [ri, setRi] = useState(0)
  const [si, setSi] = useState(0)
  const [yourTurn, setYourTurn] = useState(false)
  const [ball, setBall] = useState<Ball>('friend')
  const [throwKey, setThrowKey] = useState(0)
  const [swing, setSwing] = useState(0)
  const [their, setTheir] = useState<string | undefined>()
  const [mine, setMine] = useState<string | undefined>()
  const [talking, setTalking] = useState(false)
  const [face, setFace] = useState<Face>('smile')
  const [cue, setCue] = useState('')
  const [bad, setBad] = useState<string | undefined>()
  const [won, setWon] = useState(0)
  const [hits, setHits] = useState(0)
  const [best, setBest] = useState(0)
  const [streak, setStreak] = useState(0)
  const [nets, setNets] = useState(0)
  const [who, setWho] = useState<Speaker>('friend')
  const [called, setCalled] = useState(0)
  /** Какая плашка над кнопками: слушай, твой удар, мимо, сетка, розыгрыш твой. */
  const [tone, setTone] = useState<Tone>('listen')
  /** Новое слово на паузе: игра ждёт, пока человек нажмёт «Понятно». */
  const [learn, setLearn] = useState<string | undefined>()
  /** Кнопки новых слов с меткой «новое» — пока ими ни разу не ответили. */
  const [fresh, setFresh] = useState<string[]>([])
  const ack = useRef<(() => void) | undefined>()
  const shown = useRef(new Set<string>())
  const alive = useRef(true)
  const busy = useRef(false)
  useEffect(() => () => { alive.current = false; hush() }, [])
  const wait = (ms: number) => new Promise<void>(r => window.setTimeout(r, ms))

  const r = rallies[Math.min(ri, rallies.length - 1)]
  const hints = hits < HINTS_OFF_AFTER
  const panel = replies(lesson.id, heardBy(rallies, ri, si))

  const fly = async (to: Ball) => { setBall(to); setThrowKey(k => k + 1); await wait(to === 'net' ? 650 : 720) }

  // Реплика друга или того, кто подошёл. Слово сцены звучит впервые — игра встаёт на паузу с карточкой
  // «новое слово» и ждёт «Понятно»: слово не пролетает мимо, а кнопка с ним внизу помечена «новое».
  const friendHit = async (id: string, by: Speaker = 'friend', newWord?: string, rIdx = ri) => {
    setWho(by); setTheir(id); setTalking(true); setMine(undefined); setTone('listen')
    setCue(`${by === 'guest' ? rallies[rIdx]?.guest?.ru ?? 'Гость' : 'Друг'} говорит — послушай.`)
    haptic('soft'); sound.pop(2)
    const voice = by === 'guest' ? rallies[rIdx]?.guest?.voice ?? 'f' : 'm'
    // Пока говорит соседка, друг всё равно отбивает: мяч летит к тебе.
    await Promise.all([speak(id, voice), fly('toYou')])
    if (!alive.current) return
    setBall('you')
    setTalking(false)
    if (newWord === id && !shown.current.has(id)) {
      shown.current.add(id)
      setFresh(f => [...f, id]); setLearn(id); setTone('new'); setCue('Запомни слово и нажми «Понятно».'); haptic('soft')
      await new Promise<void>(r => { ack.current = r })
      if (!alive.current) return
      setLearn(undefined)
    }
  }

  const openShot = async (rIdx: number, sIdx: number) => {
    const shot = rallies[rIdx].shots[sIdx]
    setSi(sIdx); setBad(undefined); setFace('smile')
    if (shot.line) { await friendHit(shot.line, shot.by, shot.word, rIdx) }
    if (!alive.current) return
    setCue(shot.cue); setTone('turn')
    setYourTurn(true); busy.current = false
  }

  // Новый розыгрыш: мяч у подающего.
  useEffect(() => {
    if (phase !== 'play') return
    setTheir(undefined); setMine(undefined); setYourTurn(false); setStreak(0); setCue(rallies[ri].serve === 'friend' ? 'Подаёт друг.' : 'Подаёшь ты.'); setTone('listen')
    setBall(rallies[ri].serve === 'friend' ? 'friend' : 'you')
    const id = window.setTimeout(() => { if (alive.current) void openShot(ri, 0) }, 600)
    return () => window.clearTimeout(id)
  }, [phase, ri]) // eslint-disable-line react-hooks/exhaustive-deps

  const hit = async (id: string, el: HTMLElement) => {
    if (!yourTurn || busy.current) return
    busy.current = true
    setYourTurn(false); setBad(undefined)
    const shot = r.shots[si]
    const v = judge(shot, id)
    if (v.res === 'miss') {
      haptic('bad'); sound.miss(); setBad(id); setCue(v.hint); setTone('miss')
      setYourTurn(true); busy.current = false
      return
    }
    // Удар: ракетка замахивается, мяч уходит к другу — или в сетку.
    setSwing(s => s + 1); setMine(id); setTheir(undefined); setCue('Мяч летит…'); setTone('listen')
    haptic('snap'); sound.snap(3)
    await Promise.all([speak(id, 'hero'), fly(v.res === 'net' ? 'net' : 'toFriend')])
    if (!alive.current) return
    if (v.res === 'net') {
      haptic('bad'); sound.miss(); setNets(n => n + 1); setStreak(0)
      setFace('huh'); setCue(v.hint); setTone('net'); setBad(id)
      await wait(500)
      setBall('you'); setMine(undefined); setYourTurn(true); busy.current = false
      return
    }
    setBall('friend'); setHits(h => h + 1); setFresh(f => f.filter(w => w !== id))
    setStreak(s => { const n = s + 1; setBest(b => Math.max(b, n)); return n })
    if (shot.react) await friendHit(shot.react, shot.reactBy, shot.word)
    if (!alive.current) return
    if (si + 1 < r.shots.length) { void openShot(ri, si + 1); return }
    // Розыгрыш выигран — разговор состоялся. Друг называет счёт по-грузински.
    const score = won + 1
    setWon(score); sound.win(); haptic('good'); burst(el, 'small')
    setCue(score < rallies.length ? `Осталось розыгрышей: ${rallies.length - score}` : 'Это был последний — партия твоя!'); setTone('win'); setWho('friend'); setTheir(undefined); setCalled(score); setTalking(true)
    await speakUrl(numberAudio(score, 'm'), NUMBERS[score - 1].geo)
    if (!alive.current) return
    setTalking(false)
    await wait(900)
    if (!alive.current) return
    if (ri + 1 < rallies.length) setRi(x => x + 1)
    else setPhase('end')
  }

  const start = () => { setRi(0); setWon(0); setHits(0); setBest(0); setNets(0); setCalled(0); setFresh([]); setLearn(undefined); shown.current.clear(); setPhase('play') }

  const title = 'Пинг-понг на Бульваре'
  if (phase === 'intro') {
    return (
      <GameFrame title={title} eyebrow="игра урока" fraction={fraction} onExit={onExit}>
        <div className="flex-1 min-h-0 flex flex-col" data-testid="pingpong-scene">
          <GameIntro title={title} text="Партия с другом на Бульваре — 5 коротких розыгрышей. Каждая реплика — удар: спросили «როგორ ხარ?» — ответь и верни мяч: «კარგად, შენ?» Ответил и замолчал — мяч в сетке. К столу будут подходить соседи." onStart={start} hero
            chips={['kargad_shen', 'kargad_madloba'].map(id => ({ geo: phrase(id).geo, ru: phrase(id).ru }))} />
        </div>
      </GameFrame>
    )
  }
  if (phase === 'end') {
    return (
      <GameFrame title={title} eyebrow="игра урока" fraction={fraction} onExit={onExit}>
        <GameEnd title={`${won} : 0 — партия твоя!`} text={nets === 0 ? 'Ни одного мяча в сетке: ты всегда возвращал вопрос.' : `Мячей в сетке: ${nets}. Теперь ты знаешь, как их избежать.`}
          rule={<RuleCard title="Верни мяч"><G>კარგად, შენ?</G> — хорошо, а ты? Так разговор продолжается. А если «а ты?» спросили тебя — просто <G>კარგად, მადლობა</G>.</RuleCard>}
          onNext={onDone} onAgain={start} />
      </GameFrame>
    )
  }

  const pos = ball === 'toFriend' ? [AT.you, AT.bounceFar, AT.friend] : ball === 'toYou' ? [AT.friend, AT.bounceNear, AT.you] : ball === 'net' ? [AT.you, AT.net, { left: AT.net.left, top: AT.net.top + 7 }] : [AT[ball]]
  const scale = ball === 'toFriend' ? [1.25, 0.85, 0.55] : ball === 'toYou' ? [0.55, 0.9, 1.25] : ball === 'net' ? [1.25, 0.8, 0.75] : [ball === 'you' ? 1.25 : 0.55]

  return (
    <GameFrame title={title} eyebrow="игра урока" fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col gap-2.5" data-testid="pingpong-scene">
        <div className="relative flex-1 min-h-[280px] rounded-2xl border-[1.5px] border-jewelInk overflow-hidden" style={{ boxShadow: '3px 3px 0 #15100A' }} data-testid="pingpong-court">
          <Boulevard evening={!!r.evening} />
          {/* Друг за дальним краем стола. */}
          <div className="absolute left-1/2 top-[14%] -translate-x-1/2 z-10">
            <svg width="96" height="150" viewBox="-60 -190 120 196" className="overflow-visible" aria-hidden>
              <Passerby who={FRIEND} phase={0} stride={0} face={face} talking={talking} wave={false} />
              <g transform="translate(34 -96) rotate(-20)"><circle r="14" fill="#E01A3C" stroke="#15100A" strokeWidth="2.4" /><rect x="-3" y="12" width="6" height="18" rx="2" fill="#7A4E2D" stroke="#15100A" strokeWidth="2" /></g>
            </svg>
          </div>
          <Table />
          {/* Тот, кто подошёл к столу, — сбоку. */}
          <AnimatePresence>
            {r.guest && (
              <motion.div key={`g${ri}`} className="absolute left-[2%] top-[30%] z-[16]" data-testid="pingpong-guest"
                initial={{ x: -90, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -90, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 160, damping: 20 }}>
                <svg width="74" height="118" viewBox="-60 -190 120 196" className="overflow-visible" aria-hidden>
                  <Passerby who={r.guest} phase={0} stride={0} face="smile" talking={talking && who === 'guest'} wave={false} />
                </svg>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Мяч. */}
          <motion.div key={throwKey} data-testid="pingpong-ball" data-at={ball}
            className="absolute z-30 w-5 h-5 -ml-2.5 -mt-2.5 rounded-full border-[1.5px] border-jewelInk bg-cream"
            style={{ boxShadow: '0 3px 6px rgba(21,16,10,0.35)' }}
            initial={{ left: `${pos[0].left}%`, top: `${pos[0].top}%`, scale: scale[0] }}
            animate={{ left: pos.map(p => `${p.left}%`), top: pos.map(p => `${p.top}%`), scale, opacity: ball === 'net' ? [1, 1, 0.6] : 1 }}
            transition={{ duration: pos.length > 1 ? 0.7 : 0, ease: 'easeInOut', times: pos.length > 1 ? [0, 0.55, 1] : undefined }} />
          {/* Твоя ракетка — снизу, от первого лица. */}
          <motion.div key={`sw${swing}`} className="absolute right-[10%] bottom-[-6%] z-20 origin-bottom" aria-hidden
            initial={{ rotate: 0 }} animate={{ rotate: swing ? [0, -38, 8, 0] : 0 }} transition={{ duration: 0.45, times: [0, 0.35, 0.7, 1] }}>
            <svg width="96" height="130" viewBox="0 0 96 130">
              <rect x="40" y="70" width="16" height="58" rx="5" fill="#7A4E2D" stroke="#15100A" strokeWidth="2.6" />
              <ellipse cx="48" cy="44" rx="40" ry="42" fill="#1B5FB0" stroke="#15100A" strokeWidth="2.8" />
              <ellipse cx="40" cy="34" rx="14" ry="9" fill="#FFFFFF" opacity="0.18" />
            </svg>
          </motion.div>

          <div className="absolute top-2 left-2 right-2 flex justify-between z-30 pointer-events-none">
            <MatchProgress won={won} current={ri} total={POINTS} called={called} />
            {streak >= 2 && <motion.span key={`streak-${streak}`} initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="rounded-full bg-gold border-[1.5px] border-jewelInk px-2 py-0.5 text-[12px] font-extrabold">удары подряд: {streak}</motion.span>}
          </div>

          <AnimatePresence>
            {their && (
              <div key={`${ri}-${si}-${their}`} className={`absolute z-30 ${who === 'guest' ? 'left-[3%] top-[15%]' : 'left-[4%] top-[9%]'}`}>
                <motion.div data-testid="pingpong-their" initial={{ opacity: 0, scale: 0.6, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 24 }}>
                  <SpeechBubble id={their} hint={hints} />
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          {/* Новое слово: пауза поверх стола, пока не нажмёшь «Понятно». */}
          <AnimatePresence>
            {learn && (
              <motion.div key={learn} className="absolute inset-0 z-40 flex items-center justify-center bg-jewelInk/35 px-6"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.div data-testid="pingpong-new-word" data-word={learn}
                  className="w-full max-w-[260px] rounded-2xl border-[1.5px] border-jewelInk bg-gold-wash px-4 py-3 text-center"
                  style={{ boxShadow: '3px 3px 0 #15100A' }}
                  initial={{ scale: 0.7, rotate: -4 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 18 }}>
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-jewelInk-mid">новое слово</div>
                  <button type="button" onClick={() => { haptic('tap'); void speak(learn, who === 'guest' ? r.guest?.voice ?? 'f' : 'm') }}
                    className="mt-1 block w-full font-geo text-[26px] font-bold leading-tight" aria-label="Послушать ещё раз">{phrase(learn).geo}</button>
                  <div className="text-[13px] font-semibold text-jewelInk-hint">{cyr(phrase(learn).geo)} — {phrase(learn).ru}</div>
                  <div className="mt-2 text-[12px] leading-snug text-jewelInk-soft">Теперь эта кнопка есть внизу — с меткой «новое».</div>
                  <button type="button" data-testid="pingpong-word-ok" onClick={() => { haptic('tap'); ack.current?.(); ack.current = undefined }}
                    className="mt-3 w-full min-h-[44px] rounded-xl border-[1.5px] border-jewelInk bg-navy text-cream font-extrabold text-[15px]"
                    style={{ boxShadow: '2px 2px 0 #15100A' }}>Понятно</button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {mine && (
              <div key={`m-${ri}-${si}-${mine}`} className="absolute z-30 bottom-3 left-3 pointer-events-none">
                <motion.div data-testid="pingpong-mine" initial={{ opacity: 0, y: 30, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22 }}>
                  <SpeechBubble id={mine} hint={hints} mine />
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>

        <Task tone={tone} text={cue} />

        <div className="shrink-0 grid grid-cols-3 gap-2" data-testid="pingpong-replies" data-want={yourTurn ? r.shots[si].want : undefined}>
          {panel.map(id => (
            <motion.button key={id} data-testid={`pingpong-reply-${id}`} disabled={!yourTurn} onClick={e => { haptic('tap'); void hit(id, e.currentTarget) }}
              className="relative min-h-[54px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile px-1.5 py-1 text-center"
              style={{ boxShadow: '3px 3px 0 #15100A' }}
              animate={{ opacity: yourTurn ? 1 : 0.45, x: bad === id ? [0, -6, 6, -4, 4, 0] : 0, backgroundColor: bad === id ? '#F7DCDD' : '#FDFAEF' }}
              whileTap={yourTurn ? { scale: 0.94, y: 2 } : undefined}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
              {fresh.includes(id) && <span className="absolute -top-2 -right-1.5 rounded-full border-[1.5px] border-jewelInk bg-gold px-1.5 text-[9.5px] font-extrabold uppercase leading-[15px]">новое</span>}
              <span className="block font-geo font-bold leading-tight" style={{ fontSize: phrase(id).geo.length > 12 ? 12.5 : 14.5 }}>{phrase(id).geo}</span>
              <span className="block text-[10.5px] font-semibold text-jewelInk-hint leading-tight">{hints ? phrase(id).ru : cyr(phrase(id).geo)}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </GameFrame>
  )
}

type Tone = 'listen' | 'new' | 'turn' | 'miss' | 'net' | 'win'

const TONE: Record<Tone, { label: string; bg: string; chip: string }> = {
  listen: { label: 'Слушай', bg: 'bg-cream-deep', chip: 'bg-cream-edge' },
  new: { label: 'Новое слово', bg: 'bg-gold-wash', chip: 'bg-gold' },
  turn: { label: 'Твой удар', bg: 'bg-navy-wash', chip: 'bg-navy text-cream' },
  miss: { label: 'Не то', bg: 'bg-ruby-wash', chip: 'bg-ruby text-cream' },
  net: { label: 'Мяч в сетке', bg: 'bg-ruby-wash', chip: 'bg-ruby text-cream' },
  win: { label: 'Розыгрыш твой!', bg: 'bg-gold-wash', chip: 'bg-gold' }
}

/** Плашка над кнопками: что сейчас происходит и что от тебя нужно. */
function Task({ tone, text }: { tone: Tone; text: string }) {
  const t = TONE[tone]
  return (
    <motion.div key={`${tone}-${text}`} data-testid="pingpong-cue" data-tone={tone} aria-live="polite"
      className={`shrink-0 min-h-[58px] rounded-2xl border-[1.5px] border-jewelInk px-3 py-2 flex items-center gap-2.5 ${t.bg}`}
      initial={{ y: 6, opacity: 0.6 }} animate={{ y: 0, opacity: 1, x: tone === 'miss' || tone === 'net' ? [0, -4, 4, 0] : 0 }} transition={{ duration: 0.25 }}>
      <span className={`shrink-0 rounded-full border-[1.5px] border-jewelInk px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide ${t.chip}`}>{t.label}</span>
      <span className="flex-1 text-[14.5px] font-semibold leading-snug text-jewelInk">{text}</span>
    </motion.div>
  )
}

/** Сколько партии сыграно: пять мячей, выигранные закрашены, текущий мигает. */
function MatchProgress({ won, current, total, called }: { won: number; current: number; total: number; called: number }) {
  return (
    <div className="rounded-full bg-cream/90 border-[1.5px] border-jewelInk px-2 py-1 flex items-center gap-1.5" data-testid="pingpong-score" data-won={won}>
      <span className="text-[11px] font-extrabold">{won} : 0</span>
      <span className="flex items-center gap-1" aria-label={`Розыгрыш ${Math.min(current + 1, total)} из ${total}`}>
        {Array.from({ length: total }, (_, k) => (
          <motion.span key={k === won - 1 ? `w${called}` : k}
            className={`block w-3 h-3 rounded-full border-[1.5px] border-jewelInk ${k < won ? 'bg-gold' : 'bg-cream-tile'}`}
            initial={k === won - 1 ? { scale: 1.8 } : false}
            animate={k === current && k >= won ? { scale: [1, 1.25, 1] } : { scale: 1 }}
            transition={k === current && k >= won ? { repeat: Infinity, duration: 1.2 } : { type: 'spring', stiffness: 400, damping: 14 }} />
        ))}
      </span>
      <span className="text-[11px] font-bold text-jewelInk-mid">{current + 1 >= total ? 'последний' : `${Math.min(current + 1, total)} из ${total}`}</span>
    </div>
  )
}

/** Бульвар: небо, море, пальмы, плитка. Вечером небо темнеет, вместо солнца — луна. */
function Boulevard({ evening }: { evening: boolean }) {
  const INK = '#15100A'
  return (
    <svg viewBox="0 0 360 300" preserveAspectRatio="xMidYMax slice" width="100%" height="100%" className="absolute inset-0" aria-hidden>
      <defs>
        <linearGradient id="pp-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7FB4E6" /><stop offset="1" stopColor="#E6F0F6" /></linearGradient>
        <linearGradient id="pp-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4F9BB0" /><stop offset="1" stopColor="#2F7F86" /></linearGradient>
      </defs>
      <rect width="360" height="300" fill="url(#pp-sky)" />
      <rect width="360" height="96" fill="#1E2A55" style={{ opacity: evening ? 0.75 : 0, transition: 'opacity 1.2s ease' }} />
      {evening
        ? <path d="M306 22a14 14 0 1 0 6 24a11 11 0 0 1 -6 -24Z" fill="#F5E6A8" stroke={INK} strokeWidth="1.2" />
        : <circle cx="300" cy="34" r="14" fill="#F5B820" stroke={INK} strokeWidth="1.2" />}
      <rect y="70" width="360" height="26" fill="url(#pp-sea)" />
      {[[30, 80], [90, 86], [200, 78], [260, 88], [330, 82]].map(([x, y], k) => <path key={k} d={`M${x} ${y} q6 -3 12 0`} stroke="#FDFAEF" strokeWidth="1.4" fill="none" />)}
      <rect y="96" width="360" height="204" fill="#E3D6BE" />
      <rect y="96" width="360" height="204" fill="#1E2A55" style={{ opacity: evening ? 0.25 : 0, transition: 'opacity 1.2s ease' }} />
      {Array.from({ length: 14 }, (_, k) => <path key={k} d={`M${180 + (k * 30 - 195) * 0.4} 96 L${180 + (k * 30 - 195) * 1.8} 300`} stroke={INK} strokeWidth="0.7" opacity="0.18" />)}
      {[[18, 96], [342, 96]].map(([x, y], k) => (
        <g key={k}>
          <path d={`M${x} ${y} Q${x + (k ? -6 : 6)} ${y - 40} ${x + (k ? -2 : 2)} ${y - 70}`} stroke="#7A4E2D" strokeWidth="5" fill="none" strokeLinecap="round" />
          {[-150, -110, -70, -30, 10].map(a => { const rr = (a * Math.PI) / 180; return <path key={a} d={`M${x + (k ? -2 : 2)} ${y - 70} q${Math.cos(rr) * 14} ${Math.sin(rr) * 14 - 4} ${Math.cos(rr) * 28} ${Math.sin(rr) * 22 + 8}`} stroke="#4E8A5B" strokeWidth="5" fill="none" strokeLinecap="round" /> })}
        </g>
      ))}
    </svg>
  )
}

/** Теннисный стол в перспективе с сеткой. */
function Table() {
  const INK = '#15100A'
  return (
    <svg viewBox="0 0 360 300" preserveAspectRatio="xMidYMax slice" width="100%" height="100%" className="absolute inset-0 z-[15] pointer-events-none" aria-hidden>
      <path d="M118 128 L242 128 L320 262 L40 262 Z" fill="#1F6E8C" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M118 128 L242 128 L320 262 L40 262 Z" fill="none" stroke="#FDFAEF" strokeWidth="2" transform="translate(0 0)" />
      <path d="M180 128 V262" stroke="#FDFAEF" strokeWidth="1.6" />
      <path d="M40 262 L40 272 L320 272 L320 262" fill="#165670" stroke={INK} strokeWidth="2" />
      {/* Сетка. */}
      <path d="M88 178 L272 178 L272 192 L88 192 Z" fill="#FDFAEF" fillOpacity="0.55" stroke={INK} strokeWidth="1.8" />
      {Array.from({ length: 18 }, (_, k) => <path key={k} d={`M${92 + k * 10} 178 v14`} stroke={INK} strokeWidth="0.6" opacity="0.5" />)}
      <path d="M84 176 v20 M276 176 v20" stroke={INK} strokeWidth="3" />
      <path d="M70 272 v24 M290 272 v24" stroke={INK} strokeWidth="4" />
    </svg>
  )
}
